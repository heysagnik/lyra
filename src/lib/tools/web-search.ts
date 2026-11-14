import { tool } from "ai";
import { z } from "zod";
import crypto from "node:crypto";
import {
  SNIPPET_MAX_CHARS,
  SEARCH_TIMEOUT_MS,
  SEARCH_CACHE_TTL_S,
} from "@/lib/agent/budget";
import { getEnv } from "@/lib/env";
import type { SearchSource } from "@/types";

export const searchParametersSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(400)
    .optional()
    .describe("Search keywords (required, 3-6 keywords, e.g. 'neon supabase postgres pricing')"),
  q: z.string().min(1).max(400).optional(),
  keywords: z.string().min(1).max(400).optional(),
  search_query: z.string().min(1).max(400).optional(),
  recency_days: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional: prefer results newer than N days"),
});

export type SearchParameters = z.infer<typeof searchParametersSchema>;

export interface SearchExecutionResult {
  sources: SearchSource[];
  summaryText: string;
}

/**
 * Normalizes a query for per-turn dedupe and cache keys so repeated
 * searches with different casing/spacing collapse into one.
 */
export function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Structured search result for the ReAct loop: sources on success, or a
 * graceful note the model can act on (retry differently or answer from
 * knowledge) — never a thrown error.
 */
export interface StructuredSearchResult {
  sources: SearchSource[];
  note?: string;
}

/**
 * Truncates snippet at word boundary without splitting words.
 */
export function truncateSnippet(
  text: string,
  maxChars = SNIPPET_MAX_CHARS
): string {
  if (!text || text.length <= maxChars) {
    return text || "";
  }
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.7) {
    return slice.slice(0, lastSpace) + "...";
  }
  return slice + "...";
}

/**
 * Generates sha256 cache key for query and recency.
 */
export function computeSearchCacheKey(
  query: string,
  recencyDays?: number
): string {
  const normalized = `${query.trim().toLowerCase()}:${recencyDays || 0}`;
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return `search:v1:${hash}`;
}

// In-memory bounded search cache with automatic TTL pruning and LRU ceiling
const MAX_SEARCH_CACHE_ENTRIES = 500;
const localSearchCache = new Map<
  string,
  { sources: SearchSource[]; expiresAt: number }
>();

function pruneSearchCache(): void {
  const now = Date.now();
  for (const [key, val] of localSearchCache.entries()) {
    if (val.expiresAt <= now) {
      localSearchCache.delete(key);
    }
  }
  if (localSearchCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
    const oldestKey = localSearchCache.keys().next().value;
    if (oldestKey) localSearchCache.delete(oldestKey);
  }
}

async function getCachedSearch(
  cacheKey: string
): Promise<SearchSource[] | null> {
  const item = localSearchCache.get(cacheKey);
  if (item && item.expiresAt > Date.now()) {
    return item.sources;
  }
  if (item) {
    localSearchCache.delete(cacheKey);
  }
  return null;
}

async function setCachedSearch(
  cacheKey: string,
  sources: SearchSource[]
): Promise<void> {
  if (localSearchCache.size >= MAX_SEARCH_CACHE_ENTRIES) {
    pruneSearchCache();
  }
  localSearchCache.set(cacheKey, {
    sources,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_S * 1000,
  });
}

/**
 * Calls TinyFish TinySearch REST API with fixed host only (SSRF safe).
 */
async function callTinySearchApi(
  query: string,
  recencyDays?: number
): Promise<SearchSource[]> {
  const env = getEnv();
  const endpoint = new URL("https://api.search.tinyfish.ai");
  endpoint.searchParams.set("query", query);
  if (recencyDays) {
    endpoint.searchParams.set("recency_days", String(recencyDays));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        "X-API-Key": env.TINYFISH_API_KEY,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`TinySearch HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawResults = Array.isArray(data?.results) ? data.results : [];

    return rawResults.slice(0, 5).map((item: {
      title?: string;
      url?: string;
      snippet?: string;
      date?: string;
    }) => ({
      title: String(item.title || "Untitled"),
      url: String(item.url || ""),
      snippet: truncateSnippet(String(item.snippet || "")),
      date: item.date ? String(item.date) : undefined,
    }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs one query against the search API with a short backoff retry and
 * the shared LRU cache. Never throws — failures come back as a note.
 */
export async function searchWebStructured(params: {
  query: string;
  recency_days?: number;
}): Promise<StructuredSearchResult> {
  const query = params.query.trim();
  if (!query) {
    return {
      sources: [],
      note: "Tool error: Search query was empty. Please specify keywords (e.g. web_search({ query: 'hubspot pricing 2026' })).",
    };
  }

  const cacheKey = computeSearchCacheKey(query, params.recency_days);
  const cached = await getCachedSearch(cacheKey);
  if (cached && cached.length > 0) {
    return { sources: cached };
  }

  let sources: SearchSource[] = [];
  try {
    sources = await callTinySearchApi(query, params.recency_days);
  } catch (firstError) {
    // Brief backoff, then one more attempt — transient API hiccups should
    // never surface as a failed turn.
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      sources = await callTinySearchApi(query, params.recency_days);
    } catch (secondError) {
      console.error(
        JSON.stringify({
          code: "TOOL",
          msg: "Web search unavailable after retry",
          error:
            secondError instanceof Error
              ? secondError.message
              : String(secondError),
          firstError:
            firstError instanceof Error ? firstError.message : String(firstError),
          query,
        })
      );
      return {
        sources: [],
        note: "Web search is currently unavailable. Answer using your existing knowledge and briefly mention that live search could not be reached.",
      };
    }
  }

  if (sources.length === 0) {
    return {
      sources: [],
      note: "No relevant search results were found for these keywords. Try different or more specific keywords, or answer from your own knowledge.",
    };
  }

  await setCachedSearch(cacheKey, sources);
  return { sources };
}

/**
 * Event/happening terms used to (a) auto-refine vague entity queries with
 * the intent from the user's own message, and (b) detect when retrieved
 * evidence contradicts an answer that denies an asserted event.
 */
const EVENT_TERM_PHRASES = [
  "stepped down", "stepping down", "broke out", "came out", "came forward",
  "shut down", "laid off", "bought out", "spun off", "banned from",
  "kicked out", "asked to leave",
];
const EVENT_TERM_WORDS = new Set([
  "resign", "resigned", "resignation", "resigns", "quit", "fired", "sacked",
  "affair", "affairs", "scandal", "scandals", "lawsuit", "sued", "sues", "arrested", "arrest",
  "died", "death", "killed", "layoff", "layoffs", "bankrupt", "bankruptcy",
  "acquired", "acquisition", "merger", "ipo", "launched", "launch",
  "released", "release", "announced", "announcement", "pricing", "price",
  "update", "updates", "earnings", "revenue", "profit", "loss",
  "partnership", "partnership deal", "resigned amid", "controversy",
  "allegations", "accused", "rumor", "rumors", "rumour", "replaced",
  "stepped", "demoted", "promoted", "hired", "poached", "banned",
  "breach", "hacked", "outage", "recalled", "investigation",
]);

/**
 * Extracts concrete event/happening terms from free text (usually the
 * user's latest message). Returns matched phrases first, then single
 * words, deduped, most useful for query refinement.
 */
export function extractEventKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const phrase of EVENT_TERM_PHRASES) {
    if (lower.includes(phrase)) found.push(phrase);
  }
  for (const word of lower.split(/[^a-z']+/)) {
    if (EVENT_TERM_WORDS.has(word) && !found.includes(word)) found.push(word);
  }
  // Singularize so "affairs"/"scandals" match snippets that say "affair"/
  // "scandal" (substring matching downstream needs the shorter stem).
  return found
    .map((term) =>
      term.length > 3 && !term.endsWith("ss") && term.endsWith("s")
        ? term.slice(0, -1)
        : term
    )
    .filter((term, i, arr) => arr.indexOf(term) === i)
    .slice(0, 4);
}

/**
 * Heuristic: does this result look like an actual article/report about a
 * recent event (as opposed to a profile, homepage, or evergreen page)?
 * Signals: a dated result with a non-generic title whose URL path looks
 * like an article, or a snippet that reads like news.
 */
export function looksLikeNewsResult(source: SearchSource): boolean {
  const title = (source.title || "").trim();
  if (!title) return false;
  try {
    const u = new URL(source.url);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length <= 1) return false; // homepage / section root
    if (segments.length >= 3) return true; // deep article-like path
    // Shallow path: still plausible if a date is present
  } catch {
    return false;
  }
  const dated =
    !!source.date &&
    /hour|day|week|month|ago|\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(
      source.date
    );
  const titleIsSentence = title.length > 25 && /[a-z]\s+[a-z]/i.test(title);
  return dated && titleIsSentence;
}

/**
 * Orders a batch of fresh results so that event-like, dated, non-generic
 * results come FIRST and generic entity pages (homepages, profiles,
 * wikis, tickers) come LAST. Qwen-class models attend most to the top of
 * the evidence block; burying the one relevant article under five
 * profile pages is the single most common cause of confidently wrong
 * "no evidence found" answers.
 */
export function rankSourcesForEvidence(
  sources: SearchSource[],
  queryKey: string
): SearchSource[] {
  const score = (s: SearchSource): number => {
    let v = 0;
    if (looksLikeNewsResult(s)) v += 3;
    if (!isGenericEntityResult(s, queryKey)) v += 2;
    if (s.date && /hour|minute|day|ago/i.test(s.date)) v += 2;
    else if (s.date && /week|month/i.test(s.date)) v += 1;
    if (s.snippet && s.snippet.length > 80) v += 1;
    return v;
  };
  return [...sources].sort((a, b) => score(b) - score(a));
}

/**
 * Detects "generic entity page" results — bare profiles, homepages, or
 * section roots instead of articles about the event the query asked
 * about. The loop uses this to tell the model its query was too vague.
 */
export function isGenericEntityResult(
  source: SearchSource,
  queryKey: string
): boolean {
  const title = normalizeQueryKey(
    (source.title || "").replace(/\([^)]*\)/g, "")
  );
  if (!title) return true;

  // Title repeats the whole query verbatim ("Jensen Huang" for a query
  // about Jensen Huang's resignation)
  if (title === queryKey) return true;

  // Leading segment before separators is the entity itself — a profile or
  // bio page ("Jensen Huang - NVIDIA", "Sam Xia - CTO, LendAPI",
  // "Jensen Huang | NVIDIA")
  const lead = normalizeQueryKey(
    title.split(/ [-|/:] /)[0] || title
  );
  if (lead === queryKey) return true;

  // Very short titles are nav/entity labels ("Nvidia", "Home", "X")
  if (title.length <= 6) return true;

  // Site homepage or bare section root (nvidia.com/, reuters.com/tech/)
  try {
    const path = new URL(source.url).pathname.replace(/\/+$/, "");
    if (path.split("/").filter(Boolean).length <= 1) return true;
  } catch {
    return true;
  }

  return false;
}

/**
 * Formats sources for the model with global (turn-wide) numbering so
 * inline citations match the sources panel across multiple searches.
 */
export function formatSourcesForModel(
  sources: SearchSource[],
  startIndex = 0
): string {
  return sources
    .map(
      (s, index) =>
        `[${startIndex + index + 1}] ${s.title}\nURL: ${s.url}\nDate: ${s.date || "unknown"}\nSnippet: ${s.snippet}`
    )
    .join("\n\n");
}

/**
 * Search executor with retry, caching, and graceful degradation.
 */
export async function executeWebSearch(
  params: SearchParameters,
  onSourcesResolved?: (sources: SearchSource[]) => void
): Promise<string> {
  const parsed = searchParametersSchema.safeParse(params);
  if (!parsed.success) {
    return "Tool error: Invalid search query parameters. Please specify short keywords in query.";
  }

  const rawQuery =
    parsed.data.query ||
    parsed.data.q ||
    parsed.data.keywords ||
    parsed.data.search_query;

  if (!rawQuery || rawQuery.trim().length === 0) {
    return "Tool error: Search query was empty. Please specify keywords (e.g. web_search({ query: 'hubspot pricing 2026' })).";
  }

  const result = await searchWebStructured({
    query: rawQuery,
    recency_days: parsed.data.recency_days,
  });

  if (result.sources.length === 0) {
    return (
      result.note ||
      "No relevant search results were found for the query."
    );
  }

  if (onSourcesResolved) {
    onSourcesResolved(result.sources);
  }

  return formatSourcesForModel(result.sources);
}

export const webSearchTool = tool({
  description:
    "Search the live web for current information. Call it multiple times per turn with distinct, refined queries when research requires it: first to locate facts, then to verify or fill gaps.",
  inputSchema: searchParametersSchema,
  execute: async (args: SearchParameters) => executeWebSearch(args),
});
