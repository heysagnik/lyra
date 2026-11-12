import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getUserUsageStats } from "@/lib/db/queries/usage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userResult = await requireUser(request);
  if (!userResult.ok) {
    return NextResponse.json({ error: userResult.error.message }, { status: 401 });
  }

  try {
    const stats = await getUserUsageStats(userResult.value.id);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load usage statistics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
