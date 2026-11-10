import { describe, it, expect, vi } from "vitest";
import * as dbModule from "@/lib/db";
import {
  recordUsageEvent,
  recordJobFailure,
  countJobFailures,
  rollupDailyUsage,
  pruneOldUsageEvents,
  getRecentJobFailures,
} from "./usage";

describe("Usage and Failure Queries", () => {
  it("records usage event properly", async () => {
    const mockCreated = {
      id: 1,
      userId: "u1",
      conversationId: "c1",
      model: "qwen/qwen3.8-27b",
      tokensIn: 50,
      tokensOut: 25,
      cachedIn: 0,
      costUsd: "0.000010",
      createdAt: new Date(),
    };

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockCreated]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      insert: () => mockInsert,
    } as unknown as dbModule.DbClient);

    const event = await recordUsageEvent({
      userId: "u1",
      conversationId: "c1",
      model: "qwen/qwen3.8-27b",
      tokensIn: 50,
      tokensOut: 25,
    });

    expect(event.id).toBe(1);
    expect(event.userId).toBe("u1");
  });

  it("records job failure audit entries", async () => {
    const mockFailure = {
      id: 10,
      kind: "chat.summarize",
      payload: { conv: "c1" },
      error: "Timeout error",
      attempts: 1,
      createdAt: new Date(),
    };

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockFailure]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      insert: () => mockInsert,
    } as unknown as dbModule.DbClient);

    const failure = await recordJobFailure({
      kind: "chat.summarize",
      payload: { conv: "c1" },
      error: "Timeout error",
    });

    expect(failure.id).toBe(10);
    expect(failure.kind).toBe("chat.summarize");
  });

  it("counts job failures within given time range", async () => {
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ count: 3 }]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      select: () => mockSelect,
    } as unknown as dbModule.DbClient);

    const count = await countJobFailures(new Date());
    expect(count).toBe(3);
  });

  it("rolls up daily usage and prunes old events", async () => {
    const mockExecute = vi.fn().mockResolvedValue(undefined);
    const mockDelete = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      execute: mockExecute,
      delete: () => mockDelete,
    } as unknown as dbModule.DbClient);

    await expect(rollupDailyUsage("2026-01-01")).resolves.not.toThrow();
    expect(mockExecute).toHaveBeenCalled();

    const pruned = await pruneOldUsageEvents(90);
    expect(pruned).toBe(2);
  });

  it("lists recent job failures", async () => {
    const mockFailures = [
      {
        id: 1,
        kind: "chat.distill",
        payload: {},
        error: "err",
        attempts: 1,
        createdAt: new Date(),
      },
    ];

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(mockFailures),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      select: () => mockSelect,
    } as unknown as dbModule.DbClient);

    const failures = await getRecentJobFailures(5);
    expect(failures).toHaveLength(1);
    expect(failures[0].kind).toBe("chat.distill");
  });
});
