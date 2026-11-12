"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PlusIcon,
  XIcon,
  GearIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { ConversationItem } from "./ConversationItem";
import { LogoMark } from "@/components/brand/LogoMark";
import { Wordmark } from "@/components/brand/Wordmark";
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

export function Sidebar({
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
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const name = session?.user?.name;
  const initial = (name?.trim()?.[0] ?? "L").toUpperCase();

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

  const visible = filter
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(filter.toLowerCase())
      )
    : conversations;

  return (
    <>
      {/* Mobile backdrop */}
      {isLayoutReady && isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fade-in fixed inset-0 z-40 bg-[var(--color-scrim)] md:hidden"
          style={{ backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-full shrink-0 flex-col overflow-hidden bg-[var(--panel)] transition-[transform,width] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-drawer)] md:static md:translate-x-0 ${
          isOpenMobile ? "translate-x-0 md:w-[280px]" : "-translate-x-full md:w-0"
        } ${isLayoutReady ? "" : "max-md:hidden"}`}
        aria-label="Conversation index"
      >
        {/* Wordmark row */}
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <h1 className="flex items-center">
            <Wordmark className="text-xl">
              <LogoMark className="h-6 w-6" />
              lyra
            </Wordmark>
          </h1>
          <button
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="rounded-[var(--radius-md)] p-1 text-[var(--text-faint)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--text)] active:scale-[0.96] md:hidden"
          >
            <XIcon className="h-4 w-4" />
          </button>
          <span aria-hidden className="hidden md:block md:w-1" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {/* New */}
          <button
            onClick={() => {
              if (onNewChat) {
                onNewChat();
              } else {
                router.push("/new");
              }
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                onCloseMobile();
              }
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--panel-2)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--panel-3)] active:scale-[0.96]"
          >
            <PlusIcon className="h-4 w-4" />
            New
          </button>

          {/* Search */}
          {showSearch ? (
            <div className="relative mt-1">
              <MagnifyingGlassIcon
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]"
              />
              <input
                type="search"
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onBlur={() => {
                  if (!filter) setShowSearch(false);
                }}
                placeholder="Search chats"
                aria-label="Search conversations"
                className="w-full rounded-[var(--radius-lg)] bg-[var(--panel-2)] py-2 pl-9 pr-2 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="mt-0.5 flex w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors duration-[var(--duration-normal)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
              Search
            </button>
          )}

          {/* Chats */}
          <div className="mt-5">
            <p className="px-3 pb-2 text-xs text-[var(--text-faint)]">Chats</p>
            {conversations.length === 0 ? (
              <p className="px-3 py-6 text-xs leading-relaxed text-[var(--text-faint)]">
                No chats yet.
              </p>
            ) : (
              <div className="space-y-0.5">
                {visible.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conversation={c}
                    isActive={c.id === activeConversationId}
                    onSelect={(id) => {
                      if (onSelectConversation) {
                        onSelectConversation(id);
                      } else {
                        router.push(`/chat/${id}`);
                      }
                      if (typeof window !== "undefined" && window.innerWidth < 768) {
                        onCloseMobile();
                      }
                    }}
                    onRename={onRenameConversation}
                    onDelete={onDeleteConversation}
                  />
                ))}
              </div>
            )}
            {conversations.length > 0 && visible.length === 0 && (
              <p className="px-3 py-6 text-xs text-[var(--text-faint)]">
                No chats match “{filter}”.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[var(--color-border)] p-3">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/settings/account"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-lg)] p-1 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--panel-2)]"
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--panel-3)] text-xs font-medium text-[var(--text-muted)]"
              >
                {initial}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">
                {name || "lyra"}
              </span>
            </Link>

            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-lg)] text-[var(--text-secondary)] transition-[color,background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--panel-2)] hover:text-[var(--text)] active:scale-[0.96]"
            >
              <GearIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
