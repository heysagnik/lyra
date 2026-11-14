"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowDownIcon } from "@phosphor-icons/react";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import type { AgentChatMessage } from "@/lib/api/use-agent-chat";

export interface MessageListProps {
  messages: AgentChatMessage[];
  isStreaming: boolean;
  /** True while the conversation's messages are being fetched (first visit) */
  isLoading?: boolean;
  onRegenerate?: () => void;
}

/** Skeleton shown while a conversation loads for the first time */
function ConversationSkeleton() {
  return (
    <div className="relative min-h-0 flex-1" aria-busy="true" aria-label="Loading conversation">
      <div className="h-full overflow-hidden px-4 py-6">
        <div className="mx-auto flex max-w-[42rem] flex-col gap-5">
          <div className="flex justify-end">
            <div className="skeleton h-9 w-44 rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <div className="skeleton h-16 w-full max-w-md rounded-2xl" />
          </div>
          <div className="flex justify-start">
            <div className="skeleton h-10 w-3/4 max-w-sm rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
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
    setShowScrollBottomPill(!isNearBottom);
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

  // Scroll on new messages or stream chunks unless user scrolled up
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming, scrollToBottom]);

  if (messages.length === 0) {
    if (isLoading) {
      return <ConversationSkeleton />;
    }
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
        <div className="mx-auto max-w-[42rem]">
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
          className="pill-in absolute bottom-36 left-1/2 z-50 flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-2)] py-1.5 pl-2.5 pr-3 text-xs font-medium text-[var(--color-text)] shadow-[var(--shadow-dialog)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--color-hover)] active:scale-[0.96]"
        >
          <ArrowDownIcon className="h-3.5 w-3.5 text-[var(--color-accent)]" />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
}
