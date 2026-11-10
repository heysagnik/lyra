import { sql, gte, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageEvents, jobFailures } from "@/lib/db/schema";
import type { UsageEvent, JobFailure } from "@/types";

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
