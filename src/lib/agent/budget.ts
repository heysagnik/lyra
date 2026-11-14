/**
 * System-wide budget and rate limit constants as specified in AGENT.md.
 * All memory, tool loop, search compaction, and rate limits are defined here.
 */

/** Number of verbatim messages kept in T3 sliding window */
export const WINDOW_MESSAGES = 10;

/** Maximum token count for conversation summary in T2 tier */
export const SUMMARY_MAX_TOKENS = 300;

/** Maximum character length for search result snippet before word-boundary truncation in T4 */
export const SNIPPET_MAX_CHARS = 300;

/** Maximum web_search calls per turn before the model must answer from evidence */
export const MAX_SEARCH_CALLS_PER_TURN = 5;

/** Maximum unique sources retained across all searches in one turn */
export const MAX_SOURCES_PER_TURN = 10;

/** Maximum output tokens generation cap for LLM responses (standard effort) */
export const MAX_TOKENS_OUT = 1024;

/**
 * Per-turn effort tiers: generation-step budget (each step may think,
 * call web_search, or answer — the ReAct loop) and output token ceiling.
 */
export const EFFORT_BUDGET = {
  low: { iterations: 2, maxTokensOut: 512 },
  standard: { iterations: 4, maxTokensOut: MAX_TOKENS_OUT },
  max: { iterations: 6, maxTokensOut: 4096 },
} as const;

export type Effort = keyof typeof EFFORT_BUDGET;

export const SEARCH_CACHE_TTL_S = 300;

export const SEARCH_TIMEOUT_MS = 8000;

export const RATE_PER_MIN = 20;

/** Daily turn quota per plan tier. */
export type PlanTier = "free" | "pro";

export const PLAN_DAILY_RATE: Record<PlanTier, number> = {
  free: 20,
  pro: 300,
};

/** Daily quota for a plan tier (falls back to the free tier). */
export function resolveDailyRate(plan?: string | null): number {
  return PLAN_DAILY_RATE[(plan as PlanTier) in PLAN_DAILY_RATE ? (plan as PlanTier) : "free"];
}

/** Free-tier default, kept for existing call sites and tests. */
export const RATE_PER_DAY = PLAN_DAILY_RATE.free;

/**
 * Groq free-tier Output Tokens Per Minute (OTPM) ceilings per model, per
 * API key (account-wide, shared across all users of the app). Turns are
 * gated against a rolling 60s window so bursts cannot exhaust the quota
 * mid-answer and leave turns silently dead.
 */
export const MODEL_OTPM_LIMITS: Record<string, number> = {
  "qwen/qwen3.8-27b": 1000,
};

/** Safety margin subtracted from the OTPM ceiling before gating */
export const OTPM_SAFETY_MARGIN = 100;

/** How long an in-flight turn's reservation is held before auto-expiry */
export const OTPM_RESERVATION_TTL_MS = 120_000;

export const MAX_INFLIGHT = 2;

export const TARGET_PROMPT_TOKENS = 2600;


export const MODEL_PRICING: Record<string, { inPer1M: number; outPer1M: number }> = {
  default: { inPer1M: 0.05, outPer1M: 0.20 },
  "qwen/qwen3.8-27b": { inPer1M: 0.05, outPer1M: 0.20 },
  "openai/gpt-oss-20b": { inPer1M: 0.10, outPer1M: 0.30 },
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
