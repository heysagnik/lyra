"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PanelLeft, ChevronDown, Share, Check, Pencil, Trash2 } from "lucide-react";
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

export function ChatContainer({
  initialConversationId,
}: {
  initialConversationId?: string;
}) {
  const queryClient = useQueryClient();  const [activeId, setActiveId] = useState<string | undefined>(
    initialConversationId
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(window.innerWidth >= 768);
  }, []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<{
    text: string;
    search: boolean;
  } | null>(null);
  const [lastModel, setLastModel] = useState<"primary" | "fallback">("primary");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [isRenamingHeader, setIsRenamingHeader] = useState(false);
  const [headerTitle, setHeaderTitle] = useState("");
  const [shared, setShared] = useState(false);
  const router = useRouter();

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
      // Reflect the new conversation in the URL without a client navigation,
      // which would drop the in-flight stream
      window.history.replaceState(null, "", `/chat/${newId}`);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    [queryClient]
  );

  const initialAgentMessages = useMemo(
    () =>
      activeConvData?.messages.map((m) => ({
        id: m.id,
        role: (m.role === "tool" ? "assistant" : m.role) as "user" | "assistant" | "system",
        content: m.content,
        sources: (m.sources as SearchSource[] | null) || undefined,
        createdAt: new Date(m.createdAt),
      })),
    [activeConvData]
  );

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

  const handleSend = (
    text: string,
    _search: boolean,
    model: "primary" | "fallback" = "primary"
  ) => {
    setLastFailedPrompt({ text, search: true });
    setLastModel(model);
    setErrorMessage(null);
    clearError();
    void sendMessage(text, true, model);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content) {
      setErrorMessage(null);
      clearError();
      void sendMessage(lastUser.content, true, lastModel);
    }
  };

  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSend(lastFailedPrompt.text, lastFailedPrompt.search);
    }
  };

  const isEmpty = messages.length === 0;

  const composer = (
    <Composer
      onSend={handleSend}
      isStreaming={isStreaming}
      onStop={stop}
    />
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeId}
        onRenameConversation={async (id, title) => {
          await renameMutation.mutateAsync({ id, title });
        }}
        onDeleteConversation={async (id) => {
          await deleteMutation.mutateAsync(id);
        }}
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Main column */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {isEmpty ? (
          <>
            <header className="relative flex h-12 shrink-0 items-center gap-1 px-4">
              <button
                onClick={() => setIsSidebarOpen((v) => !v)}
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-expanded={isSidebarOpen}
                className="rounded-[var(--radius-md)] p-1 text-[var(--color-text-secondary)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--color-text)] active:scale-[0.94]"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
              {composer}
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <header className="relative flex h-12 shrink-0 items-center gap-1 px-4">
              <button
                onClick={() => setIsSidebarOpen((v) => !v)}
                aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-expanded={isSidebarOpen}
                className="rounded-[var(--radius-md)] p-1 text-[var(--color-text-secondary)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--color-text)] active:scale-[0.94]"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>

              {isRenamingHeader ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (activeId && headerTitle.trim()) {
                      await renameMutation.mutateAsync({
                        id: activeId,
                        title: headerTitle.trim(),
                      });
                    }
                    setIsRenamingHeader(false);
                  }}
                  className="min-w-0 flex-1"
                >
                  <input
                    autoFocus
                    value={headerTitle}
                    onChange={(e) => setHeaderTitle(e.target.value)}
                    onBlur={() => setIsRenamingHeader(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsRenamingHeader(false);
                    }}
                    aria-label="Conversation title"
                    className="w-full max-w-64 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-2 py-1 text-[15px] font-medium text-[var(--color-text)] focus:outline-none"
                  />
                </form>
              ) : (
                <button
                  onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                  aria-haspopup="menu"
                  aria-expanded={headerMenuOpen}
                  className="mr-auto flex w-fit min-w-0 max-w-full items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.97]"
                >
                  <h1 className="truncate max-w-sm text-[15px] font-medium text-[var(--color-text)] sm:max-w-md">
                    {activeConv?.title || "New chat"}
                  </h1>
                  <ChevronDown
                    aria-hidden
                    className={`h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform duration-[var(--duration-fast)] ${
                      headerMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}

              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={async () => {
                    if (!activeId) return;
                    try {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/share/${activeId}`
                      );
                      setShared(true);
                      setTimeout(() => setShared(false), 2000);
                    } catch {
                      // ignore
                    }
                  }}
                  aria-label="Share chat"
                  title="Copy a public read-only link to this chat"
                  className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 text-sm font-medium text-[var(--color-text)] transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.97] disabled:opacity-50 sm:px-3"
                  disabled={!activeId}
                >
                  {shared ? (
                    <>
                      <Check aria-hidden className="h-4 w-4 text-[var(--color-success)]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Share aria-hidden className="h-4 w-4" strokeWidth={2} />
                      <span>Share</span>
                    </>
                  )}
                </button>
              </div>

              {/* Title menu */}
              {headerMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setHeaderMenuOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="menu"
                    aria-label="Conversation options"
                    className="popover-in-left absolute left-4 top-full z-50 w-40 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1 shadow-[var(--shadow-dialog)]"
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setHeaderTitle(activeConv?.title ?? "");
                        setIsRenamingHeader(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.98]"
                    >
                      <Pencil aria-hidden className="h-3.5 w-3.5" />
                      Edit name
                    </button>
                    <button
                      role="menuitem"
                      onClick={async () => {
                        setHeaderMenuOpen(false);
                        if (activeId) {
                          await deleteMutation.mutateAsync(activeId);
                          router.push("/");
                        }
                      }}
                      className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger-muted)] active:scale-[0.98]"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </header>

            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              onRegenerate={handleRegenerate}
            />

            <div className="shrink-0 pb-4">{composer}</div>
          </>
        )}
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
