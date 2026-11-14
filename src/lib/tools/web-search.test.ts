import { describe, it, expect, vi } from "vitest";
import {
  truncateSnippet,
  computeSearchCacheKey,
  executeWebSearch,
  isGenericEntityResult,
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

  it("flags generic entity pages, profiles, and homepages as vague-query results", () => {
    expect(
      isGenericEntityResult(
        { title: "Jensen Huang", url: "https://nvidia.com/en-us/people/jensen-huang/", snippet: "" },
        "jensen huang"
      )
    ).toBe(true);
    expect(
      isGenericEntityResult(
        { title: "Jensen Huang - NVIDIA", url: "https://nvidia.com/bio", snippet: "" },
        "jensen huang"
      )
    ).toBe(true);
    expect(
      isGenericEntityResult(
        { title: "Sam Xia - CTO, LendAPI", url: "https://linkedin.com/in/samxia", snippet: "" },
        "sam xia"
      )
    ).toBe(true);
    expect(
      isGenericEntityResult(
        { title: "NVIDIA: World Leader in Artificial Intelligence Computing", url: "https://nvidia.com/", snippet: "" },
        "nvidia ceo scandal"
      )
    ).toBe(true);
    expect(
      isGenericEntityResult(
        { title: "Nvidia", url: "https://en.wikipedia.org/wiki/Nvidia", snippet: "" },
        "nvidia ceo"
      )
    ).toBe(true);
    expect(
      isGenericEntityResult(
        { title: "Nvidia", url: "https://x.com/nvidia", snippet: "" },
        "nvidia ceo scandal"
      )
    ).toBe(true);
  });

  it("does not flag real event articles as generic", () => {
    expect(
      isGenericEntityResult(
        {
          title: "Jensen Huang denies resignation rumors at GTC keynote",
          url: "https://www.reuters.com/technology/jensen-huang-denies-rumors-2026-11-13/",
          snippet: "",
        },
        "jensen huang resignation rumor"
      )
    ).toBe(false);
    expect(
      isGenericEntityResult(
        {
          title: "How the Jensen Huang scandal exposed a headache for the board",
          url: "https://www.ft.com/article/xyz",
          snippet: "",
        },
        "jensen huang scandal"
      )
    ).toBe(false);
  });
});

describe("Evidence ranking and event keyword extraction", () => {
  it("extracts event keywords from a user message", async () => {
    const { extractEventKeywords } = await import("./web-search");
    expect(extractEventKeywords("He resigned yesterday I guess")).toContain(
      "resigned"
    );
    expect(
      extractEventKeywords("The scandal that came out related to him the affairs")
    ).toEqual(expect.arrayContaining(["scandal", "affair", "came out"]));
    expect(extractEventKeywords("hello there")).toEqual([]);
  });

  it("flags news-like results and ranks them above generic pages", async () => {
    const { rankSourcesForEvidence, looksLikeNewsResult } = await import(
      "./web-search"
    );
    const wiki = {
      title: "Jensen Huang",
      url: "https://en.wikipedia.org/wiki/Jensen_Huang",
      snippet: "Jen-Hsun Huang is an electrical engineer.",
    };
    const bbc = {
      title: "How the Jensen Huang scandal exposed a headache for boards",
      url: "https://www.bbc.com/news/articles/ck1exevgql4qo",
      date: "7 hours ago",
      snippet:
        "On Thursday, Huang stepped down from the US chip giant after admitting he had an affair with a woman named Alice Murphy.",
    };
    const home = {
      title: "NVIDIA: World Leader in AI Computing",
      url: "https://www.nvidia.com/en-us/",
      snippet: "NVIDIA invents the GPU.",
    };
    expect(looksLikeNewsResult(bbc)).toBe(true);
    expect(looksLikeNewsResult(wiki)).toBe(false);
    expect(looksLikeNewsResult(home)).toBe(false);

    const ranked = rankSourcesForEvidence(
      [wiki, home, bbc],
      "jensen huang scandal"
    );
    expect(ranked[0]).toEqual(bbc);
    expect(ranked[ranked.length - 1]).toEqual(home);
  });
});
