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
      className="toast-in fixed right-4 top-4 z-50 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-danger)]/40 bg-[var(--color-danger-muted)] p-3 text-xs text-[var(--color-danger)] shadow-[var(--shadow-dialog)]"
    >
      <WarningIcon className="h-4 w-4 shrink-0" />
      <span className="max-w-xs leading-relaxed">{message}</span>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1 rounded border border-[var(--color-danger)]/50 px-2.5 py-2 text-xs font-medium transition-colors duration-[var(--duration-normal)] hover:bg-[var(--color-danger)]/10 active:scale-[0.96]"
        >
          <ArrowsClockwiseIcon className="h-3 w-3" />
          <span>Retry</span>
        </button>
      )}

      <button
        onClick={onDismiss}
        className="rounded p-2 transition-[color,transform] duration-[var(--duration-normal)] hover:text-[var(--color-text)] active:scale-[0.96]"
        aria-label="Dismiss error"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
