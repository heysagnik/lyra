"use client";

import { useState, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import type { SearchSource } from "@/types";

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

/**
 * Interactive hoverable source citation card.
 */
function CitationHoverCard({
  source,
  index,
}: {
  source: SearchSource;
  index: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const hostname = getHostname(source.url);

  return (
    <span
      className="relative inline-block align-baseline not-prose"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Source ${index}: ${source.title || hostname}`}
        className="font-coordinate mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-[var(--color-surface-2)] px-1 text-[10px] font-semibold text-[var(--color-accent)] ring-1 ring-[var(--color-border)] transition-[background-color,color,ring-color] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)] hover:ring-[var(--color-accent)]/50 active:scale-95"
      >
        {index}
      </a>

      {isOpen && (
        <span
          role="tooltip"
          className="rise-in absolute bottom-full left-1/2 z-50 mb-1.5 w-64 max-w-[280px] -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2.5 text-left shadow-lg"
        >
          {/* Header */}
          <span className="mb-1 flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
            <span className="font-semibold text-[var(--color-accent)]">[{index}]</span>
            <span className="font-coordinate max-w-[180px] truncate text-[10px] text-[var(--color-text-tertiary)]">
              {hostname}
            </span>
          </span>

          {/* Title */}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 line-clamp-2 block text-xs font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-accent)]"
          >
            {source.title || hostname}
            <ExternalLink className="ml-1 inline h-2.5 w-2.5 opacity-50" />
          </a>

          {/* Snippet */}
          {source.snippet && (
            <span className="line-clamp-2 block text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
              {source.snippet}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Safely converts [1], [2], [1, 2] in text into markdown links for citations,
 * preserving code blocks and backticks intact.
 */
export function linkifyCitations(text: string, sourcesCount: number): string {
  if (!text || sourcesCount <= 0) return text;
  const parts = text.split(/(```[\s\S]*?```|`[^`]*?`)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      const normalized = part.replace(/\[(\d+(?:\s*,\s*\d+)+)\]/g, (_, nums) => {
        return nums
          .split(",")
          .map((n: string) => `[${n.trim()}]`)
          .join("");
      });
      return normalized.replace(/\[(\d+)\](?!\()/g, (match, numStr) => {
        const num = parseInt(numStr, 10);
        if (num >= 1 && num <= sourcesCount) {
          return `[[${num}]](#source-${num})`;
        }
        return match;
      });
    })
    .join("");
}

function CodeBlock({ className, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="font-coordinate my-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--line-soft)] bg-[var(--panel)] text-xs">
      <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-3 py-1.5 text-[var(--text-faint)]">
        <span className="lowercase tracking-wide">{language || "text"}</span>
        <button
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1 text-[11px] transition-colors duration-[var(--duration-normal)] hover:text-[var(--accent)]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="text-[var(--accent)]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="hljs overflow-x-auto p-3 leading-relaxed text-[var(--text)]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Markdown({
  content,
  sources,
}: {
  content: string;
  sources?: SearchSource[];
}) {
  const processedContent = useMemo(
    () => linkifyCitations(content, sources?.length ?? 0),
    [content, sources?.length]
  );

  return (
    <div className="max-w-none leading-relaxed break-words text-[var(--text)] text-pretty">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSanitize]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code
                  className="font-coordinate rounded bg-[var(--panel-3)] px-1.5 py-0.5 text-[0.85em] text-[var(--text)]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          a({ href, children }) {
            if (href?.startsWith("#source-") && sources?.length) {
              const numStr = href.replace("#source-", "");
              const sourceIdx = parseInt(numStr, 10) - 1;
              const source = sources[sourceIdx];
              if (source) {
                return <CitationHoverCard source={source} index={sourceIdx + 1} />;
              }
            }

            if (sources?.length) {
              const childText = String(children || "").trim();
              const match = /^\[?(\d+)\]?$/.exec(childText);
              if (match) {
                const sourceIdx = parseInt(match[1], 10) - 1;
                const source = sources[sourceIdx];
                if (source) {
                  return <CitationHoverCard source={source} index={sourceIdx + 1} />;
                }
              }
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 transition-colors duration-[var(--duration-normal)] hover:decoration-[var(--accent)]"
              >
                {children}
              </a>
            );
          },
          h1: (props) => (
            <h2
              className="font-display mt-5 mb-2 text-xl text-[var(--text)] text-wrap-balance"
              {...props}
            />
          ),
          h2: (props) => (
            <h3
              className="font-display mt-4 mb-2 text-lg text-[var(--text)] text-wrap-balance"
              {...props}
            />
          ),
          h3: (props) => (
            <h4
              className="mt-3 mb-1.5 text-sm font-semibold tracking-wide text-[var(--text)]"
              {...props}
            />
          ),
          ul: (props) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-[var(--color-text-tertiary)]" {...props} />
          ),
          ol: (props) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-[var(--color-text-tertiary)]" {...props} />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-3 border-l-2 border-[var(--accent)]/40 pl-3 text-[var(--text-muted)] italic"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table
                className="w-full border-collapse border border-[var(--line-soft)] text-xs"
                {...props}
              />
            </div>
          ),
          th: (props) => (
            <th
              className="font-coordinate border border-[var(--line-soft)] bg-[var(--panel-2)] px-2.5 py-1.5 text-left text-[10px] uppercase tracking-wider text-[var(--text-muted)]"
              {...props}
            />
          ),
          td: (props) => (
            <td
              className="border border-[var(--line-soft)] px-2.5 py-1.5 text-[var(--text)]"
              {...props}
            />
          ),
          hr: () => <hr className="my-4 border-[var(--line-soft)]" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
