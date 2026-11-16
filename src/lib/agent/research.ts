import {
  searchWebStructured,
  rankSourcesForEvidence,
  isGenericEntityResult,
  normalizeQueryKey,
} from "@/lib/tools/web-search";
import { MAX_SOURCES_PER_TURN } from "./budget";
import type { ResearchPlan } from "./planner";
import type { SearchSource } from "@/types";

export interface ResearchResult {
  sources: SearchSource[];
  executedQueries: string[];
  notes: string[];
}

export async function runResearch(plan: ResearchPlan): Promise<ResearchResult> {
  const keys = new Map<string, string>();
  for (const q of plan.queries) keys.set(normalizeQueryKey(q), q);
  const queries = [...keys.values()];

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

  const seen = new Set<string>();
  const ranked: SearchSource[] = [];
  const notes: string[] = [];
  for (const { query, sources, note } of settled) {
    if (note && sources.length === 0) notes.push(note);
    const unique = sources.filter((s) => {
      if (!s.url || seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
    const key = normalizeQueryKey(query);
    const specific = unique.filter((s) => !isGenericEntityResult(s, key));
    const kept = specific.length >= 3 ? specific : unique;
    ranked.push(...rankSourcesForEvidence(kept, key));
  }

  return {
    sources: ranked.slice(0, MAX_SOURCES_PER_TURN),
    executedQueries: settled.map((s) => s.query),
    notes,
  };
}
