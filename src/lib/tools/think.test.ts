import { describe, it, expect } from "vitest";
import { thinkTool, thinkParametersSchema } from "./think";

describe("think tool", () => {
  it("exposes a structured schema with analysis, questions, plan, reflection", () => {
    const schema = thinkParametersSchema;
    expect(schema.shape.situation_analysis).toBeDefined();
    expect(schema.shape.open_questions).toBeDefined();
    expect(schema.shape.plan).toBeDefined();
    expect(schema.shape.reflection).toBeDefined();
  });

  it("requires a non-empty plan", () => {
    const parsed = thinkParametersSchema.safeParse({
      situation_analysis: "User asks about pricing",
      open_questions: ["current price?"],
      plan: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid plan and reflection is optional", () => {
    const parsed = thinkParametersSchema.safeParse({
      situation_analysis: "User asks about pricing",
      open_questions: ["current price?"],
      plan: ["search 'tool pricing 2026'", "answer directly"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.reflection).toBeUndefined();
    }
  });

  it("execute confirms the plan and instructs the next step", async () => {
    const execute = thinkTool.execute as unknown as (
      args: unknown
    ) => Promise<string>;
    const result = await execute({
      situation_analysis: "User asks about pricing",
      open_questions: ["current price?"],
      plan: ["search 'tool pricing 2026'"],
    });
    expect(result).toContain("Plan recorded (1 step), 1 open question.");
    expect(result).toContain("execute the first planned step");
  });

  it("execute with reflection nudges reflection-to-answer transition", async () => {
    const execute = thinkTool.execute as unknown as (
      args: unknown
    ) => Promise<string>;
    const result = await execute({
      situation_analysis: "User asks about pricing",
      open_questions: [],
      plan: ["write final answer"],
      reflection: "Evidence [1] answers the question fully.",
    });
    expect(result).toContain("Reflection noted");
    expect(result).toContain("Never repeat an identical query");
  });
});
