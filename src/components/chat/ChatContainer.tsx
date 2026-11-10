"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu, Globe, Sparkles } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { Toast } from "./Toast";
import { useAgentChat } from "@/lib/api/use-agent-chat";
import {
  fetchConversations,
  fetchConversation,
  updateConversationApi,
  deleteConversationApi,
} from "@/lib/api/client";
import type { Conversation, SearchSource } from "@/types";

export function ChatContainer() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | undefined>();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<{
    text: string;
    search: boolean;
  } | null>(null);

  // 1. Fetch conversations with TanStack Query
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => fetchConversations(),
  });

  // 2. Fetch active conversation details & messages
  const { data: activeConvData } = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => (activeId ? fetchConversation(activeId) : null),
    enabled: !!activeId,
  });

  const activeConv = activeConvData?.conversation;

  // 3. AI SDK useAgentChat wrapper
  const handleConversationCreated = useCallback(
    (newId: string) => {
      setActiveId(newId);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    [queryClient]
  );

  const initialAgentMessages = activeConvData?.messages.map((m) => ({
    id: m.id,
    role: (m.role === "tool" ? "assistant" : m.role) as "user" | "assistant" | "system",
    content: m.content,
    sources: (m.sources as SearchSource[] | null) || undefined,
    createdAt: new Date(m.createdAt),
  }));

  const {
    messages,
    sendMessage,
    isStreaming,
    stop,
    error: chatError,
    clearError,
  } = useAgentChat({
    conversationId: activeId,
    searchDefault: activeConv?.searchDefault ?? true,
    initialMessages: initialAgentMessages,
    onConversationCreated: handleConversationCreated,
  });

  // Sync error to Toast
  useEffect(() => {
    if (chatError) {
      setErrorMessage(chatError.message || "An error occurred during generation");
    }
  }, [chatError]);

  // Mutations
  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateConversationApi(id, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversationApi(id),
    onSuccess: (_, deletedId) => {
      if (activeId === deletedId) {
        setActiveId(undefined);
      }
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const handleSend = (text: string, search: boolean) => {
    setLastFailedPrompt({ text, search });
    setErrorMessage(null);
    clearError();
    void sendMessage(text, search);
  };

  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSend(lastFailedPrompt.text, lastFailedPrompt.search);
    }
  };

  const handleNewChat = () => {
    setActiveId(undefined);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Sidebar: 280px */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={(id) => setActiveId(id)}
        onNewChat={handleNewChat}
        onRenameConversation={async (id, title) => {
          await renameMutation.mutateAsync({ id, title });
        }}
        onDeleteConversation={async (id) => {
          await deleteMutation.mutateAsync(id);
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main column */}
      <main className="flex flex-1 flex-col overflow-hidden bg-white">
        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b border-gray-200 px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Open sidebar"
              className="p-1 text-gray-500 hover:text-gray-800 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-sm font-medium text-gray-900 truncate max-w-sm sm:max-w-md">
              {activeConv?.title || "New chat"}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">Qwen 3.8 / GPT</span>
            </div>
            {activeConv?.searchDefault && (
              <div className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 text-[11px]">
                <Globe className="h-3 w-3" />
                <span className="hidden sm:inline">Web Search</span>
              </div>
            )}
          </div>
        </header>

        {/* Message List */}
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onSelectPrompt={(prompt, search) => handleSend(prompt, search ?? true)}
        />

        {/* Composer */}
        <Composer
          onSend={handleSend}
          isStreaming={isStreaming}
          onStop={stop}
          searchDefault={activeConv?.searchDefault ?? true}
        />
      </main>

      {/* Error Toast */}
      {errorMessage && (
        <Toast
          message={errorMessage}
          onRetry={lastFailedPrompt ? handleRetry : undefined}
          onDismiss={() => setErrorMessage(null)}
        />
      )}
    </div>
  );
}
