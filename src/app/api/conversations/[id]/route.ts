import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
  getConversation,
  updateConversation,
  deleteConversation,
} from "@/lib/db/queries/conversations";
import { listConversationMessages } from "@/lib/db/queries/messages";

const patchBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  searchDefault: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 401 });
  }

  const { id } = await params;
  const [conversation, messages] = await Promise.all([
    getConversation(id, userResult.value.id),
    listConversationMessages(id),
  ]);

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({
    conversation,
    messages,
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 401 });
  }

  const { id } = await params;
  try {
    const rawBody = await request.json();
    const parsed = patchBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await updateConversation(
      id,
      userResult.value.id,
      parsed.data
    );

    if (!updated) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Malformed request payload" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteConversation(id, userResult.value.id);
  if (!deleted) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
