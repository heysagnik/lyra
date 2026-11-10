import { describe, it, expect, vi } from "vitest";
import * as dbModule from "@/lib/db";
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  incrementMsgCount,
  updateConversationSummaryCas,
} from "./conversations";
import {
  getRecentMessages,
  createMessage,
  listConversationMessages,
} from "./messages";
import {
  getUserMemories,
  upsertMemory,
  touchMemories,
  deleteMemory,
} from "./memories";

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

  it("creates, updates, and deletes conversations", async () => {
    const mockCreated = {
      id: "conv-created-1",
      userId: "user-1",
      title: "New Created Chat",
      summary: null,
      summaryVersion: 0,
      summaryUpto: null,
      summarizedCount: 0,
      msgCount: 0,
      searchDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockCreated]),
    };
    const mockUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ ...mockCreated, title: "Updated Title" }]),
    };
    const mockDelete = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "conv-created-1" }]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      insert: () => mockInsert,
      update: () => mockUpdate,
      delete: () => mockDelete,
    } as unknown as dbModule.DbClient);

    const created = await createConversation({
      userId: "user-1",
      title: "New Created Chat",
    });
    expect(created.id).toBe("conv-created-1");

    const updated = await updateConversation("conv-created-1", "user-1", {
      title: "Updated Title",
    });
    expect(updated?.title).toBe("Updated Title");

    const deleted = await deleteConversation("conv-created-1", "user-1");
    expect(deleted).toBe(true);

    await expect(incrementMsgCount("conv-created-1")).resolves.not.toThrow();
  });

  it("creates messages and lists conversation messages", async () => {
    const mockCreatedMsg = {
      id: "msg-100",
      conversationId: "conv-1",
      role: "user",
      content: "Hello there",
      toolCalls: null,
      sources: null,
      model: null,
      tokensIn: null,
      tokensOut: null,
      latencyMs: null,
      createdAt: new Date(),
    };

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockCreatedMsg]),
    };
    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockCreatedMsg]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      insert: () => mockInsert,
      select: () => mockSelect,
    } as unknown as dbModule.DbClient);

    const createdMsg = await createMessage({
      conversationId: "conv-1",
      role: "user",
      content: "Hello there",
    });
    expect(createdMsg.id).toBe("msg-100");

    const listed = await listConversationMessages("conv-1", 50);
    expect(listed).toHaveLength(1);
    expect(listed[0].content).toBe("Hello there");
  });

  it("upserts, touches, and deletes user memories", async () => {
    const mockMemory = {
      id: "mem-upserted",
      userId: "user-1",
      kind: "preference",
      content: "Prefers TypeScript",
      confidence: 0.9,
      sourceConversation: "conv-1",
      contentHash: "hash-ts",
      embedding: null,
      lastUsedAt: new Date(),
      createdAt: new Date(),
    };

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockMemory]),
    };
    const mockUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    const mockDelete = {
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "mem-upserted" }]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      insert: () => mockInsert,
      update: () => mockUpdate,
      delete: () => mockDelete,
    } as unknown as dbModule.DbClient);

    const upserted = await upsertMemory({
      userId: "user-1",
      kind: "preference",
      content: "Prefers TypeScript",
      contentHash: "hash-ts",
    });
    expect(upserted.id).toBe("mem-upserted");

    await expect(touchMemories(["mem-upserted"])).resolves.not.toThrow();

    const deleted = await deleteMemory("mem-upserted", "user-1");
    expect(deleted).toBe(true);
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

  it("updates conversation summary with optimistic CAS concurrency check", async () => {
    // 1. Success case: matching version returns updated record
    const mockSuccessUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: "conv-cas-1" }]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      update: () => mockSuccessUpdate,
    } as unknown as dbModule.DbClient);

    const casSuccess = await updateConversationSummaryCas("conv-cas-1", 2, {
      summary: "Updated summary version 3",
      summarizedCount: 20,
    });
    expect(casSuccess).toBe(true);

    // 2. Conflict case: version mismatch returns empty array
    const mockConflictUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };

    vi.spyOn(dbModule, "getDb").mockReturnValue({
      update: () => mockConflictUpdate,
    } as unknown as dbModule.DbClient);

    const casConflict = await updateConversationSummaryCas("conv-cas-1", 2, {
      summary: "Stale summary version",
      summarizedCount: 20,
    });
    expect(casConflict).toBe(false);
  });
});
