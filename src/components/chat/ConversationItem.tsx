"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PencilIcon, ShareFatIcon, TrashIcon, CheckIcon, XIcon, DotsThreeIcon } from "@phosphor-icons/react";
import { ActionSheet } from "./ActionSheet";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import type { Conversation } from "@/types";

/** Long-press duration before the options sheet opens on touch */
const LONG_PRESS_MS = 500;
/** Movement past this distance cancels the long-press (it's a scroll, not a hold) */
const LONG_PRESS_SLOP_PX = 10;

export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect?: (id: string) => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState(conversation.title);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const isMobile = useIsMobile();

  // Long-press tracking (touch only — desktop has the hover-revealed ⋯ button)
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  const clearPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    longPressedRef.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      longPressedRef.current = true;
      // Light haptic tick where the API exists
      try {
        navigator.vibrate?.(10);
      } catch {
        // ignore
      }
      setSheetOpen(true);
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pressStart.current;
    if (!start) return;
    if (
      Math.abs(e.clientX - start.x) > LONG_PRESS_SLOP_PX ||
      Math.abs(e.clientY - start.y) > LONG_PRESS_SLOP_PX
    ) {
      // Finger is scrolling the list, not holding the item
      clearPress();
    }
  };

  const handlePointerCancel = () => clearPress();

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 224; // w-56
    let left = rect.right + 6;
    if (left + menuWidth > window.innerWidth - 8) {
      left = rect.left - menuWidth - 6;
    }
    const top = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 176));
    setMenuPos({ top, left });
  };

  const handleSelect = () => {
    if (onSelect) {
      onSelect(conversation.id);
    } else {
      router.push(`/chat/${conversation.id}`);
    }
  };

  const handleTitleClick = () => {
    // The tap that released a long-press must not also open the chat
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    handleSelect();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/share/${conversation.id}`
      );
    } catch {
      // ignore
    }
  };

  const handleSaveRename = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (titleInput.trim() && titleInput !== conversation.title) {
      await onRename(conversation.id, titleInput.trim());
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await onDelete(conversation.id);
    setShowConfirmDelete(false);
  };

  const sheetActions = [
    {
      label: "Rename",
      icon: <PencilIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />,
      onSelect: () => setIsEditing(true),
    },
    {
      label: "Share chat",
      icon: <ShareFatIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />,
      onSelect: () => void handleShare(),
    },
    {
      label: "Delete",
      icon: <TrashIcon aria-hidden className="h-4 w-4 shrink-0" />,
      danger: true,
      onSelect: () => setShowConfirmDelete(true),
    },
  ];

  if (isEditing) {
    return (
      <form
        onSubmit={handleSaveRename}
        className="flex items-center gap-1 px-2 py-1"
      >
        <input
          type="text"
          autoFocus
          aria-label="Conversation title"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onBlur={handleSaveRename}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setTitleInput(conversation.title);
              setIsEditing(false);
            }
          }}
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-accent)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs text-[var(--color-text)] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-accent)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--color-text)] active:scale-[0.96]"
          title="Save"
          aria-label="Save title"
        >
          <CheckIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setTitleInput(conversation.title);
            setIsEditing(false);
          }}
          className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-tertiary)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--color-text)] active:scale-[0.96]"
          title="Cancel"
          aria-label="Cancel rename"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  if (showConfirmDelete) {
    return (
      <div className="rise-in flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--color-danger-muted)] px-3 py-2 text-xs">
        <span className="text-[var(--color-danger)]">Delete chat?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="rounded bg-[var(--color-danger)] px-3 py-1.5 font-medium text-[var(--color-on-danger)] transition-[opacity,transform] duration-[var(--duration-fast)] hover:opacity-90 active:scale-[0.96]"
          >
            Delete
          </button>
          <button
            onClick={() => setShowConfirmDelete(false)}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--color-text)] active:scale-[0.96]"
          >
            Keep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex h-9 w-full select-none items-center rounded-[var(--radius-lg)] pr-1 transition-colors duration-[var(--duration-normal)] [-webkit-touch-callout:none] ${
        isActive
          ? "bg-[var(--color-hover)] text-[var(--color-text)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearPress}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => {
        // Suppress the native text-selection callout a long-press would open
        if (longPressedRef.current) e.preventDefault();
      }}
    >
      <button
        type="button"
        onClick={handleTitleClick}
        aria-current={isActive ? "true" : undefined}
        className="min-w-0 flex-1 cursor-pointer truncate px-3 text-left text-sm"
      >
        <span className="truncate">{conversation.title}</span>
      </button>

      {/* Options menu trigger, revealed on hover or keyboard focus (desktop) */}
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Options for ${conversation.title}`}
        aria-haspopup="menu"
        aria-expanded={!!menuPos}
        onClick={(e) => {
          e.stopPropagation();
          if (menuPos) {
            setMenuPos(null);
          } else {
            openMenu();
          }
        }}
        className={`hidden h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] transition-[opacity,color,background-color] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] focus-visible:opacity-100 md:flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${
          menuPos ? "md:opacity-100" : ""
        }`}
      >
        <DotsThreeIcon aria-hidden className="h-4 w-4" weight="bold"/>
      </button>

      {/* Desktop: floating popover, portaled to body so the sidebar never clips it */}
      {menuPos &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setMenuPos(null)}
              aria-hidden
            />
            <div
              role="menu"
              aria-label={`${conversation.title} options`}
              style={{ top: menuPos.top, left: menuPos.left }}
              className="popover-in fixed z-50 w-56 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1 shadow-[var(--shadow-popover)]"
            >
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuPos(null);
                  setIsEditing(true);
                }}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.99]"
              >
                <PencilIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                <span className="flex-1">Rename</span>
              </button>
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuPos(null);
                  void handleShare();
                }}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.99]"
              >
                <ShareFatIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                <span className="flex-1">Share chat</span>
              </button>
              <div className="mx-1 my-1 border-t border-[var(--color-border)]" />
              <button
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuPos(null);
                  setShowConfirmDelete(true);
                }}
                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm font-medium text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger-muted)] active:scale-[0.99]"
              >
                <TrashIcon aria-hidden className="h-4 w-4 shrink-0" />
                <span className="flex-1">Delete</span>
              </button>
            </div>
          </>,
          document.body
        )}

      {/* Mobile: bottom sheet, opened by long-press on the item */}
      {sheetOpen && isMobile && (
        <ActionSheet
          title={conversation.title}
          actions={sheetActions}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
