import { getDb } from "./index";
import { user, conversations, messages, memories, usageEvents } from "./schema";

export async function seedDevData() {
  const db = getDb();

  const testUserId = "00000000-0000-0000-0000-000000000001";

  // Upsert test user
  await db
    .insert(user)
    .values({
      id: testUserId,
      name: "Dev User",
      email: "dev@lyra.local",
      emailVerified: true,
    })
    .onConflictDoNothing();

  // Create test conversation
  const [conv] = await db
    .insert(conversations)
    .values({
      userId: testUserId,
      title: "Welcome to lyra",
      searchDefault: true,
      msgCount: 2,
    })
    .returning();

  if (conv) {
    // Add user message
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "user",
      content: "Hello! Who are you?",
    });

    // Add assistant response
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "assistant",
      content:
        "I am Lyra, a helpful, direct assistant with access to live web search.",
      model: "qwen/qwen3.8-27b",
      tokensIn: 45,
      tokensOut: 20,
      latencyMs: 120,
    });
  }

  // Add test memory
  await db
    .insert(memories)
    .values({
      userId: testUserId,
      kind: "preference",
      content: "Prefers concise technical answers in markdown.",
      confidence: 0.95,
      contentHash: "hash_dev_user_pref_001",
    })
    .onConflictDoNothing();

  // Add test usage event
  await db.insert(usageEvents).values({
    userId: testUserId,
    model: "qwen/qwen3.8-27b",
    tokensIn: 45,
    tokensOut: 20,
    cachedIn: 0,
    costUsd: "0.000010",
  });

  return { success: true, userId: testUserId };
}
