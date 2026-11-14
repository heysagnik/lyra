"use client";

import { CircleNotchIcon, GlobeIcon } from "@phosphor-icons/react";

export interface ToolBadgeProps {
  /** Every distinct query executed this turn, in order */
  queries?: string[];
  isComplete?: boolean;
}

/**
 * Streaming/search status line. Shows the running count when a turn
 * searched more than once (the ReAct loop), plus the latest query.
 */
export function ToolBadge({ queries, isComplete = false }: ToolBadgeProps) {
  const list = (queries ?? []).filter(Boolean);
  const latest = list[list.length - 1];
  const count = list.length;

  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] select-none">
      {isComplete ? (
        <GlobeIcon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-tertiary)]"
        />
      ) : (
        <CircleNotchIcon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-text-tertiary)]"
        />
      )}
      <span className="truncate">
        <span>
          {isComplete
            ? count > 1
              ? `Searched the web · ${count} queries`
              : "Searched the web"
            : "Searching the web"}
        </span>
        {latest && (
          <>
            <span className="mx-1 text-[var(--color-text-tertiary)] opacity-60">·</span>
            <span className="font-normal text-[var(--color-text-secondary)]">
              “{latest}”
            </span>
          </>
        )}
      </span>
    </div>
  );
}
