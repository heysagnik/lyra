"use client";

import { WarningIcon, ArrowsClockwiseIcon, XIcon } from "@phosphor-icons/react";

export interface ToastProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
}

export function Toast({ message, onRetry, onDismiss }: ToastProps) {
  return (
    <div
      role="alert"
      className="toast-in fixed right-4 top-4 z-50 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--danger)]/40 bg-[var(--danger-ground)] p-3 text-xs text-[var(--danger)] shadow-[var(--shadow-dialog)]"
    >
      <WarningIcon className="h-4 w-4 shrink-0" />
      <span className="max-w-xs leading-relaxed">{message}</span>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 rounded border border-[var(--danger)]/50 px-2 py-1 text-xs font-medium transition-colors duration-[var(--duration-normal)] hover:bg-[var(--danger)]/10 active:scale-[0.96]"
        >
          <ArrowsClockwiseIcon className="h-3 w-3" />
          <span>Retry</span>
        </button>
      )}

      <button
        onClick={onDismiss}
        className="rounded p-1 transition-colors duration-[var(--duration-normal)] hover:text-[var(--text)]"
        aria-label="Dismiss error"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
