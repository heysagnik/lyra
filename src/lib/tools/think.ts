import { tool } from "ai";
import { z } from "zod";

/**
 * Structured reasoning scratchpad (the "think" tool pattern from
 * Anthropic's agent engineering guidance, combined with ReAct's
 * explicit reasoning steps and plan-first research).
 *
 * The model is forced (via prepareStep) to open every search-enabled
 * turn with a think call, producing an explicit research plan instead
 * of silently deciding. It is also the reflection step between
 * searches: the model records whether the evidence so far answers the
 * open questions before deciding to search again or to answer.
 *
 * The tool performs no side effects and returns no new information —
 * its value is the structured reasoning itself.
 */

export const thinkParametersSchema = z.object({
  situation_analysis: z
    .string()
    .describe(
      "One or two sentences: what is the user really asking, and what kind of answer do they need?"
    ),
  open_questions: z
    .array(z.string())
    .describe(
      "The specific questions that must be answered. Empty if none require live information."
    ),
  plan: z
    .array(z.string())
    .min(1)
    .describe(
      "Ordered next steps. Each step is a concrete action: a search query to run (with its keywords), or 'answer directly' when no search is needed, or 'write final answer' when evidence is sufficient."
    ),
  reflection: z
    .string()
    .optional()
    .describe(
      "After search results: do the retrieved sources answer every open question? What is still missing or contradictory? Required before deciding to search again."
    ),
});

export type ThinkParameters = z.infer<typeof thinkParametersSchema>;

export const thinkTool = tool({
  description:
    "Structured reasoning scratchpad. MANDATORY as your first action of every turn: use it to analyze the question and plan before doing anything else. Also use it after each web_search to reflect on whether the evidence answers every open question. The tool returns no new information — it only structures your reasoning. Never substitute it for the final answer, and never narrate intent in visible text: the plan lives here.",
  inputSchema: thinkParametersSchema,
  execute: async (args: ThinkParameters) => {
    const remaining = args.open_questions.length;
    const head = `Plan recorded (${args.plan.length} step${args.plan.length === 1 ? "" : "s"})${
      remaining > 0 ? `, ${remaining} open question${remaining === 1 ? "" : "s"}` : ""
    }.`;
    if (args.reflection && args.reflection.trim().length > 0) {
      return `${head} Reflection noted. Continue: run the next planned step, or — if the evidence resolves every open question — write the final answer now. Never repeat an identical query.`;
    }
    return `${head} Continue: execute the first planned step, or write the final answer directly if no live information is needed.`;
  },
});
