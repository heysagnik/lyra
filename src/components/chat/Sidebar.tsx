"use client";

import { memo, useCallback, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  PlusIcon,
  XIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { ConversationItem } from "./ConversationItem";
import { SearchPalette } from "./SearchPalette";
import { LogoMark } from "@/components/brand/LogoMark";
import { Wordmark } from "@/components/brand/Wordmark";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { useSession } from "@/lib/auth/client";
import type { Conversation } from "@/types";

export interface SidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isLayoutReady?: boolean;
}

export const Sidebar = memo(function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  isOpenMobile,
  onCloseMobile,
  isLayoutReady = true,
}: SidebarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const listScrollRef = useRef<HTMLDivElement>(null);
  const name = session?.user?.name;
  const plan =
    (session?.user as { plan?: string } | undefined)?.plan === "pro"
      ? "pro"
      : "free";
  const initial = (name?.trim()?.[0] ?? "L").toUpperCase();

  // Stable so memoized ConversationItems skip re-renders while streaming
  const handleSelectConversation = useCallback(
    (id: string) => {
      if (onSelectConversation) {
        onSelectConversation(id);
      } else {
        router.push(`/chat/${id}`);
      }
      if (isMobile) {
        onCloseMobile();
      }
    },
    [onSelectConversation, onCloseMobile, router, isMobile]
  );

  // Virtualize the conversation list so a long history stays smooth.
  // Rows are h-9 (36px) with a 2px gap; heights are measured live so
  // rename forms and other taller rows still lay out correctly.
  const listVirtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 38,
    overscan: 8,
    getItemKey: (index) => conversations[index].id,
  });

  // Global shortcuts: Ctrl+K starts a new chat, Ctrl+Shift+, opens settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (onNewChat) {
          onNewChat();
        } else {
          router.push("/new");
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Comma") {
        e.preventDefault();
        router.push("/settings/account");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, onNewChat]);

  return (
    <>
      {/* Mobile backdrop (solid translucent scrim — no live blur, that repaints every frame) */}
      {isLayoutReady && isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fade-in fixed inset-0 z-40 bg-[var(--color-scrim)] md:hidden"
        />
      )}

      {/* Sidebar panel. On desktop the aside animates width; the inner
          column stays a fixed 280px so its text never re-wraps mid-animation. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 h-full w-full overflow-hidden bg-[var(--color-sidebar)] transition-[transform,width] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-drawer)] md:static md:translate-x-0 ${
          isOpenMobile ? "translate-x-0 md:w-[280px]" : "-translate-x-full md:w-0"
        } ${isLayoutReady ? "" : "max-md:hidden"}`}
        aria-label="Conversation index"
      >
        <div className="flex h-full w-full shrink-0 flex-col md:w-[280px]">
          {/* Wordmark row */}
          <div className="flex h-12 shrink-0 items-center justify-between px-3">
            <h1 className="flex items-center">
              <Wordmark className="text-xl">
                <LogoMark className="h-6 w-6" />
                lyra
              </Wordmark>
            </h1>
            <div className="flex items-center gap-1">
              {/* Spotlight-style search trigger */}
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search chats"
                title="Search chats"
                className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-[color,background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] active:scale-[0.96]"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
              </button>
              <button
                onClick={onCloseMobile}
                aria-label="Close sidebar"
                className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-[var(--radius-md)] p-1 text-[var(--color-text-tertiary)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--color-text)] active:scale-[0.96] md:hidden"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="shrink-0 px-3 pt-1">
            <button
              type="button"
              onClick={() => {
                if (onNewChat) {
                  onNewChat();
                } else {
                  router.push("/new");
                }
                if (isMobile) {
                  onCloseMobile();
                }
              }}
              title="New chat"
              className="group flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-3 text-sm font-medium text-[var(--color-on-primary)] transition-[background-color,transform,box-shadow] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] hover:bg-[var(--color-primary-hover)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.08)] active:scale-[0.98]"
            >
              <PlusIcon
                weight="bold"
                className="h-4 w-4 shrink-0"
              />
              <span className="flex-1 truncate text-left">New chat</span>
              {/* Platform hint, resolved before first paint by the bootstrap
                  script in layout.tsx (data-platform on <html>) */}
              <kbd
                aria-hidden
                data-shortcut="generic"
                className="shrink-0 rounded-[var(--radius-md)] px-1.5 py-0.5 font-sans text-[10px] font-medium tracking-wide"
                style={{
                  background: "color-mix(in srgb, var(--color-on-primary) 14%, transparent)",
                }}
              >
                Ctrl K
              </kbd>
              <kbd
                aria-hidden
                data-shortcut="apple"
                className="shrink-0 rounded-[var(--radius-md)] px-1.5 py-0.5 font-sans text-[10px] font-medium tracking-wide"
                style={{
                  background: "color-mix(in srgb, var(--color-on-primary) 14%, transparent)",
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="shrink-0 px-6 pb-2 pt-4">
            <p className="text-xs text-[var(--color-text-tertiary)]">Recent Chats</p>
          </div>

          <div
            ref={listScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2"
          >
            {conversations.length === 0 ? (
                <p className="px-3 py-6 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                  No chats yet.
                </p>
              ) : (
                <div
                  style={{
                    height: listVirtualizer.getTotalSize(),
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {listVirtualizer.getVirtualItems().map((virtualRow) => {
                    const c = conversations[virtualRow.index];
                    return (
                      <div
                        key={c.id}
                        data-index={virtualRow.index}
                        ref={listVirtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <ConversationItem
                          conversation={c}
                          isActive={c.id === activeConversationId}
                          onSelect={handleSelectConversation}
                          onRename={onRenameConversation}
                          onDelete={onDeleteConversation}
                          isMobile={isMobile}
                        />
                        {/* 2px gap, matching the previous space-y-0.5 rhythm */}
                        <div aria-hidden className="h-0.5" />
                      </div>
                    );
                  })}
                </div>
              )}
          </div>

          <div className="shrink-0 border-t border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/settings/account"
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-lg)] py-1 pl-3 pr-1 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-2)]"
              >
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-hover)] text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  {initial}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text)]">
                  {name || "lyra"}
                </span>
              </Link>

              <span
                title={plan === "pro" ? "Pro plan — 300 turns/day" : "Free plan — 20 turns/day"}
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  plan === "pro"
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-tertiary)]"
                }`}
              >
                {plan === "pro" ? "Pro" : "Free"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Spotlight-style search palette */}
      {searchOpen && (
        <SearchPalette
          conversations={conversations}
          onClose={() => setSearchOpen(false)}
          onSelect={(id) => {
            setSearchOpen(false);
            handleSelectConversation(id);
          }}
        />
      )}
    </>
  );
});
