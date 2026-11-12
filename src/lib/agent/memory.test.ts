import { describe, it, expect, vi, beforeEach } from "vitest";
import { assemblePromptContext } from "./memory";
import * as convQueries from "@/lib/db/queries/conversations";
import * as msgQueries from "@/lib/db/queries/messages";
import * as memQueries from "@/lib/db/queries/memories";
import type { Conversation, Message, Memory } from "@/types";

describe("Memory and Context Assembly", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(memQueries, "touchMemories").mockResolvedValue(undefined);
  });

  it("assembles context for new conversation without existing history", async () => {
    vi.spyOn(memQueries, "getUserMemories").mockResolvedValue([]);

    const ctx = await assemblePromptContext("user-1");
    expect(ctx.systemPrompt).toContain("You are Lyra");
    expect(ctx.window).toEqual([]);
    expect(ctx.searchDefault).toBe(true);
  });

  it("assembles context including summary, memories, and verbatim window", async () => {
    const mockConv: Conversation = {
      id: "conv-1",
      userId: "user-1",
      title: "Trip Planning",
      summary: "User is planning a vacation in Kyoto.",
      summaryVersion: 1,
      summaryUpto: "msg-1",
      summarizedCount: 10,
      msgCount: 12,
      searchDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMessages: Message[] = [
      {
        id: "msg-11",
        conversationId: "conv-1",
        role: "user",
        content: "What hotels do you recommend near Gion?",
        createdAt: new Date(),
      },
      {
        id: "msg-12",
        conversationId: "conv-1",
        role: "assistant",
        content: "Here are top hotels in Gion...",
        createdAt: new Date(),
      },
    ];

    const mockMemories: Memory[] = [
      {
        id: "mem-1",
        userId: "user-1",
        kind: "preference",
        content: "Budget traveler",
        confidence: 0.9,
        contentHash: "h1",
        createdAt: new Date(),
      },
    ];

    vi.spyOn(convQueries, "getConversation").mockResolvedValue(mockConv);
    vi.spyOn(msgQueries, "getRecentMessages").mockResolvedValue(mockMessages);
    vi.spyOn(memQueries, "getUserMemories").mockResolvedValue(mockMemories);

    const ctx = await assemblePromptContext("user-1", "conv-1");

    expect(ctx.conversationTitle).toBe("Trip Planning");
    expect(ctx.systemPrompt).toContain("Kyoto");
    expect(ctx.systemPrompt).toContain("Budget traveler");
    expect(ctx.window).toHaveLength(2);
    expect(ctx.window[0].role).toBe("user");
    expect(ctx.window[0].content).toContain("What hotels do you recommend near Gion?");
  });
});
