"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CaretDownIcon, ShareFatIcon , CheckIcon, TrashSimpleIcon, SidebarIcon, PencilSimpleIcon } from "@phosphor-icons/react";
import { Sidebar } from "./Sidebar";
import { MessageList } from "./MessageList";
import { EmptyState } from "./EmptyState";
import { Composer } from "./Composer";
import { ActionSheet } from "./ActionSheet";
import { Skeleton } from "@/components/ui/skeleton";
import toast from "react-hot-toast";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
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
    try {
      sessionStorage.setItem("lyra:lastChatPath", window.location.pathname);
    } catch {
    }
  }, [activeId]);

  useEffect(() => {
    setActiveId(initialConversationId);
  }, [initialConversationId]);
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
  const isMobile = useIsMobile();
  const router = useRouter();

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: () => fetchConversations(),
  });

  const { data: activeConvData, isPending: isConvPending } = useQuery({
    queryKey: ["conversation", activeId],
    queryFn: () => (activeId ? fetchConversation(activeId) : null),
    enabled: !!activeId,
  });

  const activeConv = activeConvData?.conversation;

  const handleConversationCreated = useCallback(
    (newId: string) => {
      setActiveId(newId);
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
        reasoning: m.reasoning || undefined,
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

  useEffect(() => {
    if (!isStreaming && activeId) {
      void queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  }, [isStreaming, activeId, queryClient]);

  useEffect(() => {
    if (!chatError) return;
    const message = chatError.message || "An error occurred during generation";
    toast.error(
      lastFailedPrompt ? (
        <span className="flex items-center gap-3">
          <span className="max-w-[15rem] leading-relaxed">{message}</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss();
              handleRetry();
            }}
            className="shrink-0 rounded border border-[var(--color-danger)]/50 px-2.5 py-1.5 text-xs font-medium text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger)]/10 active:scale-[0.96]"
          >
            Retry
          </button>
        </span>
      ) : (
        message
      ),
      { id: "chat-error", duration: 6000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatError]);

  // Mutations (mutateAsync is stable, so the callbacks below can be memoized)
  const { mutateAsync: renameConversationAsync } = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateConversationApi(id, { title }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not rename conversation");
    },
  });

  const { mutateAsync: deleteConversationAsync } = useMutation({
    mutationFn: (id: string) => deleteConversationApi(id),
    onSuccess: (_, deletedId) => {
      if (activeId === deletedId) {
        setActiveId(undefined);
      }
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not delete conversation");
    },
  });

  // Stable identities so the memoized Sidebar (and its items) skip re-renders
  // while streaming updates the message list on every token
  const handleSelectConversation = useCallback((id: string) => {
    setActiveId(id);
    window.history.pushState(null, "", `/chat/${id}`);
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveId(undefined);
    window.history.pushState(null, "", "/new");
  }, []);

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConversationAsync({ id, title });
    },
    [renameConversationAsync]
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversationAsync(id);
    },
    [deleteConversationAsync]
  );

  const handleCloseSidebar = useCallback(() => setIsSidebarOpen(false), []);

  const handleSend = (
    text: string,
    _search: boolean,
    model: string = "primary",
    effort: "low" | "standard" | "max" = "standard"
  ) => {
    setLastFailedPrompt({ text, search: true });
    setLastModel(model);
    setLastEffort(effort);
    clearError();
    void sendMessage(text, true, model, effort);
  };

  const handleRegenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser?.content) {
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
  // First load of a conversation: no cached data yet. Keep the chat layout
  // (skeleton, not EmptyState) so the composer never jumps between branches.
  const isSwitching = !!activeId && isConvPending;
  const showEmpty = isEmpty && !isSwitching;

  const composer = (
    <Composer
      onSend={handleSend}
      isStreaming={isStreaming}
      onStop={stop}
      isModelLocked={!isEmpty || isStreaming}
      lockedModel={
        !isEmpty && !isStreaming
          ? (activeConvData?.messages.find((m) => m.model)?.model ?? undefined)
          : undefined
      }
    />
  );

  return (
    <div className="fixed inset-0 flex w-full overflow-hidden bg-[var(--color-canvas)]">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        isOpenMobile={isSidebarOpen}
        onCloseMobile={handleCloseSidebar}
        isLayoutReady={isLayoutReady}
      />

      {/* Main column */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-canvas)] px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen((v) => !v)}
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={isSidebarOpen}
              className="flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-[color,background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] active:scale-[0.96]"
            >
              <SidebarIcon className="h-[18px] w-[18px]" />
            </button>

            {isSwitching ? (
              <Skeleton className="h-5 w-40 rounded-[var(--radius-md)]" />
            ) : isEmpty ? (
              <div className="flex items-center md:hidden"/>
            ) : isRenamingHeader ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (activeId && headerTitle.trim()) {
                    await renameConversationAsync({
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
              <div className="relative flex min-w-0 items-center gap-1.5 px-2 py-1.5">
                <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text)] sm:text-[15px]">
                  {activeConv?.title || "New chat"}
                </h1>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                    aria-haspopup="menu"
                    aria-expanded={headerMenuOpen}
                    aria-label="Conversation options"
                    className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.96]"
                  >
                    <CaretDownIcon
                      aria-hidden
                      className={`h-4 w-4 text-[var(--color-text-tertiary)] transition-transform duration-[var(--duration-fast)] ${
                        headerMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Title dropdown: bottom sheet on mobile, popover on desktop */}
                {headerMenuOpen && isMobile && (
                  <ActionSheet
                    title={activeConv?.title ?? "New chat"}
                    onClose={() => setHeaderMenuOpen(false)}
                    actions={[
                      {
                        label: "Rename",
                        icon: <PencilSimpleIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />,
                        onSelect: () => {
                          setHeaderTitle(activeConv?.title ?? "");
                          setIsRenamingHeader(true);
                        },
                      },
                      {
                        label: "Share chat",
                        icon: <ShareFatIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />,
                        onSelect: async () => {
                          if (!activeId) return;
                          try {
                            await navigator.clipboard.writeText(
                              `${window.location.origin}/share/${activeId}`
                            );
                            setShared(true);
                            setTimeout(() => setShared(false), 2000);
                          } catch {
                          }
                        },
                      },
                      {
                        label: "Delete",
                        icon: <TrashSimpleIcon aria-hidden className="h-4 w-4 shrink-0" />,
                        danger: true,
                        onSelect: async () => {
                          if (activeId) {
                            await deleteConversationAsync(activeId);
                            setActiveId(undefined);
                            router.push("/");
                          }
                        },
                      },
                    ]}
                  />
                )}

                {headerMenuOpen && !isMobile && (
                <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setHeaderMenuOpen(false)}
                      aria-hidden
                    />
                    <div
                      role="menu"
                      aria-label="Conversation options"
                      className="popover-in absolute left-0 top-full z-50 mt-1.5 w-56 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1 shadow-[var(--shadow-popover)]"
                    >
                      <button
                        role="menuitem"
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setHeaderTitle(activeConv?.title ?? "");
                          setIsRenamingHeader(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.98]"
                      >
                        <PencilSimpleIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                        <span className="flex-1">Rename</span>
                      </button>
                      <button
                        role="menuitem"
                        onClick={async () => {
                          setHeaderMenuOpen(false);
                          if (!activeId) return;
                          try {
                            await navigator.clipboard.writeText(
                              `${window.location.origin}/share/${activeId}`
                            );
                            setShared(true);
                            setTimeout(() => setShared(false), 2000);
                          } catch {
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.98]"
                      >
                        <ShareFatIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                        <span className="flex-1">Share chat</span>
                      </button>
                      <div className="mx-1 my-1 border-t border-[var(--color-border)]" />
                      <button
                        role="menuitem"
                        onClick={async () => {
                          setHeaderMenuOpen(false);
                          if (activeId) {
                            await deleteConversationAsync(activeId);
                            setActiveId(undefined);
                            router.push("/");
                          }
                        }}
                        className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm font-medium text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger-muted)] active:scale-[0.98]"
                      >
                        <TrashSimpleIcon aria-hidden className="h-4 w-4 shrink-0" />
                        <span className="flex-1">Delete</span>
                      </button>
                    </div>
                  </>
                )}
                </div>
              </div>
            )}
          </div>

          {/* Right section: Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            {!showEmpty && (
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
                  }
                }}
                aria-label="Share chat"
                title="Copy a public read-only link to this chat"
                className="flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] px-2 text-xs font-medium text-[var(--color-text)] transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.96] disabled:opacity-50 sm:px-3 sm:text-sm"
                disabled={!activeId}
              >
                {shared ? (
                  <>
                    <CheckIcon aria-hidden key="copied" className="icon-in h-4 w-4 text-[var(--color-success)]" />
                    <span className="hidden sm:inline">Copied</span>
                  </>
                ) : (
                  <>
                    <ShareFatIcon aria-hidden className="h-4 w-4" />
                    <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </button>
            )}
          </div>

        </header>

        {showEmpty ? (
          <>
            <EmptyState />
            <div className="composer-scrim pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:px-4 sm:pb-4">
              <div className="pointer-events-auto w-full max-w-2xl">{composer}</div>
            </div>
          </>
        ) : (
          <>
            <MessageList
              key={activeId ?? "new"}
              messages={messages}
              isStreaming={isStreaming}
              isLoading={isSwitching}
              onRegenerate={handleRegenerate}
            />

            <div className="composer-scrim pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8 sm:px-4 sm:pb-4">
              <div className="pointer-events-auto w-full max-w-2xl">{composer}</div>
            </div>
          </>
        )}
      </main>

    </div>
  );
}
