"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

export interface SheetAction {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

export interface ActionSheetProps {
  /** Optional context line above the actions (e.g. the conversation title) */
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}

/**
 * Mobile bottom sheet: every dropdown menu that is a floating popover on
 * desktop opens as a sheet anchored to the bottom edge on touch screens,
 * where hover-revealed and absolutely-positioned menus don't work.
 */
export function ActionSheet({ title, actions, onClose }: ActionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sheetRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      // Trap focus inside the modal sheet
      const container = sheetRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>("button");
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
    }
  };

  return createPortal(
    <>
      {/* Scrim: dims the app behind the sheet */}
      <div
        className="fade-in fixed inset-0 z-[70] bg-[var(--color-scrim)]"
        style={{ backdropFilter: "blur(2px)" }}
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Options"}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="sheet-in fixed inset-x-0 bottom-0 z-[80] mx-auto w-full max-w-md rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[var(--shadow-drawer)] outline-none"
      >
        {/* Drag handle */}
        <div
          aria-hidden
          className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-[var(--color-surface-3)]"
        />

        {title && (
          <p className="truncate px-3 pb-1.5 pt-1 text-xs text-[var(--color-text-tertiary)]">
            {title}
          </p>
        )}

        <div role="menu" aria-label={title ?? "Options"} className="flex flex-col">
          {actions.map((action) => (
            <button
              key={action.label}
              role="menuitem"
              onClick={() => {
                onClose();
                action.onSelect();
              }}
              className={`flex h-12 w-full items-center gap-3 rounded-[var(--radius-lg)] px-3 text-left text-sm font-medium transition-colors duration-[var(--duration-fast)] active:bg-[var(--color-hover)] ${
                action.danger
                  ? "text-[var(--color-danger)] active:bg-[var(--color-danger-muted)]"
                  : "text-[var(--color-text)]"
              }`}
            >
              {action.icon}
              <span className="flex-1">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
