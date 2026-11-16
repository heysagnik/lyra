
export const WINDOW_MESSAGES = 10;

export const SUMMARY_MAX_TOKENS = 300;

export const SNIPPET_MAX_CHARS = 300;

export const MAX_SEARCH_QUERIES = 3;

export const MAX_SOURCES_PER_TURN = 10;

export const MAX_TOKENS_OUT = 1024;

export const EFFORT_BUDGET = {
  low: { maxTokensOut: 512 },
  standard: { maxTokensOut: MAX_TOKENS_OUT },
  max: { maxTokensOut: 4096 },
} as const;

export type Effort = keyof typeof EFFORT_BUDGET;

export const SEARCH_CACHE_TTL_S = 300;

export const SEARCH_TIMEOUT_MS = 8000;

export const RATE_PER_MIN = 20;

export type PlanTier = "free" | "pro";

export const PLAN_DAILY_RATE: Record<PlanTier, number> = {
  free: 20,
  pro: 300,
};

export function resolveDailyRate(plan?: string | null): number {
  return PLAN_DAILY_RATE[(plan as PlanTier) in PLAN_DAILY_RATE ? (plan as PlanTier) : "free"];
}

export const MAX_INFLIGHT = 2;

export const MODEL_PRICING: Record<string, { inPer1M: number; outPer1M: number }> = {
  default: { inPer1M: 0.05, outPer1M: 0.20 },
};

export function calculateTurnCostUsd(
  model?: string,
  tokensIn = 0,
  tokensOut = 0
): string {
  const rates = (model && MODEL_PRICING[model]) || MODEL_PRICING.default;
  const cost =
    (tokensIn / 1_000_000) * rates.inPer1M + (tokensOut / 1_000_000) * rates.outPer1M;
  return cost.toFixed(6);
}
