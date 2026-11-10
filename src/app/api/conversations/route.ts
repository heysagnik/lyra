import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { listConversations } from "@/lib/db/queries/conversations";

export async function GET(request: Request) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
  const cursorParam = searchParams.get("cursor");
  const cursor = cursorParam ? new Date(cursorParam) : undefined;

  const conversations = await listConversations(userResult.value.id, limit, cursor);
  return NextResponse.json(conversations);
}
