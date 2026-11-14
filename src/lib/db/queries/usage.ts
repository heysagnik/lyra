import { sql, gte, desc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageEvents, jobFailures } from "@/lib/db/schema";
import { RATE_PER_MIN, MAX_INFLIGHT, resolveDailyRate } from "@/lib/agent/budget";
import { getUserPlan } from "@/lib/db/queries/users";
import type { UsageEvent, JobFailure } from "@/types";

export interface UserUsageStats {
  plan: "free" | "pro";
  today: {
    turns: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    remainingDailyTurns: number;
    dailyLimit: number;
    percentUsed: number;
  };
  rateLimits: {
    perMinute: number;
    perDay: number;
    maxInflight: number;
  };
  recentEvents: Array<{
    id: number;
    conversationId: string | null;
    model: string | null;
    tokensIn: number | null;
    tokensOut: number | null;
    costUsd: string | null;
    createdAt: Date;
  }>;
}

export async function recordUsageEvent(data: {
  userId: string;
  conversationId?: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  cachedIn?: number;
  costUsd?: string;
}): Promise<UsageEvent> {
  const db = getDb();
  const [created] = await db
    .insert(usageEvents)
    .values({
      userId: data.userId,
      conversationId: data.conversationId,
      model: data.model,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      cachedIn: data.cachedIn,
      costUsd: data.costUsd,
    })
    .returning();

  return {
    id: created.id,
    userId: created.userId,
    conversationId: created.conversationId,
    model: created.model,
    tokensIn: created.tokensIn,
    tokensOut: created.tokensOut,
    cachedIn: created.cachedIn,
    costUsd: created.costUsd,
    createdAt: created.createdAt,
  };
}

export async function rollupDailyUsage(day: string): Promise<void> {
  const db = getDb();
  // Aggregate from usageEvents for given date into usageDaily
  await db.execute(sql`
    INSERT INTO usage_daily (day, user_id, turns, tokens_in, tokens_out, cost_usd)
    SELECT
      ${day}::date,
      user_id,
      COUNT(*)::int as turns,
      COALESCE(SUM(tokens_in), 0)::int as tokens_in,
      COALESCE(SUM(tokens_out), 0)::int as tokens_out,
      COALESCE(SUM(cost_usd::numeric), 0)::numeric(10,4) as cost_usd
    FROM usage_events
    WHERE created_at::date = ${day}::date
    GROUP BY user_id
    ON CONFLICT (day, user_id) DO UPDATE SET
      turns = EXCLUDED.turns,
      tokens_in = EXCLUDED.tokens_in,
      tokens_out = EXCLUDED.tokens_out,
      cost_usd = EXCLUDED.cost_usd;
  `);
}

export async function pruneOldUsageEvents(retentionDays = 90): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(usageEvents)
    .where(sql`${usageEvents.createdAt} < ${cutoff}`)
    .returning({ id: usageEvents.id });

  return deleted.length;
}

export async function recordJobFailure(data: {
  kind: string;
  payload: unknown;
  error?: string;
  attempts?: number;
}): Promise<JobFailure> {
  const db = getDb();
  const [created] = await db
    .insert(jobFailures)
    .values({
      kind: data.kind,
      payload: data.payload,
      error: data.error,
      attempts: data.attempts,
    })
    .returning();

  return {
    id: created.id,
    kind: created.kind,
    payload: created.payload,
    error: created.error,
    attempts: created.attempts,
    createdAt: created.createdAt,
  };
}

export async function countJobFailures(since: Date): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobFailures)
    .where(gte(jobFailures.createdAt, since));

  return rows[0]?.count ?? 0;
}

export async function getRecentJobFailures(
  limit = 20
): Promise<JobFailure[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(jobFailures)
    .orderBy(desc(jobFailures.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: r.payload,
    error: r.error,
    attempts: r.attempts,
    createdAt: r.createdAt,
  }));
}

export async function getUserUsageStats(userId: string): Promise<UserUsageStats> {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  // Aggregate today's usage from usageEvents
  const todayAgg = await db
    .select({
      turns: sql<number>`COUNT(*)::int`,
      tokensIn: sql<number>`COALESCE(SUM(${usageEvents.tokensIn}), 0)::int`,
      tokensOut: sql<number>`COALESCE(SUM(${usageEvents.tokensOut}), 0)::int`,
      costUsd: sql<string>`COALESCE(SUM(${usageEvents.costUsd}::numeric), 0)::text`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        gte(usageEvents.createdAt, startOfDay)
      )
    );

  const turnsToday = todayAgg[0]?.turns ?? 0;
  const tokensInToday = todayAgg[0]?.tokensIn ?? 0;
  const tokensOutToday = todayAgg[0]?.tokensOut ?? 0;
  const costUsdToday = parseFloat(todayAgg[0]?.costUsd ?? "0");
  const plan = await getUserPlan(userId);
  const dailyLimit = resolveDailyRate(plan);
  const remainingDailyTurns = Math.max(0, dailyLimit - turnsToday);
  const percentUsed = Math.min(100, Math.round((turnsToday / dailyLimit) * 100));

  const recentRows = await db
    .select()
    .from(usageEvents)
    .where(eq(usageEvents.userId, userId))
    .orderBy(desc(usageEvents.createdAt))
    .limit(20);

  return {
    plan,
    today: {
      turns: turnsToday,
      tokensIn: tokensInToday,
      tokensOut: tokensOutToday,
      costUsd: costUsdToday,
      remainingDailyTurns,
      dailyLimit,
      percentUsed,
    },
    rateLimits: {
      perMinute: RATE_PER_MIN,
      perDay: dailyLimit,
      maxInflight: MAX_INFLIGHT,
    },
    recentEvents: recentRows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      model: r.model,
      tokensIn: r.tokensIn,
      tokensOut: r.tokensOut,
      costUsd: r.costUsd,
      createdAt: r.createdAt,
    })),
  };
}
