import { searchWebStructured, normalizeQueryKey } from "@/lib/tools/web-search";
import { MAX_SOURCES_PER_TURN } from "./budget";
import type { ResearchPlan } from "./planner";
import type { SearchSource } from "@/types";

export interface ResearchResult {
  sources: SearchSource[];
  executedQueries: string[];
  notes: string[];
}

/**
 * Run every planned query in parallel and merge the results. Provider order is
 * kept (interleaved across queries so each query contributes its best hits);
 * the harness does not guess which results are "real articles".
 */
export async function runResearch(plan: ResearchPlan): Promise<ResearchResult> {
  const unique = new Map<string, string>();
  for (const q of plan.queries) unique.set(normalizeQueryKey(q), q);
  const queries = [...unique.values()];

  const settled = await Promise.all(
    queries.map(async (query) => {
      try {
        const r = await searchWebStructured({ query, recency_days: plan.recencyDays });
        return { query, sources: r.sources, note: r.note };
      } catch {
        return { query, sources: [] as SearchSource[], note: undefined };
      }
    })
  );

  const notes = settled.filter((r) => r.sources.length === 0 && r.note).map((r) => r.note as string);

  const seen = new Set<string>();
  const merged: SearchSource[] = [];
  const longest = Math.max(0, ...settled.map((r) => r.sources.length));
  for (let i = 0; i < longest; i++) {
    for (const { sources } of settled) {
      const source = sources[i];
      if (!source?.url || seen.has(source.url)) continue;
      seen.add(source.url);
      merged.push(source);
    }
  }

  return {
    sources: merged.slice(0, MAX_SOURCES_PER_TURN),
    executedQueries: settled.map((r) => r.query),
    notes,
  };
}
