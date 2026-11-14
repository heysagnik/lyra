import {
  pruneOldUsageEvents,
  recordJobFailure,
  rollupDailyUsage,
} from "@/lib/db/queries/usage";

export interface UsageMaintenanceRunner {
  run: typeof runUsageMaintenance;
}

let testRunnerOverride: UsageMaintenanceRunner | null = null;

export function setUsageMaintenanceForTesting(override: UsageMaintenanceRunner | null) {
  testRunnerOverride = override;
}

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

/** Scheduled wrapper — records failures to the job_failures DLQ. */
export async function executeUsageMaintenanceTask(now = new Date()): Promise<void> {
  try {
    const runner = testRunnerOverride?.run || runUsageMaintenance;
    await runner(now);
  } catch (error) {
    try {
      await recordJobFailure({
        kind: "usage_maintenance",
        payload: { scheduledAt: now.toISOString() },
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // DLQ write failed — nothing further to do in-process
    }
  }
}

/** Process-lifecycle guard so hot reloads / multiple imports start one loop. */
const MAINTENANCE_STARTED = Symbol.for("lyra.usageMaintenanceLoop");
type MaintenanceGlobal = typeof globalThis & { [MAINTENANCE_STARTED]?: boolean };

/**
 * Start the nightly loop: first tick at the next UTC midnight, then every
 * 24 hours (re-anchored each tick). In-process by design (zero external
 * schedulers per AGENT.md). Timers are unref'd so they never hold the
 * process open on their own.
 */
export function startUsageMaintenanceLoop(): void {
  const g = globalThis as MaintenanceGlobal;
  if (g[MAINTENANCE_STARTED]) return;
  g[MAINTENANCE_STARTED] = true;

  const scheduleNext = () => {
    const now = new Date();
    const next = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const t = setTimeout(tickAndReschedule, Math.max(0, next.getTime() - now.getTime()));
    t.unref?.();
  };

  const tickAndReschedule = () => {
    void executeUsageMaintenanceTask();
    scheduleNext();
  };

  scheduleNext();
}
