import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchConversations,
  fetchConversation,
  updateConversationApi,
  deleteConversationApi,
} from "./client";

describe("API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchConversations retrieves conversations list", async () => {
    const mockList = [{ id: "c1", title: "Chat 1" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockList),
    });

    const result = await fetchConversations();
    expect(result).toEqual(mockList);
    expect(global.fetch).toHaveBeenCalledWith("/api/conversations");
  });

  it("fetchConversation retrieves a single conversation with messages", async () => {
    const mockData = { conversation: { id: "c1" }, messages: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    });

    const result = await fetchConversation("c1");
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith("/api/conversations/c1");
  });

  it("updateConversationApi sends PATCH request", async () => {
    const mockUpdated = { id: "c1", title: "New Title" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockUpdated),
    });

    const result = await updateConversationApi("c1", { title: "New Title" });
    expect(result).toEqual(mockUpdated);
  });

  it("deleteConversationApi sends DELETE request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });

    await expect(deleteConversationApi("c1")).resolves.not.toThrow();
  });

  it("throws error when API response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Internal Server Error",
    });

    await expect(fetchConversations()).rejects.toThrow("Failed to fetch conversations");
    await expect(fetchConversation("c1")).rejects.toThrow("Failed to fetch conversation");
    await expect(updateConversationApi("c1", { title: "x" })).rejects.toThrow("Failed to update conversation");
    await expect(deleteConversationApi("c1")).rejects.toThrow("Failed to delete conversation");
  });
});
