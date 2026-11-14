import { sql, and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";
import {
  RATE_PER_MIN,
  RATE_PER_DAY,
  MAX_INFLIGHT,
  MODEL_OTPM_LIMITS,
  OTPM_SAFETY_MARGIN,
  OTPM_RESERVATION_TTL_MS,
} from "@/lib/agent/budget";

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
 * - 20 requests per day (UTC day ceiling)
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

// ─── Output Tokens Per Minute (OTPM) budget ─────────────────────────────
// Groq's free tier enforces an account-wide OTPM ceiling per model (shared
// by every user of the app, since all turns use the same API key). When a
// burst of turns exhausts it, the provider starts returning 429s, retries
// fail, and the turn ends with no text at all — the "dead turn" failure.
// This gate prevents that: a turn must reserve its output-token ceiling
// against (a) the rolling 60s sum of tokens_out recorded in usage_events
// plus (b) reservations held by in-flight turns, before it may start.

interface OtpmReservation {
  tokens: number;
  reservedAt: number;
  expiresAt: number;
}

const otpmReservations = new Map<string, OtpmReservation[]>();

function pruneExpiredReservations(model: string): number {
  const now = Date.now();
  const active = (otpmReservations.get(model) || []).filter(
    (r) => r.expiresAt > now
  );
  if (active.length > 0) {
    otpmReservations.set(model, active);
  } else {
    otpmReservations.delete(model);
  }
  return active.reduce((sum, r) => sum + r.tokens, 0);
}

function releaseReservation(model: string, reservedAt: number): void {
  const active = (otpmReservations.get(model) || []).filter(
    (r) => r.reservedAt !== reservedAt || r.expiresAt <= Date.now()
  );
  if (active.length > 0) {
    otpmReservations.set(model, active);
  } else {
    otpmReservations.delete(model);
  }
}

/**
 * Rolling 60s sum of output tokens recorded in usage_events for a model
 * (all users — the provider quota is account-wide).
 */
async function sumRecentOutputTokens(
  model: string
): Promise<{ total: number; oldestAt: number | null }> {
  try {
    const db = getDb();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${usageEvents.tokensOut}), 0)::int`,
        oldestAt: sql<Date | null>`MIN(${usageEvents.createdAt})`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.model, model),
          gte(usageEvents.createdAt, oneMinuteAgo)
        )
      );
    return {
      total: row?.total ?? 0,
      oldestAt: row?.oldestAt ? new Date(row.oldestAt).getTime() : null,
    };
  } catch {
    // DB unavailable → degrade open, same policy as the request limiter.
    return { total: 0, oldestAt: null };
  }
}

/**
 * Reserve output-token budget for one turn of `maxTokensOut` tokens on
 * `model`. Denies (ok: false, retryAfter) when the rolling 60s usage plus
 * in-flight reservations plus this turn's ceiling would exceed the
 * provider's OTPM limit (minus a safety margin). The returned release()
 * must be called when the turn ends; usage is recorded in usage_events
 * before release so the window stays accurate.
 */
export async function acquireOutputTokenBudget(
  model: string,
  maxTokensOut: number
): Promise<RateLimitDecision> {
  const limit = MODEL_OTPM_LIMITS[model];
  if (!limit) {
    return { ok: true, release: async () => {} };
  }
  const usable = limit - OTPM_SAFETY_MARGIN;

  const reserved = pruneExpiredReservations(model);
  const { total: used, oldestAt } = await sumRecentOutputTokens(model);

  if (used + reserved + maxTokensOut > usable) {
    const now = Date.now();
    const windowReset = oldestAt ? oldestAt + 60 * 1000 : now + 30 * 1000;
    const reservationReset = now + OTPM_RESERVATION_TTL_MS;
    const retryAfterMs = Math.min(windowReset, reservationReset) - now;
    return {
      ok: false,
      retryAfter: Math.min(60, Math.max(5, Math.ceil(retryAfterMs / 1000))),
    };
  }

  const reservedAt = Date.now();
  const list = otpmReservations.get(model) || [];
  list.push({
    tokens: maxTokensOut,
    reservedAt,
    expiresAt: reservedAt + OTPM_RESERVATION_TTL_MS,
  });
  otpmReservations.set(model, list);

  return {
    ok: true,
    release: async () => {
      releaseReservation(model, reservedAt);
    },
  };
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
