import { useState } from "react";
import { Loader2, Globe, ChevronRight } from "lucide-react";

export interface ToolBadgeProps {
  query?: string;
  isComplete?: boolean;
}

/**
 * Collapsible tool-step row, styled like a reasoning trace: gray icon,
 * muted label, chevron; expands to reveal the search query.
 */
export function ToolBadge({ query, isComplete = false }: ToolBadgeProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2 rounded-md px-1 py-0.5 text-sm text-[var(--color-text-tertiary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--color-text-secondary)]"
      >
        {isComplete ? (
          <Globe aria-hidden className="h-4 w-4" />
        ) : (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        )}
        <span>{isComplete ? "Thought Process" : "Thinking…"}</span>
        <ChevronRight
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform duration-[var(--duration-fast)] ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="font-coordinate mt-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {isComplete ? "Searched the web" : "Searching the web"}
          {query ? ` — “${query}”` : ""}
        </div>
      )}
    </div>
  );
}
