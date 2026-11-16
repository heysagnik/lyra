"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDownIcon } from "@phosphor-icons/react";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import { ChatMessagesSkeleton } from "./chat-skeletons";
import type { AgentChatMessage } from "@/lib/api/use-agent-chat";

export interface MessageListProps {
  messages: AgentChatMessage[];
  isStreaming: boolean;
  isLoading?: boolean;
  onRegenerate?: () => void;
}

export function MessageList({
  messages,
  isStreaming,
  isLoading = false,
  onRegenerate,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);
  const isUserScrollingRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<number | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    programmaticScrollRef.current = true;
    if (programmaticTimerRef.current !== null) {
      window.clearTimeout(programmaticTimerRef.current);
    }
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !reduceMotion ? "smooth" : "auto",
    });
    programmaticTimerRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, smooth && !reduceMotion ? 700 : 50);
    setShowScrollBottomPill(false);
  }, []);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el || programmaticScrollRef.current) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 100;

    isUserScrollingRef.current = !isNearBottom;
    setShowScrollBottomPill(distanceFromBottom > 1200);
  };

  const firstMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    const first = messages[0]?.id ?? null;
    const switched =
      firstMessageIdRef.current !== null && first !== firstMessageIdRef.current;
    firstMessageIdRef.current = first;
    if (switched) {
      isUserScrollingRef.current = false;
      setShowScrollBottomPill(false);
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming, scrollToBottom]);

  if (messages.length === 0) {
    if (isLoading) {
      return (
        <div
          className="relative min-h-0 flex-1"
          aria-busy="true"
          aria-label="Loading conversation"
        >
          <ChatMessagesSkeleton />
        </div>
      );
    }
    return <EmptyState />;
  }

  const visibleMessages = messages.slice(-200);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-6 sm:px-4 pb-36 sm:pb-40"
      >
        <div className="mx-auto min-w-0 max-w-[42rem] break-words">
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
          style={{ translate: "-50%" }}
          className="pill-in absolute bottom-36 left-1/2 z-20 flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1.5 pl-2.5 pr-3 text-xs font-medium text-[var(--color-text)] shadow-[var(--shadow-dialog)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--color-hover)] active:scale-[0.96]"
        >
          <ArrowDownIcon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}
