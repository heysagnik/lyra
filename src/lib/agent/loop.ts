import {
  streamText,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  tool,
} from "ai";
import { getLanguageModel } from "./llm";
import { assemblePromptContext } from "./memory";
import { EFFORT_BUDGET, calculateTurnCostUsd, type Effort } from "./budget";
import {
  searchParametersSchema,
  executeWebSearch,
  type SearchParameters,
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

  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return new Response(JSON.stringify({ error: userResult.error.message }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const user = userResult.value;

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

    const ctx = await assemblePromptContext(user.id, conversationId, searchEnabled);

    await createMessage({
      conversationId,
      role: "user",
      content: input.text,
    });
    await incrementMsgCount(conversationId);

    const messages = [
      ...ctx.window,
      { role: "user" as const, content: input.text },
    ];

    let resolvedSources: SearchSource[] = [];
    let executedQuery: string | undefined;
    let streamWriter: Parameters<
      Parameters<typeof createUIMessageStream>[0]["execute"]
    >[0]["writer"] | null = null;

    const emitSources = (sources: SearchSource[]) => {
      resolvedSources = sources;
      if (streamWriter && sources.length > 0) {
        try {
          streamWriter.write({
            type: "data-sources",
            data: { items: sources },
          } as unknown as Parameters<typeof streamWriter.write>[0]);
        } catch {}
      }
    };

    const customSearchTool = tool({
      description:
        "Search the live web for current information. Use for anything time-sensitive, factual, or outside your training data.",
      inputSchema: searchParametersSchema,
      execute: async (args: SearchParameters) => {
        executedQuery = args.query || args.q || args.keywords || args.search_query;
        return executeWebSearch(args, (sources) => {
          emitSources(sources);
        });
      },
    });

    const tools = searchEnabled ? { web_search: customSearchTool } : undefined;

    const effortBudget = EFFORT_BUDGET[(input.effort ?? "standard") as Effort];
    const modelSelection = getLanguageModel(input.model);
    const activeModelName = modelSelection.modelName;

    // Groq free/on-demand tier enforces a 1,000 Output Tokens Per Minute (OTPM) limit on Qwen 3.8 27B
    const effectiveMaxTokensOut =
      activeModelName === "qwen/qwen3.8-27b"
        ? Math.min(effortBudget.maxTokensOut, 900)
        : effortBudget.maxTokensOut;

    const streamResult = streamText({
      model: modelSelection.model,
      system: ctx.systemPrompt,
      messages,
      tools,
      prepareStep: ({ stepNumber }) =>
        stepNumber >= effortBudget.iterations - 1 ? { toolChoice: "none" as const } : undefined,
      stopWhen: stepCountIs(effortBudget.iterations),
      maxOutputTokens: effectiveMaxTokensOut,
      maxRetries: 2,
      onError: async ({ error }) => {
        logStructuredError({
          userId: user.id,
          conversationId,
          code: "INTERNAL",
          msg: "Stream text generation error",
          error: error instanceof Error ? error.message : String(error),
        });
        if (releaseInFlight) {
          await releaseInFlight();
          releaseInFlight = undefined;
        }
      },
      onFinish: async (r) => {
        try {
          const latencyMs = Date.now() - startTime;
          const fullText = r.text || "";
          const usage = await r.usage;

          await createMessage({
            conversationId,
            role: "assistant",
            content: fullText,
            toolCalls: executedQuery
              ? [{ toolName: "web_search", query: executedQuery }]
              : resolvedSources.length > 0
              ? [{ toolName: "web_search" }]
              : undefined,
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
            costUsd: calculateTurnCostUsd(
              activeModelName,
              usage?.inputTokens,
              usage?.outputTokens
            ),
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

    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        streamWriter = writer;

        writer.write({
          type: "data-meta",
          data: { conversationId, title: conversationTitle },
        } as unknown as Parameters<typeof writer.write>[0]);

        if (resolvedSources.length > 0) {
          writer.write({
            type: "data-sources",
            data: { items: resolvedSources },
          } as unknown as Parameters<typeof writer.write>[0]);
        }

        writer.merge(streamResult.toUIMessageStream());

        try {
          await streamResult.text;
        } catch {}

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
