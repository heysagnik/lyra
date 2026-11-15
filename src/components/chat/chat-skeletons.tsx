import { Skeleton, SkeletonLine, rowWidth } from "@/components/ui/skeleton";

const SIDEBAR_ROWS = 7;
const ASSISTANT_PARAGRAPHS = [
  ["88%", "100%", "64%"],
  ["76%", "52%"],
];

/**
 * The conversation area: a right-aligned user turn, then assistant turns
 * as text-width lines — mirroring how MessageBubble actually renders
 * markdown, not abstract gray blocks.
 */
export function ChatMessagesSkeleton() {
  return (
    <div className="h-full overflow-hidden px-3 py-6 sm:px-4">
      <div className="mx-auto flex max-w-[42rem] flex-col gap-5">
        {/* User turn */}
        <div className="fade-in flex justify-end">
          <Skeleton
            className="h-9 w-44 rounded-2xl"
            delay={0}
          />
        </div>

        {/* Assistant turns: markdown-width text lines */}
        {ASSISTANT_PARAGRAPHS.map((lines, p) => (
          <div
            key={p}
            className="fade-in flex flex-col gap-2.5"
            style={{ animationDelay: `${120 + p * 90}ms` }}
          >
            {lines.map((width, i) => (
              <SkeletonLine
                key={i}
                className="h-3"
                delay={160 + p * 90 + i * 45}
                style={{ width }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Sidebar list: transparent rows holding a title-width line, like the real list */
function SidebarListSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden px-3">
      <SkeletonLine className="mb-3 mt-4 h-3 w-20" delay={80} />
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: SIDEBAR_ROWS }, (_, i) => (
          <div
            key={i}
            className="fade-in flex h-9 items-center rounded-[var(--radius-lg)] px-3"
            style={{ animationDelay: `${100 + i * 40}ms` }}
          >
            <SkeletonLine
              className="h-3"
              delay={140 + i * 50}
              style={{ width: rowWidth(i) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Full chat shell for route-level loading (root loading.tsx). Mirrors the
 * real ChatContainer layout — sidebar, header, messages, composer — so
 * nothing jumps when the page replaces it. Everything except the
 * `aria-busy` announcement is decorative.
 */
export function ChatShellSkeleton() {
  return (
    <div
      className="fixed inset-0 flex w-full overflow-hidden bg-[var(--color-canvas)]"
      aria-busy="true"
      aria-label="Loading chat"
    >
      {/* Sidebar — mirrors Sidebar.tsx's fixed 280px column */}
      <aside
        aria-hidden
        className="hidden h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-sidebar)] md:flex"
      >
        {/* Wordmark row */}
        <div className="flex h-12 shrink-0 items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-[8px]" />
            <SkeletonLine className="h-4 w-14" delay={40} />
          </div>
          <Skeleton className="h-8 w-8 rounded-[var(--radius-md)]" delay={80} />
        </div>

        {/* New chat button */}
        <div className="shrink-0 px-3 pt-1">
          <div className="flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-lg)] px-3">
            <Skeleton className="h-4 w-4 rounded-[5px]" delay={120} />
            <SkeletonLine className="h-3 w-16" delay={160} />
          </div>
        </div>

        {/* Recent chats */}
        <SidebarListSkeleton />

        {/* Footer: avatar + name + plan pill */}
        <div className="shrink-0 border-t border-[var(--color-border)] p-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-7 rounded-full" delay={480} />
            <SkeletonLine className="h-3 flex-1" delay={520} />
            <Skeleton className="h-4 w-10 rounded-full" delay={560} />
          </div>
        </div>
      </aside>

      {/* Main column */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-canvas)] px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-[var(--radius-md)]" delay={200} />
            <SkeletonLine className="h-4 w-44" delay={240} />
          </div>
          <Skeleton className="h-8 w-20 rounded-[var(--radius-md)]" delay={280} />
        </header>

        <div aria-hidden className="min-h-0 flex-1">
          <ChatMessagesSkeleton />
        </div>

        {/* Composer */}
        <div className="flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
          <Skeleton
            className="h-14 w-full max-w-2xl rounded-[var(--radius-xl)]"
            delay={320}
          />
        </div>
      </main>
    </div>
  );
}
