import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  numeric,
  bigserial,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  customType,
  date,
} from "drizzle-orm/pg-core";

/**
 * Better Auth Core Tables
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Custom vector type for pgvector embedding column (NULL in v1, reserved for v1.1)
 */
export const vector768 = customType<{ data: number[] | null }>({
  dataType() {
    return "vector(768)";
  },
});

/**
 * Conversations table
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    summary: text("summary"),
    summaryVersion: integer("summary_version").notNull().default(0),
    summaryUpto: uuid("summary_upto"),
    summarizedCount: integer("summarized_count").notNull().default(0),
    msgCount: integer("msg_count").notNull().default(0),
    searchDefault: boolean("search_default").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt.desc()),
  ]
);

/**
 * Messages table — append-only event log. Never update or delete rows directly.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
    content: text("content").notNull().default(""),
    toolCalls: jsonb("tool_calls"),
    sources: jsonb("sources"),
    model: text("model"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("messages_conv_created_idx").on(table.conversationId, table.createdAt.desc()),
  ]
);

/**
 * Memories table — T1 durable user memory (survives conversation delete)
 */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["fact", "preference", "correction"] }).notNull(),
    content: text("content").notNull(),
    confidence: real("confidence").notNull().default(0.8),
    sourceConversation: uuid("source_conversation").references(
      () => conversations.id,
      { onDelete: "set null" }
    ),
    contentHash: text("content_hash").notNull(),
    embedding: vector768("embedding"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("memories_user_hash_idx").on(table.userId, table.contentHash),
    index("memories_user_last_used_idx").on(table.userId, table.lastUsedAt.desc()),
  ]
);

/**
 * Usage events table — written inline per turn; rolled up nightly
 */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull(),
    conversationId: uuid("conversation_id"),
    model: text("model"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    cachedIn: integer("cached_in"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("usage_events_user_created_idx").on(table.userId, table.createdAt.desc()),
  ]
);

/**
 * Usage daily table — rollup target (nightly job)
 */
export const usageDaily = pgTable(
  "usage_daily",
  {
    day: date("day").notNull(),
    userId: text("user_id").notNull(),
    turns: integer("turns").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4 }).notNull().default("0"),
  },
  (table) => [primaryKey({ columns: [table.day, table.userId] })]
);

/**
 * Job failures table — dead-letter audit, surfaced in /api/health
 */
export const jobFailures = pgTable("job_failures", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  error: text("error"),
  attempts: integer("attempts"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
