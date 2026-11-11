"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  X,
  Search,
  Settings,
  LogOut,
} from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import { LogoMark } from "@/components/brand/LogoMark";
import { Wordmark } from "@/components/brand/Wordmark";
import { signOut, useSession } from "@/lib/auth/client";
import type { Conversation } from "@/types";

function AsteriskIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      aria-hidden
      className={className}
      fill="none"
    >
      <line
        x1="128"
        y1="40"
        x2="128"
        y2="216"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="48"
        y1="80"
        x2="208"
        y2="176"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <line
        x1="48"
        y1="176"
        x2="208"
        y2="80"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="16"
      />
    </svg>
  );
}

export interface SidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isLayoutReady?: boolean;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onRenameConversation,
  onDeleteConversation,
  isOpenMobile,
  onCloseMobile,
  isLayoutReady = true,
}: SidebarProps) {
  const [filter, setFilter] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: session } = useSession();
  const name = session?.user?.name;
  const email = session?.user?.email;
  const initial = (name?.trim()?.[0] ?? "L").toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };

  // Dismiss the account menu on outside click or Escape
  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  // Global shortcuts: Ctrl+K starts a new chat, Ctrl+Shift+, opens settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/");
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "Comma") {
        e.preventDefault();
        router.push("/settings/account");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

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
          className="fade-in fixed inset-0 z-40 bg-black/60 md:hidden"
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
            className="rounded-[var(--radius-md)] p-1 text-[var(--text-faint)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--text)] active:scale-[0.94] md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
          <span aria-hidden className="hidden md:block md:w-1" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2">
          {/* New */}
          <button
            onClick={() => router.push("/")}
            className="mt-1 flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--panel-2)] px-3 py-2 text-sm font-medium text-[var(--text)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--panel-3)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New
          </button>

          {/* Search */}
          {showSearch ? (
            <div className="relative mt-1">
              <Search
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
              <Search className="h-4 w-4" />
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

        {/* Footer */}
        <div className="shrink-0 border-t border-[var(--line-soft)] p-3">
          <div ref={accountMenuRef} className="relative">
            {accountMenuOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className="popover-in-up absolute inset-x-0 bottom-full z-[var(--z-overlay)] mb-2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] p-1.5 shadow-[var(--shadow-dialog)]"
              >
                <p className="truncate px-2.5 py-1.5 text-xs text-[var(--text-faint)]">
                  {email || name || "Signed in"}
                </p>
                <div className="mx-1.5 my-1 h-px bg-[var(--color-border)]" />

                <Link
                  href="/settings/account"
                  role="menuitem"
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                >
                  <Settings aria-hidden className="h-4 w-4" />
                  Settings
                  <span className="ml-auto text-xs text-[var(--text-faint)]">
                    Ctrl+Shift+,
                  </span>
                </Link>

                <div className="mx-1.5 my-1 h-px bg-[var(--color-border)]" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
                >
                  <LogOut aria-hidden className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              aria-label={`Account menu for ${name || "lyra"}`}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-lg)] px-1 py-1 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--panel-2)]"
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
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--color-warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-canvas))] px-2.5 py-1 text-[13px] font-medium text-[#f2ead9] shadow-[inset_0_1px_0_rgb(255_255_255/6%)]">
                <AsteriskIcon className="h-3.5 w-3.5 text-[#e6a23c]" />
                Pro
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
