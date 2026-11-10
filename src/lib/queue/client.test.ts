import { describe, it, expect, vi, beforeEach } from "vitest";
import { enqueueSideEffects, setQStashClientForTesting } from "./client";
import { Client } from "@upstash/qstash";

describe("Queue Client", () => {
  beforeEach(() => {
    setQStashClientForTesting(null);
  });

  it("safely skips enqueuing when QStash client is not configured", async () => {
    await expect(
      enqueueSideEffects("conv-no-client", "user-1", 15, 0)
    ).resolves.not.toThrow();
  });

  it("publishes chat.distill and chat.summarize when conditions are met", async () => {
    const mockPublish = vi.fn().mockResolvedValue({ messageId: "msg_123" });
    const mockClient = {
      publishJSON: mockPublish,
    } as unknown as Client;

    setQStashClientForTesting(mockClient);

    // When msgCount - summarizedCount >= 10, both distill and summarize are published
    await enqueueSideEffects("conv-1", "user-1", 15, 0);

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: expect.stringContaining("/api/workers/distill"),
        body: { conversationId: "conv-1", userId: "user-1" },
      })
    );
    expect(mockPublish).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: expect.stringContaining("/api/workers/summarize"),
        body: { conversationId: "conv-1", userId: "user-1" },
      })
    );
  });

  it("only publishes distill when summarize lag is less than 10", async () => {
    const mockPublish = vi.fn().mockResolvedValue({ messageId: "msg_123" });
    const mockClient = {
      publishJSON: mockPublish,
    } as unknown as Client;

    setQStashClientForTesting(mockClient);

    await enqueueSideEffects("conv-1", "user-1", 5, 0);
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/api/workers/distill"),
      })
    );
  });

  it("handles QStash publish failures without crashing callers", async () => {
    const mockPublish = vi.fn().mockRejectedValue(new Error("QStash HTTP 500"));
    const mockClient = {
      publishJSON: mockPublish,
    } as unknown as Client;

    setQStashClientForTesting(mockClient);

    await expect(
      enqueueSideEffects("conv-fail", "user-fail", 20, 0)
    ).resolves.not.toThrow();
  });
});

