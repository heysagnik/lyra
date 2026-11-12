"use client";

import { CircleNotchIcon, GlobeIcon } from "@phosphor-icons/react";

export interface ToolBadgeProps {
  query?: string;
  isComplete?: boolean;
}


export function ToolBadge({ query, isComplete = false }: ToolBadgeProps) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-faint)] select-none">
      {isComplete ? (
        <GlobeIcon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]"
        />
      ) : (
        <CircleNotchIcon
          aria-hidden
          className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--text-faint)]"
        />
      )}
      <span className="truncate">
        <span>{isComplete ? "Searched the web" : "Searching the web"}</span>
        {query && (
          <>
            <span className="mx-1 text-[var(--text-faint)] opacity-60">·</span>
            <span className="font-normal text-[var(--text-muted)]">
              “{query}”
            </span>
          </>
        )}
      </span>
    </div>
  );
}
