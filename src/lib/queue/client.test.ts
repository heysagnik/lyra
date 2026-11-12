import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueSideEffects, setTaskRunnerForTesting } from "./client";

describe("Queue Client (In-Process Async Dispatcher)", () => {
  beforeEach(() => {
    setTaskRunnerForTesting(null);
  });

  it("safely dispatches background tasks without throwing", async () => {
    await expect(
      enqueueSideEffects("conv-no-client", "user-1", 15, 0)
    ).resolves.not.toThrow();
  });

  it("dispatches chat.distill and chat.summarize when conditions are met", async () => {
    const mockDistill = vi.fn().mockResolvedValue({ success: true, count: 1 });
    const mockSummarize = vi.fn().mockResolvedValue({ success: true, updated: true });

    setTaskRunnerForTesting({
      distill: mockDistill,
      summarize: mockSummarize,
    });

    // When msgCount - summarizedCount >= 10, both distill and summarize are dispatched
    await enqueueSideEffects("conv-1", "user-1", 15, 0);

    // Allow microtask to drain
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockDistill).toHaveBeenCalledWith("conv-1", "user-1");
    expect(mockSummarize).toHaveBeenCalledWith("conv-1", "user-1");
  });

  it("only dispatches distill when summarize lag is less than 10", async () => {
    const mockDistill = vi.fn().mockResolvedValue({ success: true, count: 1 });
    const mockSummarize = vi.fn().mockResolvedValue({ success: true, updated: false });

    setTaskRunnerForTesting({
      distill: mockDistill,
      summarize: mockSummarize,
    });

    await enqueueSideEffects("conv-1", "user-1", 5, 0);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockDistill).toHaveBeenCalledWith("conv-1", "user-1");
    expect(mockSummarize).not.toHaveBeenCalled();
  });

  it("handles background task failures without crashing callers", async () => {
    const mockDistill = vi.fn().mockRejectedValue(new Error("Database error"));
    const mockSummarize = vi.fn().mockRejectedValue(new Error("LLM error"));

    setTaskRunnerForTesting({
      distill: mockDistill,
      summarize: mockSummarize,
    });

    await expect(
      enqueueSideEffects("conv-fail", "user-fail", 20, 0)
    ).resolves.not.toThrow();
  });
});
