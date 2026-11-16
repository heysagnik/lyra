import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { getLanguageModel } from "./llm";
import { assemblePromptContext } from "./memory";
import { EFFORT_BUDGET, REASONING_TOKEN_MULTIPLIER, calculateTurnCostUsd, type Effort } from "./budget";
import { HELPER_MODEL_ID, FALLBACK_MODEL_ID } from "@/lib/llm/models";
import { planResearch } from "./planner";
import { runResearch } from "./research";
import { checkAnswer, judgeGrounding } from "./check";
import { buildEvidenceMessage, buildRepairMessage } from "./prompt";
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

type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  inputTokenDetails?: { cacheReadTokens?: number };
};

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

export async function runTurn({ request, input }: RunTurnOptions): Promise<Response> {
  const startTime = Date.now();

  const userResult = await requireUser(request);
  if (!userResult.ok) return json({ error: userResult.error.message }, 401);
  const user = userResult.value;

  const limitGate = await checkRateLimits(user.id);
  if (!limitGate.ok) {
    return json(
      {
        error: "Rate limit exceeded. Please wait before sending another message.",
        code: "RATE_LIMITED",
      },
      429,
      { "Retry-After": String(limitGate.retryAfter || 60) }
    );
  }

  let releaseInFlight = limitGate.release;

  const releaseAll = async () => {
    try {
      await releaseInFlight?.();
    } catch {}
    releaseInFlight = undefined;
  };

  try {
    let conv = input.conversationId
      ? await getConversation(input.conversationId, user.id)
      : null;

    if (!conv) {
      conv = await createConversation({
        id: input.conversationId,
        userId: user.id,
        title: input.text.slice(0, 48).trim() || "New chat",
        searchDefault: input.search ?? true,
      });
    }

    const conversationId = conv.id;
    const conversationTitle = conv.title;

    const ctx = await assemblePromptContext(user.id, conversationId);
    const history = ctx.window;

    await createMessage({ conversationId, role: "user", content: input.text });
    await incrementMsgCount(conversationId);

    const effortBudget = EFFORT_BUDGET[(input.effort ?? "standard") as Effort];
    const modelSelection = getLanguageModel(input.model);
    const modelName = modelSelection.modelName;

    const logError = (
      code: "INTERNAL" | "PROVIDER" | "GENERATION_EMPTY",
      msg: string,
      error: unknown
    ) =>
      logStructuredError({
        userId: user.id,
        conversationId,
        code,
        msg,
        error: error instanceof Error ? error.message : String(error),
      });

    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        const write = (chunk: Record<string, unknown>) => {
          try {
            writer.write(chunk as never);
          } catch {}
        };

        try {
          write({ type: "data-meta", data: { conversationId, title: conversationTitle } });

          const plan = await planResearch({ question: input.text, history, modelId: HELPER_MODEL_ID });

          let sources: SearchSource[] = [];
          let executedQueries: string[] = [];
          if (plan.queries.length > 0) {
            const toolCallId = `search-${Date.now()}`;
            write({
              type: "tool-input-available",
              toolCallId,
              toolName: "web_search",
              input: { query: plan.queries.join(" · ") },
            });
            const research = await runResearch(plan);
            sources = research.sources;
            executedQueries = research.executedQueries;
            write({ type: "tool-output-available", toolCallId, output: { count: sources.length } });
            if (sources.length > 0) {
              write({ type: "data-sources", data: { items: sources } });
            }
          }

          const baseMessages = [
            ...history,
            {
              role: "user" as const,
              content: sources.length > 0 ? buildEvidenceMessage(input.text, sources) : input.text,
            },
          ];

          const fallbackSelection =
            modelSelection.modelName !== FALLBACK_MODEL_ID ? getLanguageModel(FALLBACK_MODEL_ID) : null;
          let answerSelection = modelSelection;
          const usageLog: Array<{ model: string; usage: Usage | null }> = [];

          const generate = (messages: typeof baseMessages, selection = answerSelection) =>
            streamText({
              model: selection.model,
              system: ctx.systemPrompt,
              messages,
              temperature: 0.3,
              maxOutputTokens:
                effortBudget.maxTokensOut *
                (selection.definition.reasoning ? REASONING_TOKEN_MULTIPLIER : 1),
              maxRetries: 3,
              onError: ({ error }) => logError("PROVIDER", "Answer generation error", error),
            });

          // A follow-up generation continues the same assistant message: drop its `start` chunk.
          const continueMessage = <T,>(stream: ReadableStream<T>) =>
            stream.pipeThrough(
              new TransformStream<T, T>({
                transform(chunk, controller) {
                  if ((chunk as { type?: string }).type !== "start") controller.enqueue(chunk);
                },
              })
            );

          const first = generate(baseMessages);
          writer.merge(first.toUIMessageStream());

          let finalText = "";
          let reasoning = "";
          let truncated = false;
          try {
            finalText = await first.text;
          } catch {}
          try {
            reasoning = (await first.reasoningText) ?? "";
          } catch {}
          try {
            usageLog.push({ model: answerSelection.modelName, usage: await first.usage });
          } catch {}
          try {
            truncated = (await first.finishReason) === "length";
          } catch {}

          // Selected model produced no answer (e.g. reasoning ate the whole token budget):
          // retry once on the reliable fallback model instead of repeating the same failure.
          if (!finalText.trim() && fallbackSelection) {
            logError(
              "PROVIDER",
              "Selected model returned no answer; retrying on fallback model",
              `model=${modelName} fallback=${fallbackSelection.modelName} truncated=${truncated}`
            );
            answerSelection = fallbackSelection;
            const alt = generate(baseMessages, fallbackSelection);
            writer.merge(continueMessage(alt.toUIMessageStream()));
            try {
              finalText = await alt.text;
            } catch {}
            try {
              const altReasoning = await alt.reasoningText;
              if (altReasoning) reasoning = reasoning ? `${reasoning}\n\n${altReasoning}` : altReasoning;
            } catch {}
            try {
              usageLog.push({ model: fallbackSelection.modelName, usage: await alt.usage });
            } catch {}
            try {
              truncated = (await alt.finishReason) === "length";
            } catch {}
          }

          const checked = checkAnswer(finalText, sources.length, truncated);
          finalText = checked.text;
          if (sources.length > 0 && checked.problems.length === 0) {
            const problem = await judgeGrounding({
              modelId: HELPER_MODEL_ID,
              question: input.text,
              answer: finalText,
              sources,
            });
            if (problem) checked.problems.push(problem);
          }

          if (checked.problems.length > 0) {
            const repair = generate([
              ...baseMessages,
              { role: "assistant" as const, content: finalText.trim() || "(no reply)" },
              { role: "user" as const, content: buildRepairMessage(checked.problems) },
            ]);
            writer.merge(continueMessage(repair.toUIMessageStream()));
            try {
              const repaired = checkAnswer(await repair.text, sources.length);
              if (repaired.text.trim() && repaired.problems.length <= checked.problems.length) {
                finalText = finalText.trim()
                  ? `${finalText.trim()}\n\n**Corrected answer:** ${repaired.text.trim()}`
                  : repaired.text;
              }
            } catch {}
            try {
              const rr = await repair.reasoningText;
              if (rr) reasoning = reasoning ? `${reasoning}\n\n${rr}` : rr;
            } catch {}
            try {
              usageLog.push({ model: answerSelection.modelName, usage: await repair.usage });
            } catch {}
          }

          if (!finalText.trim()) {
            logError(
              "GENERATION_EMPTY",
              "Turn finished with no text output",
              `model=${modelName} searches=${executedQueries.length}`
            );
            finalText =
              "I could not generate a response for that message — the model returned no output (this can happen when the provider is rate-limiting). Please try sending it again.";
            write({ type: "text-start", id: "fallback" });
            write({ type: "text-delta", id: "fallback", delta: finalText });
            write({ type: "text-end", id: "fallback" });
          }

          const sum = (pick: (u: Usage) => number | undefined) =>
            usageLog.reduce((n, e) => n + (e.usage ? (pick(e.usage) ?? 0) : 0), 0);
          const tokensIn = sum((u) => u.inputTokens);
          const tokensOut = sum((u) => u.outputTokens);
          const cachedIn = sum((u) => u.inputTokenDetails?.cacheReadTokens);
          const costUsd = usageLog
            .reduce(
              (n, e) => n + Number(calculateTurnCostUsd(e.model, e.usage?.inputTokens ?? 0, e.usage?.outputTokens ?? 0)),
              0
            )
            .toFixed(6);

          try {
            await createMessage({
              conversationId,
              role: "assistant",
              content: finalText,
              reasoning: reasoning.trim() || undefined,
              toolCalls:
                executedQueries.length > 0
                  ? executedQueries.map((query) => ({ toolName: "web_search", query }))
                  : undefined,
              sources: sources.length > 0 ? sources : undefined,
              model: answerSelection.modelName,
              tokensIn,
              tokensOut,
              latencyMs: Date.now() - startTime,
            });
            await incrementMsgCount(conversationId);
          } catch (e) {
            logError("INTERNAL", "Failed to persist assistant message", e);
          }

          try {
            await recordUsageEvent({
              userId: user.id,
              conversationId,
              model: answerSelection.modelName,
              tokensIn,
              tokensOut,
              cachedIn,
              costUsd,
            });
          } catch (e) {
            logError("INTERNAL", "Failed to record usage event", e);
          }

          void enqueueSideEffects(
            conversationId,
            user.id,
            (conv?.msgCount ?? 0) + 2,
            conv?.summarizedCount ?? 0
          );
        } finally {
          await releaseAll();
        }
      },
      onError: (err) => {
        logError("PROVIDER", "Error during turn execution stream", err);
        return makeAppError(
          "PROVIDER",
          "The assistant could not generate a response. Please retry."
        ).message;
      },
    });

    return createUIMessageStreamResponse({ stream: uiStream });
  } catch (error) {
    await releaseAll();
    logStructuredError({
      userId: user.id,
      code: "INTERNAL",
      msg: "Fatal error in runTurn",
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ error: "Internal server error processing turn" }, 500);
  }
}
