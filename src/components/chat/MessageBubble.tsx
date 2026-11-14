"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { Markdown } from "./Markdown";
import { SourcesRow } from "./SourcesRow";
import { ToolBadge } from "./ToolBadge";
import type { AgentChatMessage } from "@/lib/api/use-agent-chat";

export interface MessageBubbleProps {
  message: AgentChatMessage;
  isLatestStreaming?: boolean;
  /** Wire regenerate only for the newest assistant turn */
  onRegenerate?: () => void;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatShort(date: Date): string {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFull(date: Date): string {
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageBubble({
  message,
  isLatestStreaming = false,
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  // Relative time after mount; absolute date during SSR to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isUser = message.role === "user";
  const createdAt = message.createdAt ? new Date(message.createdAt) : null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isUser) {
    return (
      <div className="flex w-full flex-col items-end py-2">
        <div className="max-w-[85%] rounded-2xl bg-[var(--color-surface-3)] px-4 py-2.5 text-sm leading-relaxed text-[var(--color-text)] break-words">
          {message.content}
        </div>
      </div>
    );
  }

  const toolPart = message.parts?.find(
    (p) =>
      p.type === "tool-invocation" ||
      p.type === "tool-call" ||
      p.type === "tool-input-available" ||
      p.type.startsWith("tool-") ||
      "toolInvocation" in p ||
      "toolCallId" in p
  );
  // Every distinct search query this turn: persisted tool calls plus the
  // live streaming tool part, deduped in order.
  const toolQueries: string[] = [];
  const pushQuery = (q: unknown) => {
    if (typeof q === "string" && q.trim() && !toolQueries.includes(q.trim())) {
      toolQueries.push(q.trim());
    }
  };
  for (const call of (message.toolCalls as Array<{ query?: string }> | undefined) ?? []) {
    pushQuery(call?.query);
  }
  const partInput =
    (toolPart as { input?: { query?: string } })?.input?.query ||
    (toolPart as { args?: { query?: string } })?.args?.query ||
    (toolPart as { toolInvocation?: { args?: { query?: string } } })?.toolInvocation?.args
      ?.query;
  pushQuery(partInput);

  const hasToolPart =
    !!toolPart ||
    Boolean(message.sources && message.sources.length > 0) ||
    Boolean(message.toolCalls && (message.toolCalls as unknown[]).length > 0);

  if (!message.content && !hasToolPart && !isLatestStreaming && !message.sources?.length) {
    return null;
  }

  return (
    <div className="w-full py-3">
      {hasToolPart && <ToolBadge queries={toolQueries} isComplete={!isLatestStreaming} />}

      {message.content ? (
        <Markdown content={message.content} sources={message.sources} />
      ) : isLatestStreaming ? (
        <div className="flex items-center gap-2 py-1 text-xs text-[var(--color-text-tertiary)]">
          <span
            aria-hidden
            className="thinking-star h-1.5 w-1.5 rounded-full bg-[var(--color-text-secondary)]"
          />
          <span>Thinking…</span>
        </div>
      ) : null}

      {message.sources && message.sources.length > 0 && (
        <SourcesRow sources={message.sources} />
      )}

      {!isLatestStreaming && message.content && (
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy message"
            title="Copy"
            className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-[color,background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-secondary)] active:scale-[0.96]"
          >
            {copied ? (
              <CheckIcon aria-hidden key="copied" className="icon-in h-3.5 w-3.5 text-[var(--color-success)]" />
            ) : (
              <CopyIcon aria-hidden className="h-3.5 w-3.5" />
            )}
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate response"
              title="Regenerate"
              className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-secondary)] active:scale-[0.96]"
            >
              <ArrowsClockwiseIcon aria-hidden className="h-3.5 w-3.5" />
            </button>
          )}
          {createdAt && mounted && (
            <time
              dateTime={createdAt.toISOString()}
              title={formatFull(createdAt)}
              className="font-coordinate ml-1 text-[11px] text-[var(--color-text-tertiary)] tabular-nums"
            >
              {isToday(createdAt) ? relativeTime(createdAt) : formatShort(createdAt)}
            </time>
          )}
        </div>
      )}
    </div>
  );
}
