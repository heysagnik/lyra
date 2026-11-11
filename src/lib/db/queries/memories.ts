import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { memories } from "@/lib/db/schema";
import type { Memory, MemoryKind } from "@/types";

function toDomainMemory(row: typeof memories.$inferSelect): Memory {
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind as MemoryKind,
    content: row.content,
    confidence: row.confidence,
    sourceConversation: row.sourceConversation,
    contentHash: row.contentHash,
    embedding: row.embedding,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
  };
}

export async function getUserMemories(
  userId: string,
  limit = 5
): Promise<Memory[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(desc(memories.lastUsedAt), desc(memories.confidence))
    .limit(limit);

  return rows.map(toDomainMemory);
}

export async function upsertMemory(data: {
  userId: string;
  kind: MemoryKind;
  content: string;
  confidence?: number;
  sourceConversation?: string;
  contentHash: string;
}): Promise<Memory> {
  const db = getDb();
  const [upserted] = await db
    .insert(memories)
    .values({
      userId: data.userId,
      kind: data.kind,
      content: data.content,
      confidence: data.confidence ?? 0.8,
      sourceConversation: data.sourceConversation,
      contentHash: data.contentHash,
      lastUsedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [memories.userId, memories.contentHash],
      set: {
        confidence: sql`GREATEST(${memories.confidence}, EXCLUDED.confidence)`,
        lastUsedAt: new Date(),
      },
    })
    .returning();

  return toDomainMemory(upserted);
}

export async function touchMemories(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = getDb();
  await db
    .update(memories)
    .set({ lastUsedAt: new Date() })
    .where(inArray(memories.id, ids));
}

export async function deleteMemory(id: string, userId: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(memories)
    .where(and(eq(memories.id, id), eq(memories.userId, userId)))
    .returning({ id: memories.id });

  return deleted.length > 0;
}
