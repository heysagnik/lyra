import type { Conversation, Message } from "@/types";

export interface ConversationWithMessages {
  conversation: Conversation;
  messages: Message[];
}

export async function fetchConversations(cursor?: string): Promise<Conversation[]> {
  const url = cursor
    ? `/api/conversations?cursor=${encodeURIComponent(cursor)}`
    : "/api/conversations";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversations: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchConversation(
  id: string
): Promise<ConversationWithMessages> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversation: ${res.statusText}`);
  }
  return res.json();
}

export async function updateConversationApi(
  id: string,
  data: { title?: string; searchDefault?: boolean }
): Promise<Conversation> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to update conversation: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteConversationApi(id: string): Promise<void> {
  const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete conversation: ${res.statusText}`);
  }
}
