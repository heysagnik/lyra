"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { PanelLeft, ChevronDown, Share, Check, Pencil, Trash2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MessageList } from "./MessageList";
import { EmptyState } from "./EmptyState";
import { Composer } from "./Composer";
import { Toast } from "./Toast";
import { LogoMark } from "@/components/brand/LogoMark";
import { Wordmark } from "@/components/brand/Wordmark";
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
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | undefined>(
    initialConversationId
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(window.innerWidth >= 768);
    setIsLayoutReady(true);
  }, []);

  useEffect(() => {
    setActiveId(initialConversationId);
  }, [initialConversationId]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<{
    text: string;
    search: boolean;
  } | null>(null);
  const [lastModel, setLastModel] = useState<string>("primary");
  const [lastEffort, setLastEffort] = useState<"low" | "standard" | "max">("standard");
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
        toolCalls: m.toolCalls,
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

  // Revalidate conversation data after streaming completes to sync persisted toolCalls & sources
  useEffect(() => {
    if (!isStreaming && activeId) {
      void queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  }, [isStreaming, activeId, queryClient]);

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
    model: string = "primary",
    effort: "low" | "standard" | "max" = "standard"
  ) => {
    setLastFailedPrompt({ text, search: true });
    setLastModel(model);
    setLastEffort(effort);
    setErrorMessage(null);
    clearError();
    void sendMessage(text, true, model, effort);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content) {
      setErrorMessage(null);
      clearError();
      void sendMessage(lastUser.content, true, lastModel, lastEffort);
    }
  };

  const handleRetry = () => {
    if (lastFailedPrompt) {
      handleSend(lastFailedPrompt.text, lastFailedPrompt.search, lastModel, lastEffort);
    }
  };

  const isEmpty = messages.length === 0;

  const composer = (
    <Composer
      onSend={handleSend}
      isStreaming={isStreaming}
      onStop={stop}
      isModelLocked={!isEmpty || isStreaming}
    />
  );

  return (
    <div className="fixed inset-0 flex w-full overflow-hidden bg-[var(--bg)]">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={(id) => {
          setActiveId(id);
          window.history.pushState(null, "", `/chat/${id}`);
        }}
        onNewChat={() => {
          setActiveId(undefined);
          window.history.pushState(null, "", "/new");
        }}
        onRenameConversation={async (id, title) => {
          await renameMutation.mutateAsync({ id, title });
        }}
        onDeleteConversation={async (id) => {
          await deleteMutation.mutateAsync(id);
        }}
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
        isLayoutReady={isLayoutReady}
      />

      {/* Main column */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Persistent top header */}
        <header className="relative z-30 flex h-13 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--bg)] px-3 sm:h-12 sm:px-4">
          {/* Left section: Sidebar toggle & Title / Brand */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen((v) => !v)}
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={isSidebarOpen}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-[color,background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] active:scale-[0.96]"
            >
              <PanelLeft className="h-[18px] w-[18px]" />
            </button>

            {isEmpty ? (
              <div className="flex items-center md:hidden"/>
            ) : isRenamingHeader ? (
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
                  className="w-full max-w-64 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] px-2.5 py-1 text-sm font-medium text-[var(--color-text)] focus:outline-none"
                />
              </form>
            ) : (
              <button
                onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                aria-haspopup="menu"
                aria-expanded={headerMenuOpen}
                className="flex min-w-0 items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.96]"
              >
                <h1 className="truncate max-w-[170px] text-sm font-medium text-[var(--color-text)] sm:max-w-md sm:text-[15px]">
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
          </div>

          {/* Right section: Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            {!isEmpty && (
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
                className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-xs font-medium text-[var(--color-text)] transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.96] disabled:opacity-50 sm:px-3 sm:text-sm"
                disabled={!activeId}
              >
                {shared ? (
                  <>
                    <Check aria-hidden className="h-4 w-4 text-[var(--color-success)]" />
                    <span className="hidden sm:inline">Copied</span>
                  </>
                ) : (
                  <>
                    <Share aria-hidden className="h-4 w-4" strokeWidth={2} />
                    <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Title dropdown menu */}
          {headerMenuOpen && !isEmpty && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setHeaderMenuOpen(false)}
                aria-hidden
              />
              <div
                role="menu"
                aria-label="Conversation options"
                className="popover-in-left absolute left-12 top-full z-50 mt-1 w-32 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0.5 shadow-md"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setHeaderTitle(activeConv?.title ?? "");
                    setIsRenamingHeader(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.98]"
                >
                  <Pencil aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />
                  Rename
                </button>
                <button
                  role="menuitem"
                  onClick={async () => {
                    setHeaderMenuOpen(false);
                    if (activeId) {
                      await deleteMutation.mutateAsync(activeId);
                      setActiveId(undefined);
                      router.push("/");
                    }
                  }}
                  className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs font-medium text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger-muted)] active:scale-[0.98]"
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5 shrink-0" />
                  Delete
                </button>
              </div>
            </>
          )}
        </header>

        {isEmpty ? (
          <>
            <EmptyState />
            <div className="composer-scrim pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:px-4 sm:pb-4">
              <div className="pointer-events-auto w-full max-w-2xl">{composer}</div>
            </div>
          </>
        ) : (
          <>
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              onRegenerate={handleRegenerate}
            />

            <div className="composer-scrim pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:px-4 sm:pb-4">
              <div className="pointer-events-auto w-full max-w-2xl">{composer}</div>
            </div>
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
