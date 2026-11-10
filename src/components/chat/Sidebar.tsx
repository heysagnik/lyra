"use client";

import { Plus, X, LogOut } from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import { signOut } from "@/lib/auth/client";
import type { Conversation } from "@/types";

export interface SidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/sign-in";
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
        />
      )}

      {/* Sidebar container: 280px fixed width */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-gray-200 bg-[#F9FAFB] transition-transform md:static md:translate-x-0 ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header with New Chat */}
        <div className="flex items-center justify-between border-b border-gray-200 p-3">
          <button
            onClick={onNewChat}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-xs transition-colors hover:bg-gray-50 hover:border-gray-400"
          >
            <Plus className="h-3.5 w-3.5 text-blue-600" />
            <span>New chat</span>
          </button>

          <button
            onClick={onCloseMobile}
            className="ml-2 p-1.5 text-gray-500 hover:text-gray-800 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <div className="px-2 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Conversations
          </div>
          {conversations.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400">
              No conversations yet
            </div>
          ) : (
            conversations.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                isActive={c.id === activeConversationId}
                onSelect={(id) => {
                  onSelectConversation(id);
                  onCloseMobile();
                }}
                onRename={onRenameConversation}
                onDelete={onDeleteConversation}
              />
            ))
          )}
        </div>

        {/* Footer with sign out */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          >
            <LogOut className="h-3.5 w-3.5 text-gray-400" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
