"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
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

export function Markdown({ content }: { content: string }) {
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
              className="font-display mt-5 mb-2 text-xl text-[var(--text)]"
              {...props}
            />
          ),
          h2: (props) => (
            <h3
              className="font-display mt-4 mb-2 text-lg text-[var(--text)]"
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
