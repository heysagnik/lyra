import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { verifyWorkerRequest } from "@/lib/queue/verify";
import { extractMemoriesWithLlm } from "@/lib/agent/llm";
import { getRecentMessages } from "@/lib/db/queries/messages";
import { upsertMemory } from "@/lib/db/queries/memories";
import { recordJobFailure } from "@/lib/db/queries/usage";
import { logStructuredError } from "@/lib/errors";

const distillPayloadSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string(),
});

const extractedMemoriesSchema = z.object({
  memories: z.array(
    z.object({
      kind: z.enum(["fact", "preference", "correction"]),
      content: z.string().min(5).max(300),
      confidence: z.number().min(0.5).max(1.0),
    })
  ),
});

export async function POST(request: Request) {
  const rawBody = await request.text();
  const isAuthorized = await verifyWorkerRequest(request, rawBody);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized worker request" }, { status: 401 });
  }

  let parsedPayload: z.infer<typeof distillPayloadSchema>;
  try {
    parsedPayload = distillPayloadSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    return NextResponse.json({ error: "Invalid payload", details: String(err) }, { status: 400 });
  }

  const { conversationId, userId } = parsedPayload;

  try {
    const recent = await getRecentMessages(conversationId, 4);
    if (recent.length === 0) {
      return NextResponse.json({ skipped: true, reason: "No messages to distill" });
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
      // Degrade gracefully if distillation generation fails
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

    return NextResponse.json({ success: true, count: savedCount });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStructuredError({
      userId,
      conversationId,
      code: "INTERNAL",
      msg: "Distill worker failed",
      error: errorMsg,
    });

    await recordJobFailure({
      kind: "chat.distill",
      payload: parsedPayload,
      error: errorMsg,
      attempts: 1,
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
