"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import type { AgentChatMessage } from "@/lib/api/use-agent-chat";

export interface MessageListProps {
  messages: AgentChatMessage[];
  isStreaming: boolean;
  onRegenerate?: () => void;
}

export function MessageList({
  messages,
  isStreaming,
  onRegenerate,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);
  const isUserScrollingRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomAnchorRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
    setShowScrollBottomPill(false);
  }, []);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 100;

    isUserScrollingRef.current = !isNearBottom;
    setShowScrollBottomPill(!isNearBottom);
  };

  // Scroll on new messages or stream chunks unless user scrolled up
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming, scrollToBottom]);

  if (messages.length === 0) {
    return <EmptyState />;
  }

  // Render up to last 200 messages for smooth performance
  const visibleMessages = messages.slice(-200);

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="relative flex-1 overflow-y-auto px-4 py-6"
    >
      <div className="mx-auto max-w-3xl">
        {visibleMessages.map((msg, idx) => (
          <MessageBubble
            key={msg.id || idx}
            message={msg}
            isLatestStreaming={isStreaming && idx === visibleMessages.length - 1}
            onRegenerate={
              !isStreaming && onRegenerate && idx === visibleMessages.length - 1
                ? onRegenerate
                : undefined
            }
          />
        ))}
        <div ref={bottomAnchorRef} className="h-4" />
      </div>

      {showScrollBottomPill && (
        <button
          onClick={() => scrollToBottom(true)}
          className="rise-in fixed bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] transition-colors duration-[var(--duration-normal)] hover:bg-[var(--panel-3)] active:scale-[0.97]"
        >
          <ArrowDown className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}
