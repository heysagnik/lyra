import { pruneOldUsageEvents, rollupDailyUsage } from "@/lib/db/queries/usage";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Nightly usage maintenance:
 *   1. Roll raw usage_events into the usage_daily rollup table for
 *      yesterday and today (idempotent upsert — covers the UTC boundary).
 *   2. Prune raw events older than the 90-day retention window.
 *
 * The rate limiter counts a user's events per day; without the prune the
 * usage_events table grows forever and every turn's checks degrade.
 */
export async function runUsageMaintenance(now = new Date()): Promise<{
  rolledUp: string[];
  pruned: number;
}> {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const targets = [isoDay(yesterday), isoDay(now)];
  for (const day of targets) {
    await rollupDailyUsage(day);
  }
  const pruned = await pruneOldUsageEvents(90);
  return { rolledUp: targets, pruned };
}
