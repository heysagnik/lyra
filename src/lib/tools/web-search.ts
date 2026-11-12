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

  const query = rawQuery.trim();
  const { recency_days } = parsed.data;
  const cacheKey = computeSearchCacheKey(query, recency_days);

  const cached = await getCachedSearch(cacheKey);
  if (cached && cached.length > 0) {
    if (onSourcesResolved) onSourcesResolved(cached);
    return formatSourcesForModel(cached);
  }

  let sources: SearchSource[] = [];
  try {
    sources = await callTinySearchApi(query, recency_days);
  } catch {
    try {
      sources = await callTinySearchApi(query, recency_days);
    } catch {
      return "Web search is currently unavailable. Please answer using your existing knowledge and mention that search could not be reached.";
    }
  }

  if (sources.length === 0) {
    return "No relevant search results were found for the query.";
  }

  await setCachedSearch(cacheKey, sources);
  if (onSourcesResolved) {
    onSourcesResolved(sources);
  }

  return formatSourcesForModel(sources);
}

function formatSourcesForModel(sources: SearchSource[]): string {
  return sources
    .map(
      (s, index) =>
        `[${index + 1}] ${s.title}\nURL: ${s.url}\nDate: ${s.date || "unknown"}\nSnippet: ${s.snippet}`
    )
    .join("\n\n");
}

export const webSearchTool = tool({
  description:
    "Search the live web for current information. Use for anything time-sensitive, factual, or outside your training data.",
  inputSchema: searchParametersSchema,
  execute: async (args: SearchParameters) => executeWebSearch(args),
});
