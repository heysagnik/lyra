import { describe, it, expect } from "vitest";
import {
  WINDOW_MESSAGES,
  SUMMARY_MAX_TOKENS,
  SNIPPET_MAX_CHARS,
  MAX_SEARCH_CALLS_PER_TURN,
  MAX_SOURCES_PER_TURN,
  EFFORT_BUDGET,
  MAX_TOKENS_OUT,
  SEARCH_CACHE_TTL_S,
  SEARCH_TIMEOUT_MS,
  RATE_PER_MIN,
  RATE_PER_DAY,
  PLAN_DAILY_RATE,
  resolveDailyRate,
  MAX_INFLIGHT,
  TARGET_PROMPT_TOKENS,
} from "./budget";

describe("System Budgets & Limits", () => {
  it("defines memory and token budgets according to AGENT.md", () => {
    expect(WINDOW_MESSAGES).toBe(10);
    expect(SUMMARY_MAX_TOKENS).toBe(300);
    expect(SNIPPET_MAX_CHARS).toBe(300);
    expect(MAX_TOKENS_OUT).toBe(1024);
    expect(TARGET_PROMPT_TOKENS).toBe(2600);
  });

  it("defines the ReAct tool-loop budget per effort tier", () => {
    expect(MAX_SEARCH_CALLS_PER_TURN).toBe(5);
    expect(MAX_SOURCES_PER_TURN).toBe(10);
    expect(EFFORT_BUDGET.low.iterations).toBe(2);
    expect(EFFORT_BUDGET.standard.iterations).toBe(4);
    expect(EFFORT_BUDGET.max.iterations).toBe(6);
    expect(EFFORT_BUDGET.standard.maxTokensOut).toBe(MAX_TOKENS_OUT);
  });

  it("defines search and rate limits according to AGENT.md", () => {
    expect(SEARCH_CACHE_TTL_S).toBe(300);
    expect(SEARCH_TIMEOUT_MS).toBe(8000);
    expect(RATE_PER_MIN).toBe(20);
    expect(MAX_INFLIGHT).toBe(2);
  });

  it("resolves the daily rate per plan tier", () => {
    expect(PLAN_DAILY_RATE.free).toBe(20);
    expect(PLAN_DAILY_RATE.pro).toBe(300);
    expect(resolveDailyRate("free")).toBe(20);
    expect(resolveDailyRate("pro")).toBe(300);
    // Unknown or missing plans never exceed the free tier
    expect(resolveDailyRate(null)).toBe(20);
    expect(resolveDailyRate("enterprise")).toBe(20);
  });
});
