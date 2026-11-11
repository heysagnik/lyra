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

/** Maximum tool call iterations per turn before forcing text output */
export const TOOL_MAX_ITERATIONS = 2;

/** Maximum output tokens generation cap for LLM responses (standard effort) */
export const MAX_TOKENS_OUT = 1024;

/** Per-turn effort tiers: tool-loop iterations and output token ceiling */
export const EFFORT_BUDGET = {
  low: { iterations: 1, maxTokensOut: 512 },
  standard: { iterations: TOOL_MAX_ITERATIONS, maxTokensOut: MAX_TOKENS_OUT },
  max: { iterations: 4, maxTokensOut: 2048 },
} as const;

export type Effort = keyof typeof EFFORT_BUDGET;

/** Redis search result cache TTL in seconds (5 minutes) */
export const SEARCH_CACHE_TTL_S = 300;

/** Timeout in milliseconds for TinySearch API calls */
export const SEARCH_TIMEOUT_MS = 8000;

/** Rate limit: maximum user requests per minute */
export const RATE_PER_MIN = 20;

/** Rate limit: maximum user requests per day */
export const RATE_PER_DAY = 300;

/** Rate limit: maximum concurrent in-flight requests per user */
export const MAX_INFLIGHT = 2;

/** Total expected prompt tokens ceiling across T0-T4 tiers (~2.6k tokens) */
export const TARGET_PROMPT_TOKENS = 2600;

/**
 * Model pricing per 1,000,000 tokens (USD).
 */
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
