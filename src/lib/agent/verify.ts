import { generateObject } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/llm/provider";
import { VERIFY_MAX_TOKENS_OUT } from "./budget";
import type { SearchSource } from "@/types";

/**
 * Evaluator-optimizer verification pass (LLM-as-judge).
 *
 * After the ReAct loop produces a draft answer grounded in retrieved
 * evidence, a structured judge checks it against the evidence ledger:
 * does every external claim carry a citation, is the user's actual
 * question answered, and — the worst observed failure mode — does the
 * draft deny an event that a retrieved source explicitly reports?
 *
 * A free-text critique is unreliable; a Zod-constrained verdict is not.
 * The judge never repairs the answer itself: it emits precise,
 * actionable repair instructions for one bounded repair generation.
 */

const verificationSchema = z.object({
  verdict: z.enum(["grounded", "needs_repair"]),
  problems: z
    .array(z.string())
    .max(4)
    .describe(
      "Each concrete defect found: an unsupported or uncited claim, an unanswered part of the question, a denial contradicted by a numbered source (name the source), or a draft that is narration/intent instead of an answer. Empty when grounded."
    ),
  repair_instructions: z
    .string()
    .optional()
    .describe(
      "When verdict is needs_repair: precise instructions for writing the complete corrected answer, referencing the numbered evidence."
    ),
});

export type VerificationVerdict = z.infer<typeof verificationSchema>;

export interface VerifyAnswerInput {
  /** The model id used for the turn (also used for the judge). */
  modelId: string;
  /** The user's latest message. */
  question: string;
  /** Queries executed this turn. */
  executedQueries: string[];
  /** The turn-wide evidence ledger. */
  sources: SearchSource[];
  /** The draft answer produced by the ReAct loop. */
  draftAnswer: string;
}

export interface VerifyAnswerResult {
  verdict: "grounded" | "needs_repair";
  problems: string[];
  repairInstructions?: string;
  /** Token usage of the judge pass itself, for accurate turn accounting. */
  usage?: { inputTokens?: number; outputTokens?: number };
}

function formatEvidenceForJudge(sources: SearchSource[]): string {
  return sources
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}${s.date ? ` (${s.date})` : ""}\n${s.url}\n${s.snippet}`
    )
    .join("\n\n");
}

/**
 * Judge the draft answer against the evidence. Returns null when the
 * judge itself fails (timeout, provider error, schema mismatch) — the
 * turn must never die because the verifier did.
 */
export async function verifyAnswerAgainstEvidence(
  input: VerifyAnswerInput
): Promise<VerifyAnswerResult | null> {
  if (input.sources.length === 0) return null;

  const { model } = getLanguageModel(input.modelId);

  try {
    const res = await generateObject({
      model,
      schema: verificationSchema,
      maxOutputTokens: VERIFY_MAX_TOKENS_OUT,
      prompt: [
        "You are a strict answer verifier. Compare the DRAFT ANSWER against the numbered EVIDENCE and the user's QUESTION.",
        "",
        `QUESTION: ${input.question}`,
        "",
        `SEARCHES EXECUTED: ${input.executedQueries.map((q) => `"${q}"`).join(", ") || "none"}`,
        "",
        `EVIDENCE:\n${formatEvidenceForJudge(input.sources)}`,
        "",
        `DRAFT ANSWER:\n${input.draftAnswer}`,
        "",
        "Verdict rules:",
        "- grounded: the draft answers the question, external claims carry [n] citations matching the evidence, and nothing in the draft is contradicted by the evidence.",
        "- needs_repair if ANY of: (a) the question is not actually answered; (b) external facts lack citations or contradict the evidence; (c) the draft denies an event or fact that a numbered source's title or snippet explicitly reports; (d) the draft is intent narration (\"let me check...\" style) rather than an answer; (e) the draft is empty or truncated mid-sentence.",
        "Be decisive: only flag problems that materially affect the answer's correctness or completeness. Formatting-only issues are not defects.",
      ].join("\n"),
    });

    if (res.object.verdict === "needs_repair") {
      return {
        verdict: "needs_repair",
        problems: res.object.problems,
        repairInstructions: res.object.repair_instructions,
        usage: {
          inputTokens: res.usage.inputTokens,
          outputTokens: res.usage.outputTokens,
        },
      };
    }
    return {
      verdict: "grounded",
      problems: [],
      usage: {
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
      },
    };
  } catch {
    return null;
  }
}
