"use client";

import { Loader2, Globe } from "lucide-react";

export interface ToolBadgeProps {
  query?: string;
  isComplete?: boolean;
}

/**
 * Polished, minimal status pill showing web search execution.
 * Subtle neutral styling with responsive truncation and clean typography.
 */
export function ToolBadge({ query, isComplete = false }: ToolBadgeProps) {
  return (
    <div
      className="group mb-2.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-2.5 py-0.5 text-[11px] leading-5 text-[var(--color-text-tertiary)] shadow-2xs backdrop-blur-xs transition-[border-color,background-color] duration-[var(--duration-fast)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]"
      title={query ? `Search query: ${query}` : "Web search"}
    >
      {isComplete ? (
        <Globe
          aria-hidden
          className="h-3 w-3 shrink-0 text-[var(--color-text-tertiary)] transition-colors group-hover:text-[var(--color-text-secondary)]"
        />
      ) : (
        <Loader2
          aria-hidden
          className="h-3 w-3 shrink-0 animate-spin text-[var(--color-text-secondary)]"
        />
      )}
      <span className="truncate">
        <span>{isComplete ? "Searched" : "Searching"}</span>
        {query ? (
          <>
            <span className="mx-1 text-[var(--color-border-strong)] opacity-60">·</span>
            <span className="text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-text)]">
              “{query}”
            </span>
          </>
        ) : (
          <span> web</span>
        )}
      </span>
    </div>
  );
}
