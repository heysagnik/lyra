import crypto from "node:crypto";
import { z } from "zod";
import { extractMemoriesWithLlm, generateSummaryWithLlm } from "@/lib/agent/llm";
import { getRecentMessages } from "@/lib/db/queries/messages";
import { upsertMemory } from "@/lib/db/queries/memories";
import {
  getConversation,
  updateConversationSummaryCas,
} from "@/lib/db/queries/conversations";
import { recordJobFailure } from "@/lib/db/queries/usage";
import { SUMMARY_MAX_TOKENS } from "@/lib/agent/budget";
import { logStructuredError } from "@/lib/errors";

const extractedMemoriesSchema = z.object({
  memories: z.array(
    z.object({
      kind: z.enum(["fact", "preference", "correction"]),
      content: z.string().min(5).max(300),
      confidence: z.number().min(0.5).max(1.0),
    })
  ),
});

/**
 * Execute memory distillation directly in background without external QStash overhead.
 */
export async function executeDistillTask(
  conversationId: string,
  userId: string
): Promise<{ success: boolean; count: number }> {
  try {
    const recent = await getRecentMessages(conversationId, 4);
    if (recent.length === 0) {
      return { success: true, count: 0 };
    }

    const conversationSnippet = recent
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    let extracted: z.infer<typeof extractedMemoriesSchema>["memories"] = [];
    try {
      const res = await extractMemoriesWithLlm(
        `Extract durable facts, preferences, or corrections about the user from this recent conversation fragment. If there is nothing durable to remember about the user, return an empty array.\n\nConversation:\n${conversationSnippet}`,
        extractedMemoriesSchema
      );
      extracted = res.memories;
    } catch {
      extracted = [];
    }

    let savedCount = 0;
    for (const mem of extracted) {
      const contentHash = crypto
        .createHash("sha256")
        .update(mem.content.trim().toLowerCase())
        .digest("hex");

      await upsertMemory({
        userId,
        kind: mem.kind,
        content: mem.content.trim(),
        confidence: mem.confidence,
        sourceConversation: conversationId,
        contentHash,
      });
      savedCount++;
    }

    return { success: true, count: savedCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStructuredError({
      userId,
      conversationId,
      code: "INTERNAL",
      msg: "Distill task error",
      error: errorMsg,
    });

    await recordJobFailure({
      kind: "chat.distill",
      payload: { conversationId, userId },
      error: errorMsg,
      attempts: 1,
    });

    return { success: false, count: 0 };
  }
}

/**
 * Execute rolling summary update directly in background without external QStash overhead.
 */
export async function executeSummarizeTask(
  conversationId: string,
  userId: string
): Promise<{ success: boolean; updated: boolean }> {
  try {
    const conv = await getConversation(conversationId, userId);
    if (!conv) {
      return { success: false, updated: false };
    }

    // Only summarize if lag is significant (>= 10 messages)
    if (conv.msgCount - conv.summarizedCount < 10) {
      return { success: true, updated: false };
    }

    const messages = await getRecentMessages(conversationId, 15);
    if (messages.length === 0) {
      return { success: true, updated: false };
    }

    const transcript = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const summaryPrompt = `You are a concise conversation summarizer. Produce an updated rolling summary of the following conversation in at most 150 words. Focus on key decisions, topic progress, and user context.\n\nPrevious summary:\n${conv.summary || "None"}\n\nRecent transcript:\n${transcript}`;

    let newSummary = conv.summary || "";
    try {
      newSummary = await generateSummaryWithLlm(summaryPrompt, SUMMARY_MAX_TOKENS);
    } catch {
      newSummary = conv.summary || "Conversation active.";
    }

    const latestMessage = messages[messages.length - 1];

    const updated = await updateConversationSummaryCas(
      conversationId,
      conv.summaryVersion,
      {
        summary: newSummary,
        summaryUpto: latestMessage?.id ?? conv.summaryUpto,
        summarizedCount: conv.msgCount,
      }
    );

    return { success: true, updated };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStructuredError({
      userId,
      conversationId,
      code: "INTERNAL",
      msg: "Summarize task error",
      error: errorMsg,
    });

    await recordJobFailure({
      kind: "chat.summarize",
      payload: { conversationId, userId },
      error: errorMsg,
      attempts: 1,
    });

    return { success: false, updated: false };
  }
}
