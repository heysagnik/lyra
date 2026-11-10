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
      // Capture custom UI stream data parts
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

  // Sync initial messages when conversation changes
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages as unknown as Parameters<typeof setMessages>[0]);
    }
  }, [initialMessages, setMessages]);

  const sendMessage = useCallback(
    async (text: string, searchOverride?: boolean) => {
      const search = searchOverride !== undefined ? searchOverride : searchDefault;
      setCurrentSources([]);

      await rawSendMessage(
        { text },
        {
          body: {
            conversationId: activeConversationId,
            message: text,
            search,
          },
        }
      );
    },
    [rawSendMessage, activeConversationId, searchDefault]
  );

  const isStreaming = status === "streaming" || status === "submitted";

  const mappedMessages = useMemo(() => {
    return messages.map((m) => {
      let sources: SearchSource[] | undefined;
      const parts = (m.parts as ChatMessagePart[] | undefined) || [];

      // Extract text content from parts
      const textContent = parts
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("");

      // Extract sources from parts if present
      for (const p of parts) {
        if (p.type === "data-sources" && p.data) {
          const s = (p.data as { items?: SearchSource[] }).items;
          if (Array.isArray(s)) sources = s;
        }
      }

      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: textContent,
        parts,
        sources: sources || (m.role === "assistant" ? currentSources : undefined),
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
