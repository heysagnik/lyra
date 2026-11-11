import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedConversation } from "@/lib/db/queries/conversations";
import { listConversationMessages } from "@/lib/db/queries/messages";
import { StaticMarkdown } from "@/components/chat/StaticMarkdown";
import { SourcesRow } from "@/components/chat/SourcesRow";
import { LogoMark } from "@/components/brand/LogoMark";
import { Wordmark } from "@/components/brand/Wordmark";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const conversation = await getSharedConversation(id);
  return {
    title: conversation ? `${conversation.title} — shared from lyra` : "Shared chat",
    robots: { index: false },
  };
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Conversation ids are UUIDs; anything else is a 404, not a DB error
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }
  const conversation = await getSharedConversation(id);
  if (!conversation) notFound();

  const messages = await listConversationMessages(id);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      {/* App bar */}
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-4 sm:px-6">
        <Wordmark className="text-lg">
          <LogoMark className="h-5 w-5" />
          lyra
        </Wordmark>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:py-14">
        {/* Meta: title and date together, one quiet line above the card */}
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h1 className="min-w-0 truncate text-sm font-medium text-[var(--color-text-secondary)]">
            {conversation.title}
          </h1>
          <time
            dateTime={new Date(conversation.createdAt).toISOString()}
            className="font-coordinate shrink-0 text-[11px] text-[var(--color-text-tertiary)] tabular-nums"
          >
            {formatTimestamp(new Date(conversation.createdAt))}
          </time>
        </div>

        {/* Transcript card */}
        <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 sm:p-7">
          <div className="space-y-1">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex w-full justify-end py-2">
                  <div className="max-w-[85%] rounded-[var(--radius-lg)] bg-[var(--color-surface-3)] px-4 py-2.5 text-sm leading-relaxed text-[var(--color-text)] break-words">
                    {m.content}
                  </div>
                </div>
              ) : m.content ? (
                <div
                  key={m.id}
                  className="w-full py-2 text-sm [content-visibility:auto] [contain-intrinsic-size:auto_120px]"
                >
                  <StaticMarkdown content={m.content} />
                  {m.sources && m.sources.length > 0 && (
                    <SourcesRow sources={m.sources} />
                  )}
                </div>
              ) : null
            )}
          </div>
        </article>

        {/* CTA directly under the card */}
        <div className="mt-10 text-center">
          <h2
            className="text-xl font-semibold text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-wordmark)" }}
          >
            Continue the conversation in lyra
          </h2>
          <Link
            href="/"
            className="mx-auto mt-5 flex h-12 max-w-sm items-center justify-center rounded-full bg-[var(--color-text)] text-sm font-semibold text-[var(--color-text-inverse)] transition-[opacity,transform] duration-[var(--duration-fast)] hover:opacity-90 active:scale-[0.96]"
          >
            Open lyra
          </Link>
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            Free to use — your own chats stay private.
          </p>
        </div>
      </main>

      <footer className="shrink-0 px-4 pb-8 text-center">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Shared via link — anyone with this URL can view this conversation.
        </p>
      </footer>
    </div>
  );
}
