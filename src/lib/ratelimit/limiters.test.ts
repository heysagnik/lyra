import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimits, setLimitersForTesting } from "./limiters";
import * as dbModule from "@/lib/db";

describe("Rate Limiters", () => {
  beforeEach(() => {
    setLimitersForTesting(null);
  });

  it("enforces concurrent in-flight request cap of 2", async () => {
    const userId = "test-user-limit-concurrency";

    // Request 1
    const res1 = await checkRateLimits(userId);
    expect(res1.ok).toBe(true);

    // Request 2
    const res2 = await checkRateLimits(userId);
    expect(res2.ok).toBe(true);

    // Request 3 (should exceed MAX_INFLIGHT = 2)
    const res3 = await checkRateLimits(userId);
    expect(res3.ok).toBe(false);
    expect(res3.retryAfter).toBe(2);

    // Release slot 1
    if (res1.release) {
      await res1.release();
    }

    // Now request 4 should succeed
    const res4 = await checkRateLimits(userId);
    expect(res4.ok).toBe(true);

    // Clean up
    if (res2.release) await res2.release();
    if (res4.release) await res4.release();
  });

  it("handles release gracefully when count is 0 or unassigned", async () => {
    const res = await checkRateLimits("user-single-release");
    expect(res.ok).toBe(true);
    if (res.release) {
      await res.release();
      // Second release call should not crash
      await res.release();
    }
  });

  it("enforces per-minute sliding window rate limit", async () => {
    setLimitersForTesting({
      minLimiter: {
        limit: async () => ({
          success: false,
          reset: Date.now() + 30000,
        }),
      },
      dayLimiter: {
        limit: async () => ({
          success: true,
          reset: Date.now() + 86400000,
        }),
      },
    });

    const res = await checkRateLimits("user-min-limited");
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("enforces per-day sliding window rate limit", async () => {
    setLimitersForTesting({
      minLimiter: {
        limit: async () => ({
          success: true,
          reset: Date.now() + 60000,
        }),
      },
      dayLimiter: {
        limit: async () => ({
          success: false,
          reset: Date.now() + 7200000,
        }),
      },
    });

    const res = await checkRateLimits("user-day-limited");
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("allows request when both limiters succeed", async () => {
    setLimitersForTesting({
      minLimiter: {
        limit: async () => ({
          success: true,
          reset: Date.now() + 60000,
        }),
      },
      dayLimiter: {
        limit: async () => ({
          success: true,
          reset: Date.now() + 86400000,
        }),
      },
    });

    const res = await checkRateLimits("user-allowed");
    expect(res.ok).toBe(true);
    if (res.release) {
      await res.release();
    }
  });

  it("enforces rate limits based on usage_events in database", async () => {
    vi.spyOn(dbModule, "getDb").mockReturnValue({
      select: () => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            countMin: 25,
            countDay: 25,
            oldestInMin: new Date(Date.now() - 30000),
          },
        ]),
      }),
    } as unknown as dbModule.DbClient);

    const res = await checkRateLimits("user-db-limited");
    expect(res.ok).toBe(false);
    expect(res.retryAfter).toBeGreaterThanOrEqual(1);
  });
});


describe("Output token per minute (OTPM) gate", () => {
  const importLimiter = async () => await import("./limiters");
  const importBudget = async () => await import("@/lib/agent/budget");

  function mockUsageSum(total: number, oldestAt: Date | null = null) {
    vi.spyOn(dbModule, "getDb").mockReturnValue({
      select: () => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ total, oldestAt }]),
      }),
    } as unknown as dbModule.DbClient);
  }

  it("allows a turn when the rolling window has headroom", async () => {
    const { acquireOutputTokenBudget } = await importLimiter();
    const { MODEL_OTPM_LIMITS, OTPM_SAFETY_MARGIN } = await importBudget();
    const model = "qwen/qwen3.8-27b";
    mockUsageSum(0);

    const gate = await acquireOutputTokenBudget(
      model,
      MODEL_OTPM_LIMITS[model] - OTPM_SAFETY_MARGIN
    );
    expect(gate.ok).toBe(true);
    await gate.release?.();
  });

  it("denies a turn when recorded output tokens exceed the usable ceiling", async () => {
    const { acquireOutputTokenBudget } = await importLimiter();
    const { MODEL_OTPM_LIMITS, OTPM_SAFETY_MARGIN } = await importBudget();
    const model = "qwen/qwen3.8-27b";
    // usage_events already shows tokens at/above the usable ceiling
    mockUsageSum(MODEL_OTPM_LIMITS[model] - OTPM_SAFETY_MARGIN, new Date());

    const gate = await acquireOutputTokenBudget(model, 900);
    expect(gate.ok).toBe(false);
    expect(gate.retryAfter).toBeGreaterThanOrEqual(5);
    expect(gate.retryAfter).toBeLessThanOrEqual(60);
  });

  it("accounts for in-flight reservations between concurrent turns", async () => {
    const { acquireOutputTokenBudget } = await importLimiter();
    const { MODEL_OTPM_LIMITS, OTPM_SAFETY_MARGIN } = await importBudget();
    const model = "qwen/qwen3.8-27b";
    mockUsageSum(MODEL_OTPM_LIMITS[model] - OTPM_SAFETY_MARGIN - 900);

    // First turn reserves the remaining headroom
    const first = await acquireOutputTokenBudget(model, 900);
    expect(first.ok).toBe(true);

    // Second concurrent turn must be denied — nothing left
    const second = await acquireOutputTokenBudget(model, 900);
    expect(second.ok).toBe(false);

    // After release, the reservation frees up
    await first.release?.();
    const third = await acquireOutputTokenBudget(model, 900);
    expect(third.ok).toBe(true);
    await third.release?.();
  });

  it("passes through for models without an OTPM limit", async () => {
    const { acquireOutputTokenBudget } = await importLimiter();
    mockUsageSum(999999);
    const gate = await acquireOutputTokenBudget("openai/gpt-oss-20b", 4096);
    expect(gate.ok).toBe(true);
    await gate.release?.();
  });
});
