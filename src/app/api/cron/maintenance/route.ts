import { NextResponse } from "next/server";
import { runUsageMaintenance } from "@/lib/queue/maintenance";
import { recordJobFailure } from "@/lib/db/queries/usage";

export const maxDuration = 60;

/**
 * Daily usage maintenance (roll up usage_events, prune old rows), triggered by
 * the Vercel cron in vercel.json. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runUsageMaintenance();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await recordJobFailure({
        kind: "usage_maintenance",
        payload: { scheduledAt: new Date().toISOString() },
        error: message,
      });
    } catch {}
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
