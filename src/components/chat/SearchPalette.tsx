"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlassIcon, ChatCircleTextIcon } from "@phosphor-icons/react";
import type { Conversation } from "@/types";

export interface SearchPaletteProps {
  conversations: Conversation[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function SearchPalette({
  conversations,
  onClose,
  onSelect,
}: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? conversations.filter((c) => c.title.toLowerCase().includes(q))
      : conversations;
    return list.slice(0, 50);
  }, [conversations, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the active row in view while navigating with the keyboard
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      // Trap focus inside the modal palette
      const container = dialogRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'input, button:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = results[activeIndex];
      if (picked) onSelect(picked.id);
    }
  };

  return createPortal(
    <>
      {/* Scrim: dims and blurs the app behind the palette */}
      <div
        className="fade-in fixed inset-0 z-[60] bg-[var(--color-scrim)]"
        style={{ backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search chats"
        onKeyDown={handleKeyDown}
        className="palette-in fixed inset-x-0 top-[16vh] z-[70] mx-auto w-[min(580px,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-popover)]"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface-1) 86%, transparent)",
          backdropFilter: "blur(28px) saturate(160%)",
          WebkitBackdropFilter: "blur(28px) saturate(160%)",
        }}
      >
        {/* Search field */}
        <div className="flex items-center gap-2.5 px-4">
          <MagnifyingGlassIcon
            aria-hidden
            className="h-4.5 w-4.5 shrink-0 text-[var(--color-text-tertiary)]"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-12 w-full bg-transparent text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto overscroll-contain p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-[var(--color-text-tertiary)]">
              No chats match “{query.trim()}”
            </p>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                data-index={i}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseMove={() => setActiveIndex(i)}
                onClick={() => onSelect(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-3 text-left text-sm transition-colors duration-[var(--duration-fast)] ${
                  i === activeIndex
                    ? "bg-[var(--color-hover)] text-[var(--color-text)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                <ChatCircleTextIcon
                  aria-hidden
                  className={`h-4 w-4 shrink-0 ${
                    i === activeIndex
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-text-tertiary)]"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
              </button>
            ))
          )}
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-text-tertiary)]">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 font-medium">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 font-medium">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-0.5 font-medium">esc</kbd>
            close
          </span>
        </div>
      </div>
    </>,
    document.body
  );
}
