import { Skeleton, SkeletonLine, rowWidth } from "@/components/ui/skeleton";

const NAV_ITEMS = 4;
const CARD_ROWS = [2, 3];

/**
 * A real settings card: rounded surface panel with divided rows, each row
 * a small label line above a wider content line (like the memory/session
 * lists on the actual pages).
 */
function CardSkeleton({ rows, baseDelay }: { rows: number; baseDelay: number }) {
  return (
    <div
      className="fade-in overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-1)]"
      style={{ animationDelay: `${baseDelay - 60}ms` }}
    >
      <div className="divide-y divide-[var(--color-border)]">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="px-5 py-4">
            <SkeletonLine className="h-3 w-20" delay={baseDelay + i * 60} />
            <SkeletonLine
              className="mt-2.5 h-3"
              delay={baseDelay + i * 60 + 30}
              style={{ width: rowWidth(i + 2) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Instant settings shell shown while the (force-dynamic) settings tree
 * renders on the server. Mirrors the real layout — mobile back link and
 * nav pills, desktop rail with icon + label rows, content as heading +
 * stacked cards — so nothing jumps when the page replaces it.
 */
export default function SettingsLoading() {
  return (
    <div
      className="min-h-screen bg-[var(--color-canvas)] md:flex"
      aria-busy="true"
      aria-label="Loading settings"
    >
      {/* Mobile: back link + nav pills */}
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--color-border)] bg-[var(--color-canvas)]/95 backdrop-blur-sm md:hidden">
        <div className="flex h-12 items-center px-2">
          <Skeleton className="h-7 w-20 rounded-[var(--radius-md)]" />
        </div>
        <div className="flex gap-1 overflow-hidden px-2 pb-2" aria-hidden>
          <Skeleton className="h-9 w-36 shrink-0 rounded-[var(--radius-lg)]" delay={60} />
          <Skeleton className="h-9 w-32 shrink-0 rounded-[var(--radius-lg)]" delay={100} />
        </div>
      </header>

      {/* Desktop: settings rail */}
      <aside
        aria-hidden
        className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col border-r border-[var(--color-border)] px-3 py-4 md:flex"
      >
        <div className="mb-5">
          <Skeleton className="h-7 w-24 rounded-[var(--radius-md)]" />
        </div>
        <div className="flex flex-col gap-0.5">
          {Array.from({ length: NAV_ITEMS }, (_, i) => (
            <div
              key={i}
              className="fade-in flex h-9 items-center gap-3 rounded-[var(--radius-lg)] px-3"
              style={{ animationDelay: `${40 + i * 50}ms` }}
            >
              <Skeleton className="h-4 w-4 rounded-[var(--radius-sm)]" delay={60 + i * 50} />
              <SkeletonLine
                className="h-3"
                delay={100 + i * 50}
                style={{ width: rowWidth(i + 3) }}
              />
            </div>
          ))}
        </div>
      </aside>

      {/* Content: heading + stacked cards, like a real settings page */}
      <div className="min-w-0 flex-1">
        <main
          aria-hidden
          className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-8 md:py-16"
        >
          <SkeletonLine className="h-5 w-44" delay={120} />
          <div className="mt-8 flex flex-col gap-3">
            <CardSkeleton rows={CARD_ROWS[0]} baseDelay={200} />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <SkeletonLine className="h-3 w-32" delay={260} />
            <CardSkeleton rows={CARD_ROWS[1]} baseDelay={320} />
          </div>
        </main>
      </div>
    </div>
  );
}
