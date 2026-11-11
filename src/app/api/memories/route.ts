import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getUserMemories } from "@/lib/db/queries/memories";

export async function GET(request: Request) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 401 });
  }
  const memories = await getUserMemories(userResult.value.id, 100);
  return NextResponse.json({ memories });
}
