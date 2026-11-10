import { WINDOW_MESSAGES } from "./budget";
import { assembleSystemPrompt } from "./prompt";
import { getConversation } from "@/lib/db/queries/conversations";
import { getRecentMessages } from "@/lib/db/queries/messages";
import { getUserMemories } from "@/lib/db/queries/memories";
import type { Message } from "@/types";

export interface AssembledContext {
  systemPrompt: string;
  window: Array<{ role: "user" | "assistant"; content: string }>;
  conversationTitle?: string;
  searchDefault: boolean;
}

export async function assemblePromptContext(
  userId: string,
  conversationId?: string
): Promise<AssembledContext> {
  let summary: string | null = null;
  let title: string | undefined;
  let searchDefault = true;
  let recentMessages: Message[] = [];

  if (conversationId) {
    const conv = await getConversation(conversationId, userId);
    if (conv) {
      summary = conv.summary;
      title = conv.title;
      searchDefault = conv.searchDefault;
    }
    recentMessages = await getRecentMessages(conversationId, WINDOW_MESSAGES);
  }

  const memories = await getUserMemories(userId, 5);
  const systemPrompt = assembleSystemPrompt(memories, summary);

  const window = recentMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  return {
    systemPrompt,
    window,
    conversationTitle: title,
    searchDefault,
  };
}
