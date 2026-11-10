import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyWorkerRequest } from "@/lib/queue/verify";
import { generateSummaryWithLlm } from "@/lib/agent/llm";
import {
  getConversation,
  updateConversationSummaryCas,
} from "@/lib/db/queries/conversations";
import { getRecentMessages } from "@/lib/db/queries/messages";
import { recordJobFailure } from "@/lib/db/queries/usage";
import { SUMMARY_MAX_TOKENS } from "@/lib/agent/budget";
import { logStructuredError } from "@/lib/errors";

const summarizePayloadSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string(),
});

export async function POST(request: Request) {
  const rawBody = await request.text();
  const isAuthorized = await verifyWorkerRequest(request, rawBody);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized worker request" }, { status: 401 });
  }

  let parsedPayload: z.infer<typeof summarizePayloadSchema>;
  try {
    parsedPayload = summarizePayloadSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    return NextResponse.json({ error: "Invalid payload", details: String(err) }, { status: 400 });
  }

  const { conversationId, userId } = parsedPayload;

  try {
    const conv = await getConversation(conversationId, userId);
    if (!conv) {
      return NextResponse.json({ skipped: true, reason: "Conversation not found" });
    }

    // Only summarize if lag is significant
    if (conv.msgCount - conv.summarizedCount < 10) {
      return NextResponse.json({ skipped: true, reason: "Lag < 10" });
    }

    const messages = await getRecentMessages(conversationId, 15);
    if (messages.length === 0) {
      return NextResponse.json({ skipped: true, reason: "No messages to summarize" });
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

    // Compare-and-Set (CAS) on summary_version
    const success = await updateConversationSummaryCas(
      conversationId,
      conv.summaryVersion,
      {
        summary: newSummary,
        summaryUpto: latestMessage?.id ?? conv.summaryUpto,
        summarizedCount: conv.msgCount,
      }
    );

    if (!success) {
      return NextResponse.json({ skipped: true, reason: "CAS race resolved safely" });
    }

    return NextResponse.json({ success: true, summaryVersion: conv.summaryVersion + 1 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStructuredError({
      userId,
      conversationId,
      code: "INTERNAL",
      msg: "Summarize worker failed",
      error: errorMsg,
    });

    await recordJobFailure({
      kind: "chat.summarize",
      payload: parsedPayload,
      error: errorMsg,
      attempts: 1,
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
