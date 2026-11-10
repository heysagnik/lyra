"use client";

import { useState } from "react";
import { MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";
import type { Conversation } from "@/types";

export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function formatRelativeTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24 && now.getDate() === d.getDate()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffHours < 48) {
    return "Yesterday";
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
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
        className="flex items-center gap-1 px-3 py-2"
      >
        <input
          type="text"
          autoFocus
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          className="flex-1 rounded border border-blue-500 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none"
        />
        <button
          type="submit"
          className="p-1 text-green-600 hover:text-green-700"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setTitleInput(conversation.title);
            setIsEditing(false);
          }}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  if (showConfirmDelete) {
    return (
      <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-xs">
        <span className="text-red-700">Delete chat?</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-700"
          >
            Yes
          </button>
          <button
            onClick={() => setShowConfirmDelete(false)}
            className="rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
          >
            No
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
      onClick={() => onSelect(conversation.id)}
      className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors ${
        isActive
          ? "bg-blue-50 font-medium text-blue-700"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MessageSquare
          className={`h-3.5 w-3.5 shrink-0 ${
            isActive ? "text-blue-600" : "text-gray-400"
          }`}
        />
        <span className="truncate">{conversation.title}</span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!showMenu && (
          <span className="text-[11px] text-gray-400 tabular-nums">
            {formatRelativeTime(conversation.updatedAt)}
          </span>
        )}

        {showMenu && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Rename"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="p-1 text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
