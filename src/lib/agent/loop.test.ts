import { describe, it, expect, vi, beforeEach } from "vitest";
import { runTurn } from "./loop";
import * as authModule from "@/lib/auth/require-user";
import * as limitersModule from "@/lib/ratelimit/limiters";
import * as convQueries from "@/lib/db/queries/conversations";
import * as msgQueries from "@/lib/db/queries/messages";
import * as memQueries from "@/lib/db/queries/memories";
import { makeAppError, err, ok } from "@/lib/errors";

describe("Agent Loop - runTurn", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when request is not authenticated", async () => {
    vi.spyOn(authModule, "requireUser").mockResolvedValue(
      err(makeAppError("AUTH", "Unauthorized"))
    );

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Hello" }),
    });

    const res = await runTurn({
      request: req,
      input: { text: "Hello" },
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 429 with Retry-After header when rate limit is exceeded", async () => {
    vi.spyOn(authModule, "requireUser").mockResolvedValue(
      ok({ id: "user-1", email: "u@test.com", name: "User" })
    );

    vi.spyOn(limitersModule, "checkRateLimits").mockResolvedValue({
      ok: false,
      retryAfter: 45,
    });

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Hello" }),
    });

    const res = await runTurn({
      request: req,
      input: { text: "Hello" },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("45");
  });

  it("returns SSE UI message stream on valid turn execution", async () => {
    vi.spyOn(authModule, "requireUser").mockResolvedValue(
      ok({ id: "user-1", email: "u@test.com", name: "User" })
    );

    vi.spyOn(limitersModule, "checkRateLimits").mockResolvedValue({
      ok: true,
      release: vi.fn().mockResolvedValue(undefined),
    });

    vi.spyOn(convQueries, "createConversation").mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      title: "Hello",
      summary: null,
      summaryVersion: 0,
      summaryUpto: null,
      summarizedCount: 0,
      msgCount: 1,
      searchDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(convQueries, "getConversation").mockResolvedValue({
      id: "conv-1",
      userId: "user-1",
      title: "Hello",
      summary: null,
      summaryVersion: 0,
      summaryUpto: null,
      summarizedCount: 0,
      msgCount: 1,
      searchDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.spyOn(convQueries, "incrementMsgCount").mockResolvedValue(undefined);
    vi.spyOn(msgQueries, "createMessage").mockResolvedValue({
      id: "msg-1",
      conversationId: "conv-1",
      role: "user",
      content: "Hello",
      createdAt: new Date(),
    });
    vi.spyOn(msgQueries, "getRecentMessages").mockResolvedValue([]);
    vi.spyOn(memQueries, "getUserMemories").mockResolvedValue([]);

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Hello" }),
    });

    const res = await runTurn({
      request: req,
      input: { text: "Hello", search: false },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("returns 500 when fatal error occurs in runTurn", async () => {
    vi.spyOn(authModule, "requireUser").mockResolvedValue(
      ok({ id: "user-1", email: "u@test.com", name: "User" })
    );
    const mockRelease = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(limitersModule, "checkRateLimits").mockResolvedValue({
      ok: true,
      release: mockRelease,
    });
    vi.spyOn(convQueries, "createConversation").mockRejectedValue(
      new Error("Database connection lost")
    );

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "Hello" }),
    });

    const res = await runTurn({
      request: req,
      input: { text: "Hello" },
    });

    expect(res.status).toBe(500);
    expect(mockRelease).toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toContain("Internal server error");
  });
});
