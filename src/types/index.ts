/**
 * Domain types for Lyra chat agent.
 */

export type Role = "user" | "assistant" | "tool";

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  summaryVersion: number;
  summaryUpto: string | null;
  summarizedCount: number;
  msgCount: number;
  searchDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  toolCalls?: unknown | null;
  sources?: SearchSource[] | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs?: number | null;
  createdAt: Date;
}

export type MemoryKind = "fact" | "preference" | "correction";

export interface Memory {
  id: string;
  userId: string;
  kind: MemoryKind;
  content: string;
  confidence: number;
  sourceConversation?: string | null;
  contentHash: string;
  embedding?: number[] | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
}

export interface UsageEvent {
  id: number;
  userId: string;
  conversationId?: string | null;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  cachedIn?: number | null;
  costUsd?: string | null;
  createdAt: Date;
}

export interface UsageDaily {
  day: string;
  userId: string;
  turns: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: string;
}

export interface JobFailure {
  id: number;
  kind: string;
  payload: unknown;
  error?: string | null;
  attempts?: number | null;
  createdAt: Date;
}

export interface TurnInput {
  conversationId?: string;
  text: string;
  search?: boolean;
  /** Which configured Groq model to use for the turn. */
  model?: "primary" | "fallback";
  /** Effort tier controlling tool iterations and output ceiling. */
  effort?: "low" | "standard" | "max";
}

export interface TurnFinishUsage {
  tokensIn: number;
  tokensOut: number;
  cachedIn: number;
}

export interface TurnFinishMeta {
  messageId: string;
  usage: TurnFinishUsage;
  model: string;
  latencyMs: number;
}
