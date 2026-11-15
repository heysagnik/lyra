import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateObject } from "ai";
import { verifyAnswerAgainstEvidence } from "./verify";
import type { SearchSource } from "@/types";

const sources: SearchSource[] = [
  {
    title: "Jensen Huang resigns as Nvidia CEO",
    url: "https://example.com/news/1",
    snippet: "Nvidia announced today that CEO Jensen Huang has resigned.",
    date: "Nov 15, 2026",
  },
];

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@/lib/llm/provider", () => ({
  getLanguageModel: () => ({
    model: { modelId: "mock" },
    modelName: "qwen/qwen3.8-27b",
  }),
}));

describe("verifyAnswerAgainstEvidence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(generateObject).mockReset();
  });

  it("returns null without making a call when no evidence exists", async () => {
    const result = await verifyAnswerAgainstEvidence({
      modelId: "qwen/qwen3.8-27b",
      question: "did he resign?",
      executedQueries: ["jensen huang resignation"],
      sources: [],
      draftAnswer: "No evidence found.",
    });
    expect(result).toBeNull();
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns grounded verdict with usage on a clean draft", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { verdict: "grounded", problems: [] },
      usage: { inputTokens: 500, outputTokens: 40 },
    } as never);

    const result = await verifyAnswerAgainstEvidence({
      modelId: "qwen/qwen3.8-27b",
      question: "did he resign?",
      executedQueries: ["jensen huang resignation"],
      sources,
      draftAnswer: "Yes, Jensen Huang resigned as Nvidia CEO [1].",
    });

    expect(result?.verdict).toBe("grounded");
    expect(result?.problems).toEqual([]);
    expect(result?.usage?.inputTokens).toBe(500);
  });

  it("returns needs_repair with problems and instructions", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: {
        verdict: "needs_repair",
        problems: ["Draft denies the resignation reported by source [1]."],
        repair_instructions: "Rewrite the answer confirming the resignation, citing [1].",
      },
      usage: { inputTokens: 500, outputTokens: 60 },
    } as never);

    const result = await verifyAnswerAgainstEvidence({
      modelId: "qwen/qwen3.8-27b",
      question: "did he resign?",
      executedQueries: ["jensen huang resignation"],
      sources,
      draftAnswer: "There is no credible evidence he resigned.",
    });

    expect(result?.verdict).toBe("needs_repair");
    expect(result?.problems).toHaveLength(1);
    expect(result?.repairInstructions).toContain("citing [1]");
  });

  it("returns null when the judge call itself fails", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("provider down"));

    const result = await verifyAnswerAgainstEvidence({
      modelId: "qwen/qwen3.8-27b",
      question: "did he resign?",
      executedQueries: ["jensen huang resignation"],
      sources,
      draftAnswer: "No evidence found.",
    });

    expect(result).toBeNull();
  });
});
