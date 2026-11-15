import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { hasChannelMarkers, splitChannelText } from "@/lib/llm/channels";
import type { Message, Role, SearchSource } from "@/types";

function toDomainMessage(row: typeof messages.$inferSelect): Message {
  // Legacy rows persisted before channel-aware persistence may still carry
  // Nemotron/harmony reasoning tokens inline in content. Split them at read
  // time so the UI never renders raw tokens, regardless of when the row was
  // written.
  const split = hasChannelMarkers(row.content) ? splitChannelText(row.content) : null;
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as Role,
    content: split ? split.content || row.content : row.content,
    reasoning: row.reasoning ?? (split?.reasoning || null),
    toolCalls: row.toolCalls,
    sources: (row.sources as SearchSource[] | null) ?? null,
    model: row.model,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    latencyMs: row.latencyMs,
    createdAt: row.createdAt,
  };
}

export async function createMessage(data: {
  id?: string;
  conversationId: string;
  role: Role;
  content: string;
  reasoning?: string;
  toolCalls?: unknown;
  sources?: SearchSource[];
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
}): Promise<Message> {
  const db = getDb();
  const [created] = await db
    .insert(messages)
    .values({
      id: data.id,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      reasoning: data.reasoning ?? null,
      toolCalls: data.toolCalls,
      sources: data.sources,
      model: data.model,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      latencyMs: data.latencyMs,
    })
    .returning();

  return toDomainMessage(created);
}

export async function getRecentMessages(
  conversationId: string,
  limit = 10
): Promise<Message[]> {
  const db = getDb();
  // Fetch latest N messages ordered by createdAt desc, then return them in chronological asc order
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse().map(toDomainMessage);
}

export async function listConversationMessages(
  conversationId: string,
  limit = 100
): Promise<Message[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.reverse().map(toDomainMessage);
}
