import { sql, and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";
import { RATE_PER_MIN, RATE_PER_DAY, MAX_INFLIGHT } from "@/lib/agent/budget";

export interface RateLimitDecision {
  ok: boolean;
  retryAfter?: number;
  release?: () => Promise<void>;
}

let testLimitersOverride: {
  minLimiter: { limit: (id: string) => Promise<{ success: boolean; reset: number }> };
  dayLimiter: { limit: (id: string) => Promise<{ success: boolean; reset: number }> };
} | null = null;

export function setLimitersForTesting(override: typeof testLimitersOverride) {
  testLimitersOverride = override;
}

// In-memory tracking for in-flight requests per user with automatic TTL lease recovery
interface InFlightLease {
  count: number;
  lastActive: number;
}

const INFLIGHT_LEASE_TTL_MS = 120_000; // 2 minutes auto-recovery
const inFlightLeases = new Map<string, InFlightLease>();

function getActiveInFlight(userId: string): number {
  const lease = inFlightLeases.get(userId);
  if (!lease) return 0;
  if (Date.now() - lease.lastActive > INFLIGHT_LEASE_TTL_MS) {
    inFlightLeases.delete(userId);
    return 0;
  }
  return lease.count;
}

function incrementInFlight(userId: string): void {
  const current = getActiveInFlight(userId);
  inFlightLeases.set(userId, { count: current + 1, lastActive: Date.now() });
}

function decrementInFlight(userId: string): void {
  const lease = inFlightLeases.get(userId);
  if (!lease || lease.count <= 1) {
    inFlightLeases.delete(userId);
  } else {
    inFlightLeases.set(userId, { count: lease.count - 1, lastActive: Date.now() });
  }
}

/**
 * Check rate limits directly against the Postgres usage_events table:
 * - 20 requests per minute (sliding window)
 * - 300 requests per day (UTC day ceiling)
 */
async function checkUsageEventsRateLimit(
  userId: string
): Promise<{ ok: boolean; retryAfter?: number }> {
  try {
    const db = getDb();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [row] = await db
      .select({
        countMin: sql<number>`COUNT(*) FILTER (WHERE ${usageEvents.createdAt} >= ${oneMinuteAgo})::int`,
        countDay: sql<number>`COUNT(*)::int`,
        oldestInMin: sql<Date | null>`MIN(${usageEvents.createdAt}) FILTER (WHERE ${usageEvents.createdAt} >= ${oneMinuteAgo})`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, userId),
          gte(usageEvents.createdAt, startOfDay)
        )
      );

    const turnsInMin = row?.countMin ?? 0;
    const turnsInDay = row?.countDay ?? 0;

    if (turnsInMin >= RATE_PER_MIN) {
      const oldest = row?.oldestInMin ? new Date(row.oldestInMin).getTime() : Date.now();
      const retryAfter = Math.max(1, Math.ceil((oldest + 60 * 1000 - Date.now()) / 1000));
      return { ok: false, retryAfter };
    }

    if (turnsInDay >= RATE_PER_DAY) {
      const nextDay = new Date(startOfDay.getTime() + 86400 * 1000).getTime();
      const retryAfter = Math.max(1, Math.ceil((nextDay - Date.now()) / 1000));
      return { ok: false, retryAfter };
    }

    return { ok: true };
  } catch {
    // If DB check fails, degrade gracefully
    return { ok: true };
  }
}

export async function checkRateLimits(userId: string): Promise<RateLimitDecision> {
  // 1. Check in-flight concurrency cap (MAX_INFLIGHT = 2)
  const currentInFlight = getActiveInFlight(userId);
  if (currentInFlight >= MAX_INFLIGHT) {
    return {
      ok: false,
      retryAfter: 2,
    };
  }
  incrementInFlight(userId);

  const release = async () => decrementInFlight(userId);

  // 2. Testing override path
  if (testLimitersOverride) {
    const [minRes, dayRes] = await Promise.all([
      testLimitersOverride.minLimiter.limit(userId),
      testLimitersOverride.dayLimiter.limit(userId),
    ]);

    if (!minRes.success) {
      decrementInFlight(userId);
      const retryAfter = Math.ceil((minRes.reset - Date.now()) / 1000);
      return { ok: false, retryAfter: Math.max(1, retryAfter) };
    }

    if (!dayRes.success) {
      decrementInFlight(userId);
      const retryAfter = Math.ceil((dayRes.reset - Date.now()) / 1000);
      return { ok: false, retryAfter: Math.max(1, retryAfter) };
    }

    return {
      ok: true,
      release,
    };
  }

  // 3. Postgres usage_events based rate limiting
  const dbDecision = await checkUsageEventsRateLimit(userId);
  if (!dbDecision.ok) {
    decrementInFlight(userId);
    return {
      ok: false,
      retryAfter: dbDecision.retryAfter ?? 1,
    };
  }

  return {
    ok: true,
    release,
  };
}
