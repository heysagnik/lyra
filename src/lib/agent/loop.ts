import {
  streamText,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  tool,
} from "ai";
import { getGroqModel } from "./llm";
import { assemblePromptContext } from "./memory";
import { EFFORT_BUDGET, type Effort } from "./budget";
import {
  searchParametersSchema,
  executeWebSearch,
} from "@/lib/tools/web-search";
import { requireUser } from "@/lib/auth/require-user";
import { checkRateLimits } from "@/lib/ratelimit/limiters";
import {
  getConversation,
  createConversation,
  incrementMsgCount,
} from "@/lib/db/queries/conversations";
import { createMessage } from "@/lib/db/queries/messages";
import { recordUsageEvent } from "@/lib/db/queries/usage";
import { enqueueSideEffects } from "@/lib/queue/client";
import { logStructuredError, makeAppError } from "@/lib/errors";
import type { TurnInput, SearchSource } from "@/types";

export interface RunTurnOptions {
  request: Request;
  input: TurnInput;
}

export async function runTurn({ request, input }: RunTurnOptions): Promise<Response> {
  const startTime = Date.now();

  // 1. Session check
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return new Response(JSON.stringify({ error: userResult.error.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const user = userResult.value;

  // 2. Rate limiters
  const limitGate = await checkRateLimits(user.id);
  if (!limitGate.ok) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please wait before sending another message.",
        code: "RATE_LIMITED",
      }),
      {
        status: 429,
        headers: {
          "Retry-After": String(limitGate.retryAfter || 60),
          "Content-Type": "application/json",
        },
      }
    );
  }

  let releaseInFlight = limitGate.release;

  try {
    // 3. Conversation & prompt assembly
    let conv = input.conversationId
      ? await getConversation(input.conversationId, user.id)
      : null;

    if (!conv) {
      const title = input.text.slice(0, 48).trim() || "New chat";
      conv = await createConversation({
        id: input.conversationId,
        userId: user.id,
        title,
        searchDefault: input.search ?? true,
      });
    }

    const conversationId = conv.id;
    const conversationTitle = conv.title;
    const searchEnabled = input.search ?? conv.searchDefault;

    // Persist incoming user message immediately
    await createMessage({
      conversationId,
      role: "user",
      content: input.text,
    });
    await incrementMsgCount(conversationId);

    const ctx = await assemblePromptContext(user.id, conversationId);
    const messages = [
      ...ctx.window,
      { role: "user" as const, content: input.text },
    ];

    // Tool setup & source tracking
    let resolvedSources: SearchSource[] = [];
    const customSearchTool = tool({
      description:
        "Search the live web for current information. Use for anything time-sensitive, factual, or outside your training data.",
      inputSchema: searchParametersSchema,
      execute: async (args: { query: string; recency_days?: number }) => {
        return executeWebSearch(args, (sources) => {
          resolvedSources = sources;
        });
      },
    });

    const tools = { web_search: customSearchTool };

    // 4. streamText with the requested model, effort tier, and fallback resilience
    const effortBudget = EFFORT_BUDGET[(input.effort ?? "standard") as Effort];
    const requestedFallback = input.model === "fallback";
    let activeModelName = getGroqModel(requestedFallback).modelName;
    let streamResult;
    try {
      const primary = getGroqModel(requestedFallback);
      streamResult = streamText({
        model: primary.model,
        system: ctx.systemPrompt,
        messages,
        tools,
        prepareStep: ({ stepNumber }) =>
          stepNumber >= effortBudget.iterations - 1 ? { toolChoice: "none" as const } : undefined,
        stopWhen: stepCountIs(effortBudget.iterations),
        maxOutputTokens: effortBudget.maxTokensOut,
        maxRetries: 2,
        onFinish: async (r) => {
          try {
            const latencyMs = Date.now() - startTime;
            const fullText = r.text || "";
            const usage = await r.usage;

            // Persist assistant message
            await createMessage({
              conversationId,
              role: "assistant",
              content: fullText,
              sources: resolvedSources.length > 0 ? resolvedSources : undefined,
              model: activeModelName,
              tokensIn: usage?.inputTokens,
              tokensOut: usage?.outputTokens,
              latencyMs,
            });
            await incrementMsgCount(conversationId);

            // Record usage
            await recordUsageEvent({
              userId: user.id,
              conversationId,
              model: activeModelName,
              tokensIn: usage?.inputTokens,
              tokensOut: usage?.outputTokens,
              cachedIn: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
              costUsd: "0.000000",
            });

            // Enqueue fire-and-forget side effects
            void enqueueSideEffects(
              conversationId,
              user.id,
              (conv?.msgCount ?? 0) + 2,
              conv?.summarizedCount ?? 0
            );
          } finally {
            if (releaseInFlight) {
              await releaseInFlight();
              releaseInFlight = undefined;
            }
          }
        },
        onAbort: async () => {
          if (releaseInFlight) {
            await releaseInFlight();
            releaseInFlight = undefined;
          }
        },
      });
    } catch {
      // Primary model failed before streaming started: fallback to secondary
      const fallback = getGroqModel(true);
      activeModelName = fallback.modelName;

      streamResult = streamText({
        model: fallback.model,
        system: ctx.systemPrompt,
        messages,
        tools,
        prepareStep: ({ stepNumber }) =>
          stepNumber >= effortBudget.iterations - 1 ? { toolChoice: "none" as const } : undefined,
        stopWhen: stepCountIs(effortBudget.iterations),
        maxOutputTokens: effortBudget.maxTokensOut,
        maxRetries: 2,
        onFinish: async (r) => {
          try {
            const latencyMs = Date.now() - startTime;
            const fullText = r.text || "";
            const usage = await r.usage;

            await createMessage({
              conversationId,
              role: "assistant",
              content: fullText,
              sources: resolvedSources.length > 0 ? resolvedSources : undefined,
              model: activeModelName,
              tokensIn: usage?.inputTokens,
              tokensOut: usage?.outputTokens,
              latencyMs,
            });
            await incrementMsgCount(conversationId);

            await recordUsageEvent({
              userId: user.id,
              conversationId,
              model: activeModelName,
              tokensIn: usage?.inputTokens,
              tokensOut: usage?.outputTokens,
              cachedIn: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
              costUsd: "0.000000",
            });

            void enqueueSideEffects(
              conversationId,
              user.id,
              (conv?.msgCount ?? 0) + 2,
              conv?.summarizedCount ?? 0
            );
          } finally {
            if (releaseInFlight) {
              await releaseInFlight();
              releaseInFlight = undefined;
            }
          }
        },
        onAbort: async () => {
          if (releaseInFlight) {
            await releaseInFlight();
            releaseInFlight = undefined;
          }
        },
      });
    }

    // 5. Wrap in UI message stream
    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Emit data-meta immediately
        writer.write({
          type: "data-meta",
          data: { conversationId, title: conversationTitle },
        } as unknown as Parameters<typeof writer.write>[0]);

        // Merge LLM UI message stream
        await writer.merge(streamResult.toUIMessageStream());

        // Emit data-sources if sources were used
        if (resolvedSources.length > 0) {
          writer.write({
            type: "data-sources",
            data: { items: resolvedSources },
          } as unknown as Parameters<typeof writer.write>[0]);
        }
      },
      onError: (err) => {
        logStructuredError({
          userId: user.id,
          conversationId,
          code: "PROVIDER",
          msg: "Error during turn execution stream",
          error: err instanceof Error ? err.message : String(err),
        });
        return makeAppError("PROVIDER", "Failed to generate assistant response").message;
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });
  } catch (error) {
    if (releaseInFlight) {
      await releaseInFlight();
    }
    logStructuredError({
      userId: user.id,
      code: "INTERNAL",
      msg: "Fatal error in runTurn",
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response(
      JSON.stringify({ error: "Internal server error processing turn" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
