import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";

/**
 * Server-rendered markdown for read-only surfaces (share page).
 * Same typography as the interactive Markdown, minus client-side
 * affordances (copy buttons) — so long transcripts cost zero hydration.
 */
export function StaticMarkdown({ content }: { content: string }) {
  return (
    <div className="max-w-none leading-relaxed break-words text-[var(--color-text)] text-pretty">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSanitize]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code
                  className="font-coordinate rounded-[var(--radius-sm)] bg-[var(--color-surface-3)] px-1.5 py-0.5 text-[0.85em] text-[var(--color-text)]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <div className="font-coordinate my-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-code-canvas)] text-xs">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-tertiary)]">
                  <span className="lowercase tracking-wide">
                    {/language-(\w+)/.exec(className || "")?.[1] || "text"}
                  </span>
                </div>
                <pre className="hljs overflow-x-auto p-3 leading-relaxed text-[var(--color-text)]">
                  <code>{children}</code>
                </pre>
              </div>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/40 underline-offset-2 transition-colors duration-[var(--duration-fast)] hover:decoration-[var(--color-accent)]"
              >
                {children}
              </a>
            );
          },
          h1: (props) => (
            <h2
              className="mt-5 mb-2 text-xl font-semibold text-[var(--color-text)]"
              {...props}
            />
          ),
          h2: (props) => (
            <h3
              className="mt-4 mb-2 text-lg font-semibold text-[var(--color-text)]"
              {...props}
            />
          ),
          h3: (props) => (
            <h4
              className="mt-3 mb-1.5 text-sm font-semibold tracking-wide text-[var(--color-text)]"
              {...props}
            />
          ),
          ul: (props) => (
            <ul
              className="my-3 list-disc space-y-1.5 pl-5 marker:text-[var(--color-text-tertiary)]"
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              className="my-3 list-decimal space-y-1.5 pl-5 marker:text-[var(--color-text-tertiary)]"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="my-3 border-l-2 border-[var(--color-border-strong)] pl-3 text-[var(--color-text-secondary)] italic"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table
                className="w-full border-collapse border border-[var(--color-border)] text-xs"
                {...props}
              />
            </div>
          ),
          th: (props) => (
            <th
              className="font-coordinate border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-left text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]"
              {...props}
            />
          ),
          td: (props) => (
            <td
              className="border border-[var(--color-border)] px-2.5 py-1.5 text-[var(--color-text)]"
              {...props}
            />
          ),
          hr: () => <hr className="my-4 border-[var(--color-border)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
