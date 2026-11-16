import { generateText } from "ai";
import { getLanguageModel } from "@/lib/llm/provider";
import type { SearchSource } from "@/types";

export interface AnswerCheck {
  text: string;
  problems: string[];
}

const FULLWIDTH_CITATION = /[【\[]?(\d+)†[^】\]]*[】\]]|【(\d+)】/g;

/**
 * Checks that only use facts the harness knows: output text, finish reason and
 * citation markers. Citation fixes are syntax (rewrite `【7†L1】` to `[7]`,
 * drop markers pointing at no source), not judgements about meaning.
 */
export function checkAnswer(raw: string, sourceCount: number, truncated = false): AnswerCheck {
  let text = raw.replace(FULLWIDTH_CITATION, (_m, a, b) => `[${a ?? b}]`);

  text =
    sourceCount === 0
      ? text.replace(/\s?\[\d+\]/g, "")
      : text.replace(/\s?\[(\d+)\]/g, (m, n) => (Number(n) >= 1 && Number(n) <= sourceCount ? m : ""));

  const problems: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) problems.push("The answer was empty.");
  else {
    if (sourceCount > 0 && !/\[\d+\]/.test(trimmed)) {
      problems.push("No claim cites the numbered evidence with [n].");
    }
    if (truncated) problems.push("The answer was cut off; give a shorter complete answer.");
  }
  return { text, problems };
}

/**
 * Semantic check, done by the model rather than by pattern matching: does the
 * answer actually use the evidence? Asks for one word so even a small model can
 * answer it; any failure or unclear reply counts as grounded so the check can
 * never block a turn.
 */
export async function judgeGrounding(opts: {
  modelId: string;
  question: string;
  answer: string;
  sources: SearchSource[];
}): Promise<string | null> {
  const evidence = opts.sources
    .map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`)
    .join("\n")
    .slice(0, 3500);
  try {
    const { model } = getLanguageModel(opts.modelId);
    const { text } = await generateText({
      model,
      temperature: 0,
      maxOutputTokens: 8,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(8000),
      prompt: [
        `QUESTION: ${opts.question.slice(0, 300)}`,
        `EVIDENCE:\n${evidence}`,
        `ANSWER:\n${opts.answer.slice(0, 1500)}`,
        "",
        "Does the ANSWER use facts from the EVIDENCE (or correctly say the evidence lacks them), instead of ignoring it or contradicting it?",
        "Reply with exactly one word: GROUNDED or UNGROUNDED.",
      ].join("\n"),
    });
    return /\bUNGROUNDED\b/i.test(text)
      ? "The answer ignores or contradicts the numbered evidence; base it on the evidence and cite [n]."
      : null;
  } catch {
    return null;
  }
}
