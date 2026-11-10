import { describe, it, expect } from "vitest";
import {
  WINDOW_MESSAGES,
  SUMMARY_MAX_TOKENS,
  SNIPPET_MAX_CHARS,
  TOOL_MAX_ITERATIONS,
  MAX_TOKENS_OUT,
  SEARCH_CACHE_TTL_S,
  SEARCH_TIMEOUT_MS,
  RATE_PER_MIN,
  RATE_PER_DAY,
  MAX_INFLIGHT,
  TARGET_PROMPT_TOKENS,
} from "./budget";

describe("System Budgets & Limits", () => {
  it("defines memory and token budgets according to AGENT.md", () => {
    expect(WINDOW_MESSAGES).toBe(10);
    expect(SUMMARY_MAX_TOKENS).toBe(300);
    expect(SNIPPET_MAX_CHARS).toBe(300);
    expect(TOOL_MAX_ITERATIONS).toBe(2);
    expect(MAX_TOKENS_OUT).toBe(1024);
    expect(TARGET_PROMPT_TOKENS).toBe(2600);
  });

  it("defines search and rate limits according to AGENT.md", () => {
    expect(SEARCH_CACHE_TTL_S).toBe(300);
    expect(SEARCH_TIMEOUT_MS).toBe(8000);
    expect(RATE_PER_MIN).toBe(20);
    expect(RATE_PER_DAY).toBe(300);
    expect(MAX_INFLIGHT).toBe(2);
  });
});
