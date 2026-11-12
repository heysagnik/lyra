import { useState } from "react";
import { Loader2, Globe, ChevronRight } from "lucide-react";

export interface ToolBadgeProps {
  query?: string;
  isComplete?: boolean;
}

/**
 * Collapsible tool-step badge showing live web search execution.
 */
export function ToolBadge({ query, isComplete = false }: ToolBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]/60 px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      >
        {isComplete ? (
          <Globe aria-hidden className="h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" />
        ) : (
          <Loader2 aria-hidden className="h-3.5 w-3.5 text-[var(--color-accent)] animate-spin shrink-0" />
        )}
        <span className="font-medium">
          {isComplete
            ? query
              ? `Searched: “${query}”`
              : "Searched the web"
            : query
            ? `Searching: “${query}”…`
            : "Searching the web…"}
        </span>
        <ChevronRight
          aria-hidden
          className={`h-3 w-3 text-[var(--color-text-tertiary)] transition-transform duration-[var(--duration-fast)] ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="font-coordinate mt-1.5 max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-xs leading-relaxed text-[var(--color-text-secondary)] shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-[var(--color-text)]">
            <Globe className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            <span>Web Search Execution</span>
          </div>
          <div className="text-[11px] text-[var(--color-text-tertiary)]">
            {query ? `Query: “${query}”` : "Live web search executed for this turn"}
          </div>
        </div>
      )}
    </div>
  );
}
