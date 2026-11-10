import { describe, it, expect, vi } from "vitest";
import {
  truncateSnippet,
  computeSearchCacheKey,
  executeWebSearch,
  searchParametersSchema,
} from "./web-search";

describe("Web Search Tool", () => {
  it("truncates snippet at word boundary without slicing words", () => {
    const text =
      "Antigravity is an advanced agentic coding assistant developed by Google DeepMind designed to pair program with users on complex engineering tasks across distributed environments.";
    const truncated = truncateSnippet(text, 50);

    expect(truncated.endsWith("...")).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(53);
    // Does not slice in the middle of a word
    expect(truncated).not.toContain("devel...");
  });

  it("leaves text unchanged if shorter than max chars", () => {
    const shortText = "Short snippet.";
    expect(truncateSnippet(shortText, 300)).toBe("Short snippet.");
  });

  it("computes deterministic cache keys regardless of casing and whitespace", () => {
    const key1 = computeSearchCacheKey("  NextJS App Router  ", 7);
    const key2 = computeSearchCacheKey("nextjs app router", 7);
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^search:v1:[a-f0-9]{64}$/);
  });

  it("validates search parameters strictly with zod", () => {
    const valid = searchParametersSchema.safeParse({
      query: "groq pricing 2026",
      recency_days: 30,
    });
    expect(valid.success).toBe(true);

    const empty = searchParametersSchema.safeParse({ query: "" });
    expect(empty.success).toBe(false);

    const oversized = searchParametersSchema.safeParse({
      query: "a".repeat(401),
    });
    expect(oversized.success).toBe(false);
  });

  it("returns formatted results and caches subsequent searches", async () => {
    const originalFetch = global.fetch;
    const mockResults = [
      {
        title: "Groq LPU Architecture",
        url: "https://groq.com/lpu",
        snippet: "Ultra-fast inference engine for language models.",
        date: "2026-01-01",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ results: mockResults }),
    });

    try {
      const res1 = await executeWebSearch({ query: "groq lpu hardware" });
      expect(res1).toContain("[1] Groq LPU Architecture");
      expect(res1).toContain("https://groq.com/lpu");

      // Second search should be served from cache (no extra fetch)
      const fetchCountBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      const res2 = await executeWebSearch({ query: "groq lpu hardware" });
      const fetchCountAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      expect(res2).toBe(res1);
      expect(fetchCountAfter).toBe(fetchCountBefore);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
