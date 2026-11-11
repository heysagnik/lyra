import { WINDOW_MESSAGES } from "./budget";
import { assembleSystemPrompt } from "./prompt";
import { getConversation } from "@/lib/db/queries/conversations";
import { getRecentMessages } from "@/lib/db/queries/messages";
import { getUserMemories, touchMemories } from "@/lib/db/queries/memories";
import type { Message } from "@/types";

const MEMORY_MAX_ITEMS = 10;

export interface AssembledContext {
  systemPrompt: string;
  window: Array<{ role: "user" | "assistant"; content: string }>;
  conversationTitle?: string;
  searchDefault: boolean;
}

export async function assemblePromptContext(
  userId: string,
  conversationId?: string,
  searchEnabled?: boolean
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

  const effectiveSearch = searchEnabled ?? searchDefault;
  const memories = await getUserMemories(userId, MEMORY_MAX_ITEMS);
  if (memories.length > 0) {
    void touchMemories(memories.map((m) => m.id));
  }
  const systemPrompt = assembleSystemPrompt(memories, summary, effectiveSearch);

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
