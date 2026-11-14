/**
 * Instant settings shell shown while the (force-dynamic) settings tree
 * renders on the server. Mirrors the real layout so nothing jumps when
 * the page replaces it, with soft shimmer shapes instead of pulse blocks.
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
          <div className="skeleton h-7 w-20 rounded-[var(--radius-md)]" />
        </div>
        <div className="flex gap-1 overflow-hidden px-2 pb-2" aria-hidden>
          <div className="skeleton h-8 w-36 shrink-0 rounded-[var(--radius-md)]" />
          <div className="skeleton h-8 w-32 shrink-0 rounded-[var(--radius-md)]" />
        </div>
      </header>

      {/* Desktop: settings rail */}
      <aside
        aria-hidden
        className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col border-r border-[var(--color-border)] px-3 py-4 md:flex"
      >
        <div className="mb-5">
          <div className="skeleton h-7 w-24 rounded-[var(--radius-md)]" />
        </div>
        <div className="flex flex-col gap-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-8 rounded-[var(--radius-md)]" style={{ width: `${100 - (i % 2) * 8}%` }} />
          ))}
        </div>
      </aside>

      {/* Content: heading + stacked card rows, like a real settings page */}
      <div className="min-w-0 flex-1">
        <main
          aria-hidden
          className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-8 md:py-16"
        >
          <div className="skeleton h-5 w-44 rounded-full" />
          <div className="mt-8 flex flex-col gap-3">
            <div className="skeleton h-12 w-full rounded-[var(--radius-xl)]" />
            <div className="skeleton h-12 w-full rounded-[var(--radius-xl)]" />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <div className="skeleton h-3 w-32 rounded-full" />
            <div className="skeleton h-12 w-full rounded-[var(--radius-xl)]" />
            <div className="skeleton h-12 w-full rounded-[var(--radius-xl)]" />
            <div className="skeleton h-12 w-full rounded-[var(--radius-xl)]" />
          </div>
        </main>
      </div>
    </div>
  );
}
