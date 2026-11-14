import { describe, it, expect, vi } from "vitest";
import { getLanguageModel, generateSummaryWithLlm, extractMemoriesWithLlm } from "./llm";
import { z } from "zod";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({
      text: "  This is a concise summary.  ",
    }),
    generateObject: vi.fn().mockResolvedValue({
      object: {
        memories: [
          {
            kind: "preference",
            content: "User likes Python",
            confidence: 0.95,
          },
        ],
      },
    }),
  };
});

describe("LLM Adapter", () => {
  it("resolves primary model with configured model name", () => {
    const primary = getLanguageModel();
    expect(primary.modelName).toBe("nvidia/nemotron-3.5-bolt-e4b");
    expect(primary.model).toBeDefined();
  });

  it("generates summary text using model", async () => {
    const summary = await generateSummaryWithLlm("Summarize this conversation", 400);
    expect(summary).toBe("This is a concise summary.");
  });

  it("extracts structured memories using model", async () => {
    const schema = z.object({
      memories: z.array(
        z.object({
          kind: z.enum(["preference", "fact", "instruction"]),
          content: z.string(),
          confidence: z.number(),
        })
      ),
    });

    const result = await extractMemoriesWithLlm("Extract facts from this chat", schema);
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].content).toBe("User likes Python");
  });
});
