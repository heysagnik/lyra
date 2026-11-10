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

/** Maximum output tokens generation cap for LLM responses */
export const MAX_TOKENS_OUT = 1024;

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
