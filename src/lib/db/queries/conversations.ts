import { eq, and, desc, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import type { Conversation } from "@/types";

function toDomainConversation(row: typeof conversations.$inferSelect): Conversation {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    summary: row.summary,
    summaryVersion: row.summaryVersion,
    summaryUpto: row.summaryUpto,
    summarizedCount: row.summarizedCount,
    msgCount: row.msgCount,
    searchDefault: row.searchDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listConversations(
  userId: string,
  limit = 50,
  cursor?: Date
): Promise<Conversation[]> {
  const db = getDb();
  const conditions = [eq(conversations.userId, userId)];

  if (cursor) {
    conditions.push(lt(conversations.updatedAt, cursor));
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);

  return rows.map(toDomainConversation);
}

export async function getConversation(
  id: string,
  userId: string
): Promise<Conversation | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);

  if (!rows[0]) return null;
  return toDomainConversation(rows[0]);
}

export async function createConversation(data: {
  id?: string;
  userId: string;
  title?: string;
  searchDefault?: boolean;
}): Promise<Conversation> {
  const db = getDb();
  const [created] = await db
    .insert(conversations)
    .values({
      id: data.id,
      userId: data.userId,
      title: data.title ?? "New chat",
      searchDefault: data.searchDefault ?? true,
    })
    .returning();

  return toDomainConversation(created);
}

export async function updateConversation(
  id: string,
  userId: string,
  data: Partial<{
    title: string;
    searchDefault: boolean;
    summary: string | null;
    summaryVersion: number;
    summaryUpto: string | null;
    summarizedCount: number;
    msgCount: number;
    updatedAt: Date;
  }>
): Promise<Conversation | null> {
  const db = getDb();
  const [updated] = await db
    .update(conversations)
    .set({
      ...data,
      updatedAt: data.updatedAt ?? new Date(),
    })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();

  if (!updated) return null;
  return toDomainConversation(updated);
}

export async function deleteConversation(
  id: string,
  userId: string
): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });

  return deleted.length > 0;
}

export async function incrementMsgCount(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(conversations)
    .set({
      msgCount: sql`${conversations.msgCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, id));
}

export async function updateConversationSummaryCas(
  id: string,
  expectedVersion: number,
  data: {
    summary: string;
    summaryUpto?: string | null;
    summarizedCount: number;
  }
): Promise<boolean> {
  const db = getDb();
  const updated = await db
    .update(conversations)
    .set({
      summary: data.summary,
      summaryVersion: expectedVersion + 1,
      summaryUpto: data.summaryUpto,
      summarizedCount: data.summarizedCount,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.summaryVersion, expectedVersion)
      )
    )
    .returning({ id: conversations.id });

  return updated.length > 0;
}
