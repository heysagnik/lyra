// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runTurn } from "./loop";

// Load .env for the live provider (vitest does not read .env files).
// Force-override the fake keys planted by vitest.setup.ts.
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.trim().match(/^([A-Z_]+)="?([^"\n]*)"?.*$/);
    if (
      m &&
      (m[1] === "GROQ_API_KEY" ||
        m[1] === "TINYFISH_API_KEY" ||
        !process.env[m[1]])
    ) {
      process.env[m[1]] = m[2];
    }
  }
} catch {}

describe.skipIf(!process.env.LIVE_AGENT_TEST)("LIVE loop diagnostics", () => {
  it("runs a full turn against real Groq and dumps the UI stream", async () => {
    vi.spyOn(authModule, "requireUser").mockResolvedValue(
      ok({ id: "user-1", email: "u@test.com", name: "User" })
    );
    vi.spyOn(limitersModule, "checkRateLimits").mockResolvedValue({
      ok: true,
      release: vi.fn().mockResolvedValue(undefined),
    });
    const mockConv = {
      id: "conv-1",
      userId: "user-1",
      title: "q",
      summary: null,
      summaryUpto: null,
      summaryVersion: 0,
      summarizedCount: 0,
      msgCount: 1,
      searchDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(convQueries, "createConversation").mockResolvedValue(mockConv);
    vi.spyOn(convQueries, "getConversation").mockResolvedValue(mockConv);
    vi.spyOn(convQueries, "incrementMsgCount").mockResolvedValue(undefined);
    vi.spyOn(msgQueries, "createMessage").mockResolvedValue({
      id: "m",
      conversationId: "conv-1",
      role: "assistant",
      content: "",
      createdAt: new Date(),
    });
    vi.spyOn(msgQueries, "getRecentMessages").mockResolvedValue([]);
    vi.spyOn(memQueries, "getUserMemories").mockResolvedValue([]);
    vi.spyOn(usageQueries, "recordUsageEvent").mockResolvedValue({} as never);

    const req = new Request("http://localhost:3000/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "hi" }),
    });

    const res = await runTurn({
      request: req,
      input: {
        text: process.env.LIVE_INPUT || "Who became the CEO of Nvidia",
        search: true,
        effort: (process.env.LIVE_EFFORT as "low" | "standard" | "max") || "standard",
        model: "primary",
      },
    });

    console.log("status:", res.status);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
    }
    const lines = full.split("\n").filter((l) => l.startsWith("data: "));
    const parts = lines.map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return l;
      }
    });
    for (const p of parts) {
      const t = (p as { type?: string }).type;
      if (t === "text-delta") {
        process.stdout.write((p as { delta?: string }).delta ?? "");
      } else if (t === "error") {
        console.log("\n\n!!! ERROR PART:", JSON.stringify(p).slice(0, 500));
      } else {
        console.log(`\n[${t}]`, JSON.stringify(p).slice(0, 400));
      }
    }
    console.log("\n\n=== total parts:", parts.length);
    expect(res.status).toBe(200);
  }, 120_000);
});

import * as authModule from "@/lib/auth/require-user";
import * as limitersModule from "@/lib/ratelimit/limiters";
import * as convQueries from "@/lib/db/queries/conversations";
import * as msgQueries from "@/lib/db/queries/messages";
import * as memQueries from "@/lib/db/queries/memories";
import * as usageQueries from "@/lib/db/queries/usage";
import { ok } from "@/lib/errors";
