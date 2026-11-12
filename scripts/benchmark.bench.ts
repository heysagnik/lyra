import { describe, it, expect } from "vitest";
import { streamText, tool, stepCountIs } from "ai";
import {
  executeWebSearch,
  searchParametersSchema,
  type SearchParameters,
} from "@/lib/tools/web-search";
import { getLanguageModel } from "@/lib/agent/llm";
import { assembleSystemPrompt } from "@/lib/agent/prompt";
import { calculateTurnCostUsd, TARGET_PROMPT_TOKENS } from "@/lib/agent/budget";
import type { SearchSource, Memory } from "@/types";

interface BenchmarkResult {
  suite: string;
  testCase: string;
  ttftMs?: number;
  totalLatencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  throughputTokPerSec?: number;
  costUsd?: string;
  notes?: string;
}

const benchmarkResults: BenchmarkResult[] = [];

describe("Live Agent Benchmark Suite", () => {
  it("Benchmark 1: TinyFish Web Search Latency & Cache Performance", async () => {
    const query = `quantum computing advances ${Date.now()}`;

    // Cold query (Cache miss)
    const t0 = performance.now();
    let sourcesReceived: SearchSource[] = [];
    const coldSummary = await executeWebSearch({ query }, (s) => {
      sourcesReceived = s;
    });
    const coldDurationMs = Math.round(performance.now() - t0);

    expect(coldSummary).toBeDefined();
    expect(coldDurationMs).toBeGreaterThan(0);

    // Warm query (Cache hit)
    const t1 = performance.now();
    let cachedSources: SearchSource[] = [];
    const warmSummary = await executeWebSearch({ query }, (s) => {
      cachedSources = s;
    });
    const warmDurationMs = Math.round(performance.now() - t1);

    expect(warmSummary).toBe(coldSummary);
    expect(cachedSources.length).toBe(sourcesReceived.length);

    const speedup = (coldDurationMs / Math.max(warmDurationMs, 1)).toFixed(1);

    benchmarkResults.push({
      suite: "Web Search Tool",
      testCase: "TinySearch Cold vs Cached",
      totalLatencyMs: coldDurationMs,
      notes: `Cold: ${coldDurationMs}ms (${sourcesReceived.length} sources) | Warm: ${warmDurationMs}ms (${speedup}x speedup)`,
    });
  });

  it("Benchmark 2: Groq Primary Model (qwen/qwen3.8-27b) Direct Generation", async () => {
    const { model, modelName } = getLanguageModel();
    const system = assembleSystemPrompt([], null, false);
    const prompt = "Explain what a distributed transaction is in 2 concise sentences.";

    const start = performance.now();
    let ttftMs = 0;
    let fullText = "";

    const stream = streamText({
      model,
      system,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 256,
    });

    for await (const chunk of stream.textStream) {
      if (!ttftMs) {
        ttftMs = Math.round(performance.now() - start);
      }
      fullText += chunk;
    }

    if (!fullText) {
      fullText = await stream.text;
    }

    const totalLatencyMs = Math.round(performance.now() - start);
    const usage = await stream.usage;
    const tokensIn = usage.inputTokens || 0;
    const tokensOut = usage.outputTokens || 0;
    const throughputTokPerSec =
      totalLatencyMs > 0 ? Math.round((tokensOut / (totalLatencyMs / 1000))) : 0;
    const costUsd = calculateTurnCostUsd(modelName, tokensIn, tokensOut);

    expect(fullText.length).toBeGreaterThan(20);
    expect(ttftMs).toBeGreaterThan(0);

    benchmarkResults.push({
      suite: "Groq Primary LLM",
      testCase: `Direct Generation (${modelName})`,
      ttftMs,
      totalLatencyMs,
      tokensIn,
      tokensOut,
      throughputTokPerSec,
      costUsd,
      notes: `TTFT: ${ttftMs}ms | Speed: ${throughputTokPerSec} tok/s | Cost: $${costUsd}`,
    });
  });

  it("Benchmark 3: Groq Primary Model with Live Tool Calling & Evidence Grounding", async () => {
    const { model, modelName } = getLanguageModel();
    const system = assembleSystemPrompt([], null, true);
    const prompt = "What are the latest updates on Python programming language releases in 2026? Give a brief summary.";

    let resolvedSources: SearchSource[] = [];
    const customSearchTool = tool({
      description:
        "Search the live web for current information. Use for anything time-sensitive, factual, or outside your training data.",
      inputSchema: searchParametersSchema,
      execute: async (args: SearchParameters) => {
        return executeWebSearch(args, (s) => {
          resolvedSources = s;
        });
      },
    });

    const start = performance.now();
    let ttftMs = 0;
    let fullText = "";

    const stream = streamText({
      model,
      system,
      messages: [{ role: "user", content: prompt }],
      tools: { web_search: customSearchTool },
      stopWhen: stepCountIs(3),
      maxOutputTokens: 512,
    });

    fullText = await stream.text;

    const totalLatencyMs = Math.round(performance.now() - start);
    const usage = await stream.usage;
    const tokensIn = usage.inputTokens || 0;
    const tokensOut = usage.outputTokens || 0;
    const throughputTokPerSec =
      totalLatencyMs > 0 ? Math.round((tokensOut / (totalLatencyMs / 1000))) : 0;
    const costUsd = calculateTurnCostUsd(modelName, tokensIn, tokensOut);

    const hasCitations = /\[\d+\]/.test(fullText);

    expect(fullText.length).toBeGreaterThan(20);

    benchmarkResults.push({
      suite: "Multi-Step Agent Loop",
      testCase: `Search-Augmented Turn (${modelName})`,
      ttftMs,
      totalLatencyMs,
      tokensIn,
      tokensOut,
      throughputTokPerSec,
      costUsd,
      notes: `Sources retrieved: ${resolvedSources.length} | Inline citations present: ${hasCitations} | Total turn: ${totalLatencyMs}ms`,
    });
  });

  it("Benchmark 4: Secondary Model (openai/gpt-oss-20b) Direct Generation", async () => {
    const { model, modelName } = getLanguageModel("gpt-oss-20b");
    const system = assembleSystemPrompt([], null, false);
    const prompt = "Give a 2-sentence summary of the theory of relativity.";

    const start = performance.now();
    let ttftMs = 0;
    let fullText = "";

    const stream = streamText({
      model,
      system,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 256,
    });

    for await (const chunk of stream.textStream) {
      if (!ttftMs) {
        ttftMs = Math.round(performance.now() - start);
      }
      fullText += chunk;
    }

    if (!fullText) {
      fullText = await stream.text;
    }

    const totalLatencyMs = Math.round(performance.now() - start);
    const usage = await stream.usage;
    const tokensIn = usage.inputTokens || 0;
    const tokensOut = usage.outputTokens || 0;
    const throughputTokPerSec =
      totalLatencyMs > 0 ? Math.round((tokensOut / (totalLatencyMs / 1000))) : 0;
    const costUsd = calculateTurnCostUsd(modelName, tokensIn, tokensOut);

    expect(fullText.length).toBeGreaterThan(20);

    benchmarkResults.push({
      suite: "Secondary Registered Model",
      testCase: `Direct Generation (${modelName})`,
      ttftMs,
      totalLatencyMs,
      tokensIn,
      tokensOut,
      throughputTokPerSec,
      costUsd,
      notes: `TTFT: ${ttftMs}ms | Speed: ${throughputTokPerSec} tok/s | Cost: $${costUsd}`,
    });
  });

  it("Benchmark 5: User Memory (T1) Recall and Persona Grounding", async () => {
    const { model, modelName } = getLanguageModel();
    const mockMemories: Memory[] = [
      {
        id: "mem-1",
        userId: "user-test",
        kind: "fact",
        content: "User lives in Kyoto, Japan and works at an aerospace robotics lab",
        confidence: 1.0,
        contentHash: "h1",
        createdAt: new Date(),
      },
      {
        id: "mem-2",
        userId: "user-test",
        kind: "preference",
        content: "User's favorite drink is Gyokuro green tea and preferred language is Rust",
        confidence: 1.0,
        contentHash: "h2",
        createdAt: new Date(),
      },
    ];

    const systemPrompt = assembleSystemPrompt(mockMemories, null, true);
    const prompt = "Where do I live, and what drink should I make while writing code in my favorite programming language?";

    const start = performance.now();
    let ttftMs = 0;
    let fullText = "";

    const stream = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 256,
    });

    for await (const chunk of stream.textStream) {
      if (!ttftMs) {
        ttftMs = Math.round(performance.now() - start);
      }
      fullText += chunk;
    }

    const totalLatencyMs = Math.round(performance.now() - start);
    const usage = await stream.usage;
    const tokensIn = usage.inputTokens || 0;
    const tokensOut = usage.outputTokens || 0;
    const throughputTokPerSec =
      totalLatencyMs > 0 ? Math.round((tokensOut / (totalLatencyMs / 1000))) : 0;
    const costUsd = calculateTurnCostUsd(modelName, tokensIn, tokensOut);

    const recallsLocation = /kyoto/i.test(fullText);
    const recallsLanguage = /rust/i.test(fullText);
    const recallsDrink = /gyokuro/i.test(fullText);

    expect(recallsLocation).toBe(true);
    expect(recallsLanguage).toBe(true);
    expect(recallsDrink).toBe(true);

    benchmarkResults.push({
      suite: "Memory Recall (T1)",
      testCase: "User Persistent Memory Recall",
      ttftMs,
      totalLatencyMs,
      tokensIn,
      tokensOut,
      throughputTokPerSec,
      costUsd,
      notes: `Location (Kyoto): ${recallsLocation} | Lang (Rust): ${recallsLanguage} | Drink (Gyokuro): ${recallsDrink}`,
    });
  });

  it("Benchmark 6: Conversation Summary (T2) Recall Across Compacted History", async () => {
    const { model, modelName } = getLanguageModel();
    const mockSummary =
      "The user previously troubleshot a database connection bottleneck under 5,000 req/sec, fixed by configuring PgBouncer in transaction mode and setting pool_size to 50.";

    const systemPrompt = assembleSystemPrompt([], mockSummary, false);
    const prompt = "How did we resolve that database connection bottleneck we diagnosed earlier?";

    const start = performance.now();
    let ttftMs = 0;
    let fullText = "";

    const stream = streamText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: 256,
    });

    for await (const chunk of stream.textStream) {
      if (!ttftMs) {
        ttftMs = Math.round(performance.now() - start);
      }
      fullText += chunk;
    }

    const totalLatencyMs = Math.round(performance.now() - start);
    const usage = await stream.usage;
    const tokensIn = usage.inputTokens || 0;
    const tokensOut = usage.outputTokens || 0;
    const throughputTokPerSec =
      totalLatencyMs > 0 ? Math.round((tokensOut / (totalLatencyMs / 1000))) : 0;
    const costUsd = calculateTurnCostUsd(modelName, tokensIn, tokensOut);

    const recallsPgBouncer = /pgbouncer/i.test(fullText);
    const recallsTransactionMode = /transaction/i.test(fullText) || /pool/i.test(fullText);

    expect(recallsPgBouncer).toBe(true);

    benchmarkResults.push({
      suite: "Memory Recall (T2)",
      testCase: "Rolling Summary Recall",
      ttftMs,
      totalLatencyMs,
      tokensIn,
      tokensOut,
      throughputTokPerSec,
      costUsd,
      notes: `Recalled PgBouncer: ${recallsPgBouncer} | Recalled Pool/Transaction Details: ${recallsTransactionMode}`,
    });
  });

  it("Benchmark 7: Context Prompt Boundedness Verification", () => {
    const mockMemories: Memory[] = [
      { id: "1", userId: "u", kind: "preference", content: "Prefers concise TypeScript answers", confidence: 1.0, contentHash: "h1", createdAt: new Date() },
      { id: "2", userId: "u", kind: "fact", content: "Software engineer working on Next.js 16", confidence: 1.0, contentHash: "h2", createdAt: new Date() },
      { id: "3", userId: "u", kind: "correction", content: "Always use Next.js App Router patterns", confidence: 1.0, contentHash: "h3", createdAt: new Date() },
    ];
    const mockSummary = "The user previously discussed database indexes and Next.js server actions.";

    const systemPrompt = assembleSystemPrompt(mockMemories, mockSummary, true);

    // Approximate token count: chars / 4
    const approxTokens = Math.ceil(systemPrompt.length / 4);

    expect(approxTokens).toBeLessThan(TARGET_PROMPT_TOKENS);

    benchmarkResults.push({
      suite: "Context Boundedness",
      testCase: "T0+T1+T2 Prompt Budget",
      totalLatencyMs: 0,
      tokensIn: approxTokens,
      notes: `System prompt length: ${systemPrompt.length} chars (~${approxTokens} tokens) | Target ceiling: ${TARGET_PROMPT_TOKENS} tokens`,
    });

    // Print final tabulated benchmark report to stdout
    console.log("\n=================== LYRA AGENT BENCHMARK REPORT ===================");
    console.table(
      benchmarkResults.map((r) => ({
        Suite: r.suite,
        TestCase: r.testCase,
        "TTFT (ms)": r.ttftMs ?? "-",
        "Total (ms)": r.totalLatencyMs,
        "Tokens In": r.tokensIn ?? "-",
        "Tokens Out": r.tokensOut ?? "-",
        "Speed (tok/s)": r.throughputTokPerSec ?? "-",
        "Cost (USD)": r.costUsd ? `$${r.costUsd}` : "-",
        Notes: r.notes ?? "",
      }))
    );
    console.log("===================================================================\n");
  });
});
