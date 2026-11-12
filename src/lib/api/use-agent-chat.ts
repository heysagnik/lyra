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
  toolCalls?: unknown | null;
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
  const [sourcesByMsgId, setSourcesByMsgId] = useState<Record<string, SearchSource[]>>({});

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
          if (Array.isArray(sourcesData.items) && sourcesData.items.length > 0) {
            setCurrentSources(sourcesData.items);
            setMessages((prev) => {
              const lastAssist = [...prev].reverse().find((m) => m.role === "assistant");
              if (lastAssist?.id) {
                setSourcesByMsgId((s) => ({ ...s, [lastAssist.id]: sourcesData.items }));
              }
              return prev;
            });
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
      const initialMap: Record<string, SearchSource[]> = {};
      const hydrated = initialMessages.map((m) => {
        const parts: ChatMessagePart[] = [];
        if (m.content) {
          parts.push({ type: "text", text: m.content });
        }
        if (m.sources?.length) {
          parts.push({ type: "data-sources", data: { items: m.sources } });
          initialMap[m.id] = m.sources;
        }
        return {
          id: m.id,
          role: m.role,
          parts,
          sources: m.sources,
          toolCalls: m.toolCalls,
          createdAt: m.createdAt,
        };
      });
      setSourcesByMsgId((prev) => ({ ...prev, ...initialMap }));
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
      // Freeze any active sources into the last assistant message before clearing
      if (currentSources.length > 0) {
        setMessages((prev) => {
          const lastAssist = [...prev].reverse().find((m) => m.role === "assistant");
          if (lastAssist?.id) {
            setSourcesByMsgId((s) => ({ ...s, [lastAssist.id]: currentSources }));
          }
          return prev;
        });
      }
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
    [rawSendMessage, activeConversationId, searchDefault, currentSources, setMessages]
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

      const textContent =
        parts
          .filter((p) => p.type === "text" && typeof p.text === "string")
          .map((p) => p.text)
          .join("") ||
        (typeof (m as unknown as { content?: string }).content === "string"
          ? (m as unknown as { content?: string }).content!
          : "");

      for (const p of parts) {
        if (p.type === "data-sources" && p.data) {
          const s = (p.data as { items?: SearchSource[] }).items;
          if (Array.isArray(s) && s.length > 0) sources = s;
        }
        if (p.type.startsWith("tool-") && (p as { output?: unknown }).output) {
          const out = (p as { output?: { sources?: SearchSource[] } }).output;
          if (Array.isArray(out?.sources) && out.sources.length > 0) sources = out.sources;
        }
      }

      if (!sources && sourcesByMsgId[m.id]) {
        sources = sourcesByMsgId[m.id];
      }

      if (!sources && (m as unknown as { sources?: SearchSource[] }).sources?.length) {
        sources = (m as unknown as { sources?: SearchSource[] }).sources;
      }

      const fallbackSources =
        !sources && idx === lastAssistantIdx && m.role === "assistant" && currentSources.length > 0
          ? currentSources
          : undefined;

      const finalSources = sources || fallbackSources;

      const toolCalls =
        (m as unknown as { toolCalls?: unknown }).toolCalls ||
        parts.filter(
          (p) =>
            p.type === "tool-invocation" ||
            p.type === "tool-call" ||
            p.type === "tool-input-available" ||
            p.type.startsWith("tool-")
        );

      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: textContent,
        parts,
        sources: finalSources,
        toolCalls: toolCalls && (toolCalls as unknown[]).length > 0 ? toolCalls : undefined,
      };
    });
  }, [messages, currentSources, sourcesByMsgId]);

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
