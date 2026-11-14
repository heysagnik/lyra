import {
  streamText,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
  tool,
} from "ai";
import { getLanguageModel } from "./llm";
import { assemblePromptContext } from "./memory";
import {
  EFFORT_BUDGET,
  MAX_SEARCH_CALLS_PER_TURN,
  MAX_SOURCES_PER_TURN,
  calculateTurnCostUsd,
  type Effort,
} from "./budget";
import {
  searchParametersSchema,
  searchWebStructured,
  formatSourcesForModel,
  normalizeQueryKey,
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

    // ─── Per-turn ReAct state ──────────────────────────────────────
    // One evidence ledger across every web_search call in the turn:
    // sources dedupe by URL and keep their global [n] numbering, so the
    // model's inline citations always match the sources panel.
    const turnSources: SearchSource[] = [];
    const seenSourceUrls = new Set<string>();
    const executedQueries: string[] = [];
    const executedQueryKeys = new Set<string>();
    let streamWriter: Parameters<
      Parameters<typeof createUIMessageStream>[0]["execute"]
    >[0]["writer"] | null = null;

    const emitSources = (sources: SearchSource[]) => {
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
        "Search the live web for current information. Call multiple times per turn with distinct, refined queries when research requires it: first to locate facts, then to verify or fill gaps. Never repeat an identical query.",
      inputSchema: searchParametersSchema,
      execute: async (args: SearchParameters) => {
        const parsed = searchParametersSchema.safeParse(args);
        const rawQuery = parsed.success
          ? parsed.data.query ||
            parsed.data.q ||
            parsed.data.keywords ||
            parsed.data.search_query
          : undefined;
        const query = rawQuery?.trim();

        if (!query) {
          return "Tool error: Search query was empty. Please specify keywords (e.g. web_search({ query: 'hubspot pricing 2026' })).";
        }

        // Same query twice in one turn = the model is looping. Point it
        // back at the evidence it already has instead of paying for the
        // same search again.
        const queryKey = normalizeQueryKey(query);
        if (executedQueryKeys.has(queryKey)) {
          return `You already searched "${query}" this turn. Reflect on the evidence above ([1]-[${turnSources.length}]) and either run a different, refined query or synthesize your final answer now.`;
        }

        if (executedQueries.length >= MAX_SEARCH_CALLS_PER_TURN) {
          return `Search budget for this turn is spent (${MAX_SEARCH_CALLS_PER_TURN} queries). Synthesize your final answer from the evidence above ([1]-[${turnSources.length}]) now, and say plainly what could not be verified.`;
        }

        executedQueryKeys.add(queryKey);
        executedQueries.push(query);

        const result = await searchWebStructured({
          query,
          recency_days: parsed.success ? parsed.data.recency_days : undefined,
        });

        // Graceful degradation: never throw — hand the model an actionable note.
        if (result.sources.length === 0) {
          return (
            result.note ||
            "No relevant search results were found. Try different keywords, or answer from your own knowledge and briefly mention that live search was unhelpful."
          );
        }

        // Merge into the turn-wide ledger, deduped by URL, globally numbered.
        const fresh: SearchSource[] = [];
        for (const source of result.sources) {
          if (!source.url || seenSourceUrls.has(source.url)) continue;
          seenSourceUrls.add(source.url);
          turnSources.push(source);
          fresh.push(source);
        }

        if (fresh.length === 0) {
          return `These results repeat evidence already retrieved ([1]-[${turnSources.length}]). Reflect: if it suffices, synthesize your final answer with inline [n] citations; otherwise search with different keywords.`;
        }

        emitSources(turnSources);

        const startIndex = turnSources.length - fresh.length;
        let toolText = formatSourcesForModel(fresh, startIndex);
        if (turnSources.length >= MAX_SOURCES_PER_TURN) {
          toolText += `\n\n(Evidence ledger now holds ${turnSources.length} sources — the maximum for this turn. Synthesize your final answer now with inline [n] citations.)`;
        } else if (executedQueries.length >= 2) {
          toolText += `\n\n(Search ${executedQueries.length} of this turn. Reflect: if the evidence now answers the question, stop searching and answer.)`;
        }
        return toolText;
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
      maxRetries: 3,
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

        if (turnSources.length > 0) {
          writer.write({
            type: "data-sources",
            data: { items: turnSources },
          } as unknown as Parameters<typeof writer.write>[0]);
        }

        writer.merge(streamResult.toUIMessageStream());

        try {
          let finalText = "";
          try {
            finalText = await streamResult.text;
          } catch {}

          // ─── Rescue pass: never end a turn without an answer ────────
          // If the model searched but produced no text (stalled after a
          // tool call, hit a provider hiccup, stopped early), run one
          // toolless generation whose only job is to synthesize the final
          // answer from the evidence already gathered. The user gets a
          // grounded answer, not an error.
          let rescueUsage: {
            inputTokens?: number;
            outputTokens?: number;
            inputTokenDetails?: { cacheReadTokens?: number };
          } | null = null;

          if (!finalText.trim()) {
            const rescueStream = streamText({
              model: modelSelection.model,
              system: ctx.systemPrompt,
              messages: [
                ...messages,
                {
                  role: "user" as const,
                  content:
                    (turnSources.length > 0
                      ? `You already ran these web searches this turn: ${executedQueries.map((q) => `"${q}"`).join(", ")}. Your previous step produced no text. Do not call any tools. Using only the numbered evidence below, write the final answer to the user's last message now: cite inline as [n] matching the evidence numbering, and state plainly anything the evidence could not confirm.\n\nEVIDENCE:\n${formatSourcesForModel(turnSources)}`
                      : `Your previous step produced no text and live search returned nothing usable (searches attempted: ${executedQueries.map((q) => `"${q}"`).join(", ") || "none"}). Do not call any tools. Answer the user's last message from your own knowledge now, and briefly note that live search was unavailable.`),
                },
              ],
              maxOutputTokens: effectiveMaxTokensOut,
              maxRetries: 3,
              onError: ({ error }) => {
                logStructuredError({
                  userId: user.id,
                  conversationId,
                  code: "PROVIDER",
                  msg: "Rescue generation error",
                  error: error instanceof Error ? error.message : String(error),
                });
              },
            });

            writer.merge(rescueStream.toUIMessageStream());

            try {
              finalText = await rescueStream.text;
            } catch {}
            try {
              rescueUsage = await rescueStream.usage;
            } catch {}
          }

          // Even the rescue could not produce text — log quietly for
          // diagnosis and let the stream error path surface a retry.
          if (!finalText.trim()) {
            logStructuredError({
              userId: user.id,
              conversationId,
              code: "GENERATION_EMPTY",
              msg: "Turn finished with no text output even after rescue pass",
              error: `model=${activeModelName} searches=${executedQueries.length}`,
            });
            throw new Error("GENERATION_EMPTY");
          }

          // ─── Persist the completed turn ─────────────────────────────
          const latencyMs = Date.now() - startTime;
          let usage: {
            inputTokens?: number;
            outputTokens?: number;
            inputTokenDetails?: { cacheReadTokens?: number };
          } | null = null;
          try {
            usage = await streamResult.usage;
          } catch {}

          const tokensIn = (usage?.inputTokens ?? 0) + (rescueUsage?.inputTokens ?? 0);
          const tokensOut = (usage?.outputTokens ?? 0) + (rescueUsage?.outputTokens ?? 0);
          const cachedIn =
            (usage?.inputTokenDetails?.cacheReadTokens ?? 0) +
            (rescueUsage?.inputTokenDetails?.cacheReadTokens ?? 0);

          try {
            await createMessage({
              conversationId,
              role: "assistant",
              content: finalText,
              toolCalls:
                executedQueries.length > 0
                  ? executedQueries.map((query) => ({
                      toolName: "web_search",
                      query,
                    }))
                  : undefined,
              sources: turnSources.length > 0 ? turnSources : undefined,
              model: activeModelName,
              tokensIn,
              tokensOut,
              latencyMs,
            });
            await incrementMsgCount(conversationId);
          } catch (persistError) {
            logStructuredError({
              userId: user.id,
              conversationId,
              code: "INTERNAL",
              msg: "Failed to persist assistant message",
              error: persistError instanceof Error ? persistError.message : String(persistError),
            });
          }

          try {
            await recordUsageEvent({
              userId: user.id,
              conversationId,
              model: activeModelName,
              tokensIn,
              tokensOut,
              cachedIn,
              costUsd: calculateTurnCostUsd(activeModelName, tokensIn, tokensOut),
            });
          } catch (usageError) {
            logStructuredError({
              userId: user.id,
              conversationId,
              code: "INTERNAL",
              msg: "Failed to record usage event",
              error: usageError instanceof Error ? usageError.message : String(usageError),
            });
          }

          void enqueueSideEffects(
            conversationId,
            user.id,
            (conv?.msgCount ?? 0) + 2,
            conv?.summarizedCount ?? 0
          );
        } finally {
          if (releaseInFlight) {
            try {
              await releaseInFlight();
            } catch {}
            releaseInFlight = undefined;
          }
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
        return makeAppError(
          "PROVIDER",
          "The assistant could not generate a response. Please retry."
        ).message;
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
