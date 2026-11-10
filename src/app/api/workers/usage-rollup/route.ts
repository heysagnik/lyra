import { NextResponse } from "next/server";
import { verifyWorkerRequest } from "@/lib/queue/verify";
import {
  rollupDailyUsage,
  pruneOldUsageEvents,
  recordJobFailure,
} from "@/lib/db/queries/usage";
import { logStructuredError } from "@/lib/errors";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const isAuthorized = await verifyWorkerRequest(request, rawBody);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized worker request" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // 1. Rollup usage for today and yesterday
    await rollupDailyUsage(today);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    await rollupDailyUsage(yesterday);

    // 2. Prune old events >90 days
    const prunedCount = await pruneOldUsageEvents(90);

    return NextResponse.json({
      success: true,
      day: today,
      prunedCount,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logStructuredError({
      code: "INTERNAL",
      msg: "Usage rollup worker failed",
      error: errorMsg,
    });

    await recordJobFailure({
      kind: "usage.rollup",
      payload: { day: today },
      error: errorMsg,
      attempts: 1,
    });

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
