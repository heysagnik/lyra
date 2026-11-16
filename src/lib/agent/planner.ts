import { generateText } from "ai";
import { getLanguageModel } from "@/lib/llm/provider";
import { MAX_SEARCH_QUERIES } from "./budget";

export interface ResearchPlan {
  queries: string[];
  recencyDays?: number;
}

const NO_SEARCH_PATTERNS: RegExp[] = [
  /^\s*(hi|hello|hey|thanks|thank you|ok|okay|cool|yo)\b[\s!.?]*$/i,
  /```/,
  /^\s*[\d\s+\-*/().^%=]+\??\s*$/,
  /^\s*(please\s+)?(write|draft|rewrite|translate|summari[sz]e|proofread|refactor|debug)\b/i,
];

const FRESHNESS_PATTERN =
  /\b(today|yesterday|tonight|latest|recent|recently|current|currently|now|news|price|pricing|score|weather|release[ds]?|launch(ed)?|update[ds]?|20(2[4-9]|3\d)|this (week|month|year)|who (is|won)|is .* still)\b/i;

export function skipsSearch(text: string): boolean {
  return NO_SEARCH_PATTERNS.some((p) => p.test(text));
}

function heuristicPlan(question: string): ResearchPlan {
  const q = question.replace(/\s+/g, " ").trim().slice(0, 200);
  return {
    queries: [q],
    recencyDays: /\b(today|yesterday|tonight|news|latest|breaking)\b/i.test(q) ? 7 : undefined,
  };
}

export function parsePlan(raw: string): ResearchPlan | null {
  const lines = raw.split("\n").map((l) => l.trim());
  const searchLine = lines.find((l) => /^search\s*:/i.test(l));
  if (searchLine && /:\s*no\b/i.test(searchLine)) return { queries: [] };

  const queries: string[] = [];
  for (const l of lines) {
    const m = l.match(/^(?:query\s*\d*|q\d*|-|\d+[.)])\s*:?\s*(.+)$/i);
    if (!m) continue;
    const query = m[1].replace(/^["'`]+|["'`]+$/g, "").trim();
    if (query.length >= 3 && query.length <= 120 && !queries.includes(query)) {
      queries.push(query);
    }
  }
  if (queries.length === 0) return null;

  const recency = raw.match(/recency\s*:\s*(\d{1,3})/i);
  return {
    queries: queries.slice(0, MAX_SEARCH_QUERIES),
    recencyDays: recency ? Math.min(365, Number(recency[1])) : undefined,
  };
}

export async function planResearch(opts: {
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  modelId: string;
}): Promise<ResearchPlan> {
  const { question, history, modelId } = opts;
  if (skipsSearch(question)) return { queries: [] };

  const fallback = FRESHNESS_PATTERN.test(question) ? heuristicPlan(question) : null;

  const recent = history
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join("\n");

  try {
    const { model } = getLanguageModel(modelId);
    const { text } = await generateText({
      model,
      temperature: 0,
      maxOutputTokens: 120,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(6000),
      prompt: [
        "Decide whether answering the LAST user message needs a live web search.",
        "Search for: recent events, prices, versions, people/companies in the news, anything that changes over time.",
        "Do not search for: math, coding, writing, definitions, stable well-known facts.",
        "Reply in EXACTLY this format and nothing else:",
        "SEARCH: yes or no",
        `QUERY 1: <standalone keyword query: entity + event/intent, no pronouns>`,
        `QUERY 2: <optional second angle, only if the question has two parts>`,
        "RECENCY: <days, only if the question is about recent news>",
        "",
        recent ? `CONVERSATION:\n${recent}\n` : "",
        `LAST USER MESSAGE: ${question.slice(0, 500)}`,
      ].join("\n"),
    });
    const plan = parsePlan(text);
    if (plan) return plan;
  } catch {}

  return fallback ?? { queries: [] };
}
