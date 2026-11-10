import { describe, it, expect, vi } from "vitest";
import * as dbModule from "@/lib/db";
import {
  listConversations,
  getConversation,
} from "./conversations";
import { getRecentMessages } from "./messages";
import { getUserMemories } from "./memories";

describe("Database queries domain mapping", () => {
  it("maps conversation rows to domain Conversation types", async () => {
    const mockRow = {
      id: "conv-1",
      userId: "user-1",
      title: "Test Chat",
      summary: "A summary",
      summaryVersion: 1,
      summaryUpto: "msg-1",
      summarizedCount: 10,
      msgCount: 10,
      searchDefault: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockRow]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      select: () => mockSelect,
    } as unknown as dbModule.DbClient);

    const convs = await listConversations("user-1");
    expect(convs).toHaveLength(1);
    expect(convs[0].id).toBe("conv-1");
    expect(convs[0].title).toBe("Test Chat");
    expect(convs[0].summaryVersion).toBe(1);

    const singleConv = await getConversation("conv-1", "user-1");
    expect(singleConv).not.toBeNull();
    expect(singleConv?.id).toBe("conv-1");
  });

  it("returns user memories ordered by recency and confidence", async () => {
    const mockMemory = {
      id: "mem-1",
      userId: "user-1",
      kind: "preference",
      content: "Uses TypeScript",
      confidence: 0.9,
      sourceConversation: "conv-1",
      contentHash: "hash123",
      embedding: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
    };

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockMemory]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      select: () => mockSelect,
    } as unknown as dbModule.DbClient);

    const mems = await getUserMemories("user-1", 5);
    expect(mems).toHaveLength(1);
    expect(mems[0].content).toBe("Uses TypeScript");
  });

  it("returns recent messages in ascending chronological order", async () => {
    const msg1 = {
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "Hello",
      toolCalls: null,
      sources: null,
      model: null,
      tokensIn: null,
      tokensOut: null,
      latencyMs: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    const msg2 = {
      id: "msg-2",
      conversationId: "conv-1",
      role: "assistant",
      content: "Hi there!",
      toolCalls: null,
      sources: null,
      model: "qwen/qwen3.8-27b",
      tokensIn: 10,
      tokensOut: 15,
      latencyMs: 100,
      createdAt: new Date("2026-01-01T00:00:05Z"),
    };

    // DB query returns latest first (desc): [msg2, msg1]
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([msg2, msg1]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      select: () => mockSelect,
    } as unknown as dbModule.DbClient);

    const recent = await getRecentMessages("conv-1", 10);
    // Should be reversed to chronological ascending: [msg1, msg2]
    expect(recent[0].id).toBe("msg-1");
    expect(recent[1].id).toBe("msg-2");
  });
});
