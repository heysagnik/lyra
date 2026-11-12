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
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    bottomAnchorRef.current?.scrollIntoView({
      behavior: smooth && !reduceMotion ? "smooth" : "auto",
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
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain px-4 py-6 pb-36 sm:pb-40"
      >
        <div className="mx-auto max-w-[40rem]">
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
      </div>

      {showScrollBottomPill && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Jump to the latest message"
          className="rise-in absolute bottom-36 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-2)] py-1.5 pl-2.5 pr-3 text-xs font-medium text-[var(--text)] shadow-[var(--shadow-dialog)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--panel-3)] active:scale-[0.96]"
        >
          <ArrowDown className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}
