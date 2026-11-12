"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useCallback, useState, useEffect } from "react";
import type { SearchSource } from "@/types";

export interface ChatMessagePart {
  type: string;
  text?: string;
  data?: unknown;
  toolInvocation?: {
    toolName: string;
    state: string;
    args?: unknown;
  };
  [key: string]: unknown;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts?: ChatMessagePart[];
  sources?: SearchSource[];
  createdAt?: Date;
}

export interface UseAgentChatOptions {
  conversationId?: string;
  searchDefault?: boolean;
  initialMessages?: AgentChatMessage[];
  onConversationCreated?: (id: string, title: string) => void;
}

export function useAgentChat({
  conversationId,
  searchDefault = true,
  initialMessages,
  onConversationCreated,
}: UseAgentChatOptions = {}) {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(
    conversationId
  );
  const [currentSources, setCurrentSources] = useState<SearchSource[]>([]);

  useEffect(() => {
    setActiveConversationId(conversationId);
    setCurrentSources([]);
  }, [conversationId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
      }),
    []
  );

  const {
    messages,
    sendMessage: rawSendMessage,
    status,
    stop,
    error,
    clearError,
    setMessages,
  } = useChat({
    transport,
    onData: (dataPart) => {
      if (typeof dataPart === "object" && dataPart !== null) {
        const part = dataPart as { type?: string; data?: unknown };
        if (part.type === "data-meta" && part.data) {
          const meta = part.data as { conversationId: string; title: string };
          setActiveConversationId(meta.conversationId);
          if (onConversationCreated) {
            onConversationCreated(meta.conversationId, meta.title);
          }
        }
        if (part.type === "data-sources" && part.data) {
          const sourcesData = part.data as { items: SearchSource[] };
          if (Array.isArray(sourcesData.items)) {
            setCurrentSources(sourcesData.items);
          }
        }
      }
    },
  });

  // Sync initial messages when conversation changes. Convert the persisted
  // { content } shape into UIMessage { parts } so mappedMessages can derive
  // text from them.
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      const hydrated = initialMessages.map((m) => {
        const parts: ChatMessagePart[] = [];
        if (m.content) {
          parts.push({ type: "text", text: m.content });
        }
        if (m.sources?.length) {
          parts.push({ type: "data-sources", data: { items: m.sources } });
        }
        return { id: m.id, role: m.role, parts, sources: m.sources };
      });
      setMessages(hydrated as unknown as Parameters<typeof setMessages>[0]);
    }
  }, [initialMessages, setMessages]);

  const sendMessage = useCallback(
    async (
      text: string,
      searchOverride?: boolean,
      modelOverride?: string,
      effortOverride?: "low" | "standard" | "max"
    ) => {
      setCurrentSources([]);
      const search = searchOverride !== undefined ? searchOverride : searchDefault;

      await rawSendMessage(
        { text },
        {
          body: {
            conversationId: activeConversationId,
            message: text,
            search,
            ...(modelOverride ? { model: modelOverride } : {}),
            ...(effortOverride ? { effort: effortOverride } : {}),
          },
        }
      );
    },
    [rawSendMessage, activeConversationId, searchDefault]
  );

  const isStreaming = status === "streaming" || status === "submitted";

  const mappedMessages = useMemo(() => {
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        lastAssistantIdx = i;
        break;
      }
    }

    return messages.map((m, idx) => {
      let sources: SearchSource[] | undefined;
      const parts = (m.parts as ChatMessagePart[] | undefined) || [];

      const textContent = parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("");

      for (const p of parts) {
        if (p.type === "data-sources" && p.data) {
          const s = (p.data as { items?: SearchSource[] }).items;
          if (Array.isArray(s)) sources = s;
        }
        if (p.type.startsWith("tool-") && (p as { output?: unknown }).output) {
          const out = (p as { output?: { sources?: SearchSource[] } }).output;
          if (Array.isArray(out?.sources)) sources = out.sources;
        }
      }

      if (!sources && (m as unknown as { sources?: SearchSource[] }).sources?.length) {
        sources = (m as unknown as { sources?: SearchSource[] }).sources;
      }

      const fallbackSources =
        !sources && idx === lastAssistantIdx && m.role === "assistant" && currentSources.length > 0
          ? currentSources
          : undefined;

      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: textContent,
        parts,
        sources: sources || fallbackSources,
      };
    });
  }, [messages, currentSources]);

  return {
    conversationId: activeConversationId,
    messages: mappedMessages,
    sendMessage,
    status,
    isStreaming,
    stop,
    error,
    clearError,
    activeSources: currentSources,
  };
}
