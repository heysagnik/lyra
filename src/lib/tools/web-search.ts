import crypto from "node:crypto";
import {
  SNIPPET_MAX_CHARS,
  SEARCH_TIMEOUT_MS,
  SEARCH_CACHE_TTL_S,
} from "@/lib/agent/budget";
import { getEnv } from "@/lib/env";
import type { SearchSource } from "@/types";

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

export function computeSearchCacheKey(
  query: string,
  recencyDays?: number
): string {
  const normalized = `${query.trim().toLowerCase()}:${recencyDays || 0}`;
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  return `search:v1:${hash}`;
}

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

export function looksLikeNewsResult(source: SearchSource): boolean {
  const title = (source.title || "").trim();
  if (!title) return false;
  try {
    const u = new URL(source.url);
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length <= 1) return false; // homepage / section root
    if (segments.length >= 3) return true; // deep article-like path
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

export function isGenericEntityResult(
  source: SearchSource,
  queryKey: string
): boolean {
  const title = normalizeQueryKey(
    (source.title || "").replace(/\([^)]*\)/g, "")
  );
  if (!title) return true;

  if (title === queryKey) return true;

  const lead = normalizeQueryKey(
    title.split(/ [-|/:] /)[0] || title
  );
  if (lead === queryKey) return true;

  if (title.length <= 6) return true;

  try {
    const path = new URL(source.url).pathname.replace(/\/+$/, "");
    if (path.split("/").filter(Boolean).length <= 1) return true;
  } catch {
    return true;
  }

  return false;
}
