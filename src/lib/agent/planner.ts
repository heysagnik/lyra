import { generateText } from "ai";
import { getLanguageModel } from "@/lib/llm/provider";
import { MAX_SEARCH_QUERIES } from "./budget";

export interface ResearchPlan {
  queries: string[];
  recencyDays?: number;
}

type HistoryMessage = { role: "user" | "assistant"; content: string };

/**
 * Parse the planner's reply: `NONE` means no web search; otherwise "QUERY n:"
 * lines. Any query line wins over a stray NONE. Returns null when the reply is
 * neither, so the caller can fall back. Low-end models are unreliable at JSON
 * and tool schemas but follow simple line formats well.
 */
export function parsePlan(raw: string): ResearchPlan | null {
  const queries: string[] = [];
  for (const line of raw.split("\n")) {
    const m = line.trim().match(/^(?:query\s*\d*|q\d*|-|\d+[.)])\s*:?\s*(.+)$/i);
    if (!m) continue;
    const query = m[1].replace(/^["'`]+|["'`]+$/g, "").trim();
    if (query.length >= 3 && query.length <= 120 && !query.startsWith("<") && !queries.includes(query)) {
      queries.push(query);
    }
  }
  if (queries.length === 0) return /^\W*none\b/i.test(raw.trim()) ? { queries: [] } : null;

  const recency = Number(raw.match(/recency\s*:\s*(\d{1,3})/i)?.[1]);
  return {
    queries: queries.slice(0, MAX_SEARCH_QUERIES),
    recencyDays: recency > 0 ? Math.min(365, recency) : undefined,
  };
}

/** Used only when the planner call fails or is unparsable: search on the user's own words. */
function fallbackQuery(question: string, history: HistoryMessage[]): string {
  const clean = (t: string) => t.replace(/^\[[^\]]*\]\s*/, "").replace(/\s+/g, " ").trim();
  const q = clean(question);
  if (q.split(" ").length >= 3) return q.slice(0, 200);
  const previous = [...history].reverse().find((m) => m.role === "user");
  return (previous ? `${clean(previous.content)} ${q}` : q).slice(0, 200);
}

/**
 * The model decides whether a message needs the web. It replies `NONE` or a
 * list of queries. Failure to decide defaults to searching, since a missed
 * search is worse than a wasted one.
 */
export async function planResearch(opts: {
  question: string;
  history: HistoryMessage[];
  modelId: string;
}): Promise<ResearchPlan> {
  const { question, history, modelId } = opts;

  const recent = history
    .slice(-4)
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join("\n");
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    const { model } = getLanguageModel(modelId);
    const { text } = await generateText({
      model,
      temperature: 0,
      maxOutputTokens: 120,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(6000),
      prompt: [
        "Decide if the LAST user message needs fresh facts from the web.",
        "Needs web: news, events, dates, prices, scores, weather, versions, who currently holds a role, anything that changes or you may not know.",
        "No web needed: greetings, thanks, math, coding help, writing or rewriting text, explaining stable concepts, chit-chat.",
        `Today is ${today}.`,
        "",
        "If NO web is needed, reply with exactly: NONE",
        "If web IS needed, reply with search queries in exactly this format:",
        "QUERY 1: <keyword query: entity + event/intent, dates in full, no pronouns>",
        "QUERY 2: <optional, only if the question has two parts>",
        "RECENCY: <days, only for recent news>",
        'If the last message is a short command like "search" or "try again", use the previous user question.',
        "",
        recent ? `CONVERSATION:\n${recent}\n` : "",
        `LAST USER MESSAGE: ${question.slice(0, 500)}`,
      ].join("\n"),
    });
    const plan = parsePlan(text);
    if (plan) return plan;
  } catch {}

  return { queries: [fallbackQuery(question, history)] };
}
