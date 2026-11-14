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

/** Event/intent terms that make a search query specific enough to act on */
const SEARCH_INTENT_WORDS = new Set([
  "news", "ceo", "cfo", "cto", "price", "pricing", "release", "launched",
  "launch", "update", "updates", "earnings", "results", "revenue", "stock",
  "scandal", "resign", "resigned", "resignation", "lawsuit", "sued", "sues",
  "affair", "layoff", "layoffs", "review", "reviewed", "vs", "versus",
  "buy", "sold", "sale", "acquisition", "acquired", "partnership", "ipo",
  "fired", "arrest", "arrested", "died", "death", "rumor", "rumors",
  "controversy", "caught", "spy", "allegations", "accused", "benchmark",
  "features", "specification", "specifications", "specs", "announced",
  "announcement", "statement", "interview", "paper", "study", "guide",
  "tutorial", "documentation", "docs", "how", "why", "what", "when", "who",
  "history", "biography", "founder", "founded", "company", "wirecutter",
  "best", "top", "comparison", "weather", "today", "latest", "current",
  "schedule", "score", "election", "government", "policy", "law", "rule",
]);
import {
  searchParametersSchema,
  searchWebStructured,
  formatSourcesForModel,
  isGenericEntityResult,
  normalizeQueryKey,
  extractEventKeywords,
  rankSourcesForEvidence,
  looksLikeNewsResult,
  type SearchParameters,
} from "@/lib/tools/web-search";
import { requireUser } from "@/lib/auth/require-user";
import { checkRateLimits, acquireOutputTokenBudget } from "@/lib/ratelimit/limiters";
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
        "Search the live web for current information. Queries must pair the entity with the event or intent (e.g. 'Jensen Huang resignation rumor', not 'Jensen Huang'). Call multiple times per turn with distinct, refined queries when research requires it. Never repeat an identical query.",
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

        // Vague-query handling: a bare entity name (1-2 words with no
        // event/intent term) returns homepages and profiles, not evidence.
        // First try to AUTO-REFINE it using event keywords from the user's
        // own message ("Jensen Huang" + user said "resigned" ->
        // "Jensen Huang resigned") — executing the refined query keeps the
        // turn moving instead of bouncing the problem back to the model.
        // Only bounce when we genuinely cannot infer the intent.
        const queryWords = query.split(/\s+/).filter(Boolean);
        const hasIntentWord = queryWords.some((w) =>
          SEARCH_INTENT_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, ""))
        );
        let effectiveQuery = query;
        let refinementNote = "";
        if (queryWords.length < 2 || (queryWords.length === 2 && !hasIntentWord)) {
          const eventKeywords = extractEventKeywords(input.text);
          if (eventKeywords.length > 0) {
            effectiveQuery = query + " " + eventKeywords.slice(0, 3).join(" ");
            refinementNote =
              '(NOTE: your query "' + query + '" was auto-refined to "' +
              effectiveQuery + '" using the intent from the user\'s message. ' +
              'Next time, include the event keywords yourself.)\n\n';
          } else {
            return (
              'Query "' + query + '" is too vague — a bare name or entity pair returns generic pages and profiles, not evidence about what happened. ' +
              'Re-query with the entity plus event/intent keywords that match the user\'s question ' +
              '(e.g. "' + queryWords[0] + ' resignation news", "' + queryWords[0] + ' announcement update", "' + queryWords.join(" ") + ' scandal details").'
            );
          }
        }

        // Same query twice in one turn = the model is looping. Point it
        // back at the evidence it already has instead of paying for the
        // same search again.
        const queryKey = normalizeQueryKey(effectiveQuery);
        if (executedQueryKeys.has(queryKey)) {
          return `You already searched "${query}" this turn. Reflect on the evidence above ([1]-[${turnSources.length}]) and either run a different, refined query or synthesize your final answer now.`;
        }

        if (executedQueries.length >= MAX_SEARCH_CALLS_PER_TURN) {
          return `Search budget for this turn is spent (${MAX_SEARCH_CALLS_PER_TURN} queries). Synthesize your final answer from the evidence above ([1]-[${turnSources.length}]) now, and say plainly what could not be verified.`;
        }

        executedQueryKeys.add(queryKey);
        executedQueries.push(effectiveQuery);

        const result = await searchWebStructured({
          query: effectiveQuery,
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
        // Rank the fresh batch so event-like dated articles come first and
        // generic entity pages come last — models attend most to the top of
        // the evidence block, and burying the one relevant article under
        // five profile pages is the top cause of "no evidence" answers.
        const unique: SearchSource[] = [];
        for (const source of result.sources) {
          if (!source.url || seenSourceUrls.has(source.url)) continue;
          seenSourceUrls.add(source.url);
          unique.push(source);
        }
        const fresh = rankSourcesForEvidence(unique, queryKey);
        turnSources.push(...fresh);

        if (fresh.length === 0) {
          return `These results repeat evidence already retrieved ([1]-[${turnSources.length}]). Reflect: if it suffices, synthesize your final answer with inline [n] citations; otherwise search with different keywords.`;
        }

        emitSources(turnSources);

        const startIndex = turnSources.length - fresh.length;
        let toolText = refinementNote + formatSourcesForModel(fresh, startIndex);

        // Result-quality feedback: if most of this result set is generic
        // entity pages (title = query/entity, or a site homepage), the query
        // was too vague — tell the model to re-query with event keywords
        // instead of synthesizing from homepages.
        const genericCount = fresh.filter((s) =>
          isGenericEntityResult(s, queryKey)
        ).length;
        if (genericCount >= Math.max(2, Math.ceil(fresh.length * 0.6))) {
          toolText += `\n\n(RESULT QUALITY WARNING: ${genericCount} of ${fresh.length} results are generic entity pages or site homepages, not articles about the event. Your query was too vague. Re-query with event-specific keywords — what happened, to whom, claimed by whom — instead of synthesizing from these homepages.)`;
        }
        const articleNumbers = fresh
          .map((s, i) => (looksLikeNewsResult(s) ? startIndex + i + 1 : -1))
          .filter((n) => n > 0);
        if (articleNumbers.length > 0) {
          toolText +=
            "\n\n(ATTENTION: results " +
            articleNumbers.map((n) => "[" + n + "]").join(", ") +
            " look like actual dated articles or reports about recent events. Read their titles and snippets CAREFULLY before concluding anything — a headline or snippet mentioning the event the user asked about IS the evidence you were looking for, even when it appears among profile pages. Never answer that there is no evidence while one of these results mentions the event.)";
        }
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

    // ─── Provider OTPM gate ────────────────────────────────────────
    // Groq's free tier enforces an account-wide output-tokens-per-minute
    // ceiling per model. Without this gate, a burst of turns exhausts it,
    // every stream call 429s, and the turn dies with no assistant message
    // (the exact failure observed in production). Reserve this turn's
    // output ceiling before starting; released when the turn completes.
    let releaseOtpm: (() => Promise<void>) | undefined;
    const otpmGate = await acquireOutputTokenBudget(
      activeModelName,
      effectiveMaxTokensOut
    );
    if (!otpmGate.ok) {
      if (releaseInFlight) {
        await releaseInFlight();
        releaseInFlight = undefined;
      }
      return new Response(
        JSON.stringify({
          error:
            "The AI provider's per-minute output limit is busy right now. Please wait a moment and send the message again.",
          code: "RATE_LIMITED",
        }),
        {
          status: 429,
          headers: {
            "Retry-After": String(otpmGate.retryAfter || 30),
            "Content-Type": "application/json",
          },
        }
      );
    }
    releaseOtpm = otpmGate.release ?? (async () => {});

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
        if (releaseOtpm) {
          try {
            await releaseOtpm();
          } catch {}
          releaseOtpm = undefined;
        }
      },
      onAbort: async () => {
        if (releaseInFlight) {
          await releaseInFlight();
          releaseInFlight = undefined;
        }
        if (releaseOtpm) {
          try {
            await releaseOtpm();
          } catch {}
          releaseOtpm = undefined;
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

          // ─── Citation token normalization ──────────────────────────
          // Some models (Nemotron/GPT-lineage trained on OpenAI browsing
          // data) regress to the internal 【7†L1-L3】 token format instead
          // of plain ASCII [7]. Normalize before the rescue detector and
          // before the text is streamed/persisted, so citation chips link.
          finalText = finalText
            .replace(/[【\[]?(\d+)†[^】\]]*[】\]]/g, "[$1]")
            // Standalone 【7】 with no line-range marker
            .replace(/【(\d+)】/g, "[$1]");

          // ─── Incomplete-answer detection + rescue pass ───────────────
          // The ReAct loop can end with visible text that is NOT an answer:
          // the model narrates intent ("those results aren't relevant — let me
          // search..."), stops without acting, and the narration counts as
          // text. Detect narration-style endings and force a completion:
          //   - evidence exists → toolless synthesis from the ledger
          //   - nothing retrieved → one more tool-enabled attempt
          const hasCitations = /\[\d+\]/.test(finalText);
          const narrationStart =
            /^(?:\[[^\]]{1,32}\]\s*)?(?:thinking|ok,|hmm|well,|let me (?!know)|let's|i'll|i will|i am going to|i'm going to|grab|those results|that (?:last )?result|the results|more relevant|searching|first,)/i;
          const needsRescue =
            !finalText.trim() ||
            (executedQueries.length > 0 && !hasCitations && finalText.length < 400) ||
            (!hasCitations && finalText.length < 240 && narrationStart.test(finalText));

          let rescueUsage: {
            inputTokens?: number;
            outputTokens?: number;
            inputTokenDetails?: { cacheReadTokens?: number };
          } | null = null;

          // ─── Contradiction rescue ──────────────────────────────────
          // The most damaging failure observed in production: the user
          // asserts an event, the evidence ledger CONTAINS a source whose
          // title/snippet mentions that event, yet the model answers
          // "there is no credible evidence". Detect that exact mismatch
          // and force a re-read of the matching sources.
          const DENIAL_RE =
            /no (credible |verifiable |reliable |convincing )?(evidence|news|report|reporting|confirmation|mention|indication)|there is no |not (been )?(confirmed|verified|reported|backed)|doesn'?t appear to be|no sign of|no public/i;
          const assertedEvents = extractEventKeywords(input.text);
          const matchingEvidence = assertedEvents.length > 0
            ? turnSources.filter((src) =>
                assertedEvents.some((kw) => {
                  const hay = (src.title + " " + src.snippet).toLowerCase();
                  return hay.includes(kw);
                })
              )
            : [];
          const contradictsEvidence =
            !needsRescue &&
            finalText.trim().length > 0 &&
            matchingEvidence.length > 0 &&
            DENIAL_RE.test(finalText);

          if (needsRescue || contradictsEvidence) {
            const hasEvidence = turnSources.length > 0;
            const rescueStream = streamText({
              model: modelSelection.model,
              system: ctx.systemPrompt,
              // Evidence in hand → answer directly, no tools. Otherwise the
              // previous attempt never actually searched → retry WITH tools,
              // but tightly bounded and forced to end with a real answer.
              tools: hasEvidence || !searchEnabled ? undefined : tools,
              stopWhen: hasEvidence || !searchEnabled ? undefined : stepCountIs(3),
              prepareStep:
                hasEvidence || !searchEnabled
                  ? undefined
                  : ({ stepNumber }) =>
                      stepNumber >= 2 ? { toolChoice: "none" as const } : undefined,
              messages: [
                ...messages,
                {
                  role: "user" as const,
                  content: hasEvidence
                    ? contradictsEvidence
                      ? "CORRECTION REQUIRED. Your previous answer denied that anything happened, but the retrieved evidence below contains sources whose titles or snippets DIRECTLY mention it: " +
                        formatSourcesForModel(matchingEvidence) +
                        ". Re-read that evidence carefully and give the corrected, complete final answer to the user's last message now, citing inline as [n] matching the evidence numbering. If, after genuinely re-reading, the evidence still does not support the event, say so explicitly and quote which sources you checked.\n\nFULL EVIDENCE:\n" +
                        formatSourcesForModel(turnSources)
                      : `FINAL ANSWER REQUIRED. You already ran these web searches this turn: ${executedQueries.map((q) => `"${q}"`).join(", ")}. Your previous response stopped after narrating intent instead of answering. Do not call any tools and do not narrate. Using only the numbered evidence below, write the complete final answer to the user's last message now: cite inline as [n] matching the evidence numbering, and state plainly anything the evidence could not confirm.\n\nEVIDENCE:\n${formatSourcesForModel(turnSources)}`
                    : `FINAL ANSWER REQUIRED. Your previous response stopped after narrating intent instead of answering (it said: "${finalText.trim().slice(0, 160)}"). Do not write intent narration. If the question needs current information, call web_search now with a specific keyword query, reflect on the results, and then give the complete final answer with inline [n] citations. Otherwise answer directly. The turn must end with the complete answer text.`,
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

            writer.merge(
              rescueStream.toUIMessageStream().pipeThrough(
                // The rescue continues the SAME assistant message: dropping
                // its `start` chunk keeps the client from resetting into a
                // second bubble mid-answer.
                new TransformStream({
                  transform(chunk, controller) {
                    if ((chunk as { type?: string }).type !== "start") {
                      controller.enqueue(chunk);
                    }
                  },
                })
              )
            );

            try {
              const rescueText = await rescueStream.text;
              if (contradictsEvidence && rescueText.trim()) {
                // UI sees: original answer + correction appended; persist both.
                finalText =
                  finalText.trim() +
                  "\n\n**Update after re-checking the evidence:** " +
                  rescueText.trim();
              } else {
                finalText = rescueText;
              }
            } catch {}
            try {
              rescueUsage = await rescueStream.usage;
            } catch {}
          }

          // Even the rescue could not produce text. Emit and persist a
          // visible fallback so the user never gets a silently dead turn
          // (observed in production: Groq OTPM exhaustion 429s leave the
          // last user message with no assistant reply at all).
          if (!finalText.trim()) {
            logStructuredError({
              userId: user.id,
              conversationId,
              code: "GENERATION_EMPTY",
              msg: "Turn finished with no text output even after rescue pass",
              error: `model=${activeModelName} searches=${executedQueries.length}`,
            });
            finalText =
              "I could not generate a response for that message — the model returned no output (this can happen when the provider is rate-limiting). Please try sending it again.";
            try {
              writer.write({ type: "text-start", id: "fallback" } as never);
              writer.write({
                type: "text-delta",
                id: "fallback",
                delta: finalText,
              } as never);
              writer.write({ type: "text-end", id: "fallback" } as never);
            } catch {}
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
          if (releaseOtpm) {
            try {
              await releaseOtpm();
            } catch {}
            releaseOtpm = undefined;
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
    // The OTPM reservation variable lives inside the try block; nothing to
    // release here if we never got past the gates.
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
