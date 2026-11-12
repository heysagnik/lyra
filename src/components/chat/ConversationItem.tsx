"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import type { Conversation } from "@/types";

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
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

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
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--panel-2)] px-2 py-1.5 text-xs text-[var(--text)] focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-[var(--radius-md)] p-1.5 text-[var(--accent)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--text)] active:scale-[0.96]"
          title="Save"
          aria-label="Save title"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setTitleInput(conversation.title);
            setIsEditing(false);
          }}
          className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-faint)] transition-[color,transform] duration-[var(--duration-fast)] hover:text-[var(--text)] active:scale-[0.96]"
          title="Cancel"
          aria-label="Cancel rename"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  if (showConfirmDelete) {
    return (
      <div className="flex items-center justify-between rounded-[var(--radius-lg)] bg-[var(--danger-ground)] px-3 py-2 text-xs">
        <span className="text-[var(--danger)]">Delete chat?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="rounded bg-[var(--danger)] px-2 py-0.5 font-medium text-[var(--color-on-danger)] transition-opacity hover:opacity-90"
          >
            Delete
          </button>
          <button
            onClick={() => setShowConfirmDelete(false)}
            className="rounded border border-[var(--line)] px-2 py-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            Keep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (onSelect) {
            onSelect(conversation.id);
          } else {
            router.push(`/chat/${conversation.id}`);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onSelect) {
              onSelect(conversation.id);
            } else {
              router.push(`/chat/${conversation.id}`);
            }
          }
        }}
        className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-lg)] px-3 text-left text-sm transition-colors duration-[var(--duration-normal)] ${
          isActive
            ? "bg-[var(--panel-3)] text-[var(--text)]"
            : "text-[var(--text-muted)] hover:bg-[var(--panel-2)] hover:text-[var(--text)]"
        }`}
        aria-current={isActive ? "true" : undefined}
      >
        <span className="min-w-0 flex-1 truncate">{conversation.title}</span>

        {/* More menu trigger, revealed on hover */}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={showMenu}
          aria-label={`Options for ${conversation.title}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-faint)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--panel-3)] hover:text-[var(--text)] group-hover:flex"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Options menu */}
      {showMenu && (
        <>
          {/* Click-away layer */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
            aria-hidden
          />
          <div
            role="menu"
            aria-label={`Options for ${conversation.title}`}
            className="popover-in absolute right-2 top-full z-50 mt-1 w-32 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0.5 shadow-md"
          >
            <button
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setIsEditing(true);
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs font-medium text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.98]"
            >
              <Pencil aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />
              Rename
            </button>
            <button
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowConfirmDelete(true);
              }}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs font-medium text-[var(--color-danger)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger-muted)] active:scale-[0.98]"
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5 shrink-0" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
