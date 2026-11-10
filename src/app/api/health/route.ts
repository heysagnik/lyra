import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";
import { countJobFailures } from "@/lib/db/queries/usage";

export async function GET() {
  const dbOk = await pingDb();
  let recentFailures = 0;

  if (dbOk) {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      recentFailures = await countJobFailures(twentyFourHoursAgo);
    } catch {
      recentFailures = 0;
    }
  }

  const isHealthy = dbOk;

  return NextResponse.json(
    {
      ok: isHealthy,
      status: isHealthy ? "healthy" : "degraded",
      db: dbOk,
      recentFailures24h: recentFailures,
      timestamp: new Date().toISOString(),
    },
    { status: isHealthy ? 200 : 503 }
  );
}
