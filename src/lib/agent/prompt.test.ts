import { describe, it, expect } from "vitest";
import { assembleSystemPrompt, SYSTEM_PROMPT_T0 } from "./prompt";
import type { Memory } from "@/types";

describe("Prompt Assembly", () => {
  it("includes exact T0 system prompt", () => {
    const prompt = assembleSystemPrompt([], null);
    expect(prompt).toContain(
      "You are Aria, a helpful, direct assistant with access to live web search."
    );
    expect(prompt).toContain("Rules:");
  });

  it("assembles in deliberate cache-friendly order: T0 -> T1 -> T2", () => {
    const mockMemories: Memory[] = [
      {
        id: "m1",
        userId: "u1",
        kind: "preference",
        content: "Prefers Python 3.12 syntax",
        confidence: 0.9,
        contentHash: "hash1",
        createdAt: new Date(),
      },
      {
        id: "m2",
        userId: "u1",
        kind: "fact",
        content: "Lives in San Francisco",
        confidence: 0.8,
        contentHash: "hash2",
        createdAt: new Date(),
      },
    ];
    const summary = "User discussed building a database backup script.";

    const prompt = assembleSystemPrompt(mockMemories, summary);

    const t0Index = prompt.indexOf(SYSTEM_PROMPT_T0);
    const t1Index = prompt.indexOf("USER MEMORY:");
    const t2Index = prompt.indexOf("CONVERSATION SUMMARY:");

    expect(t0Index).toBe(0);
    expect(t1Index).toBeGreaterThan(t0Index);
    expect(t2Index).toBeGreaterThan(t1Index);

    expect(prompt).toContain("- [preference] Prefers Python 3.12 syntax");
    expect(prompt).toContain("- [fact] Lives in San Francisco");
    expect(prompt).toContain(summary);
  });

  it("omits T1 and T2 blocks cleanly when empty", () => {
    const prompt = assembleSystemPrompt([], null);
    expect(prompt).not.toContain("USER MEMORY:");
    expect(prompt).not.toContain("CONVERSATION SUMMARY:");
  });
});
