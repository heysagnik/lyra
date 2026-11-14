/**
 * Chat shell skeleton shown while the (force-dynamic) chat pages render on
 * the server — e.g. returning to the chat from Settings. Mirrors the real
 * ChatContainer layout so nothing jumps when the page replaces it, with
 * soft shimmer shapes instead of harsh pulse blocks.
 */
export default function ChatLoading() {
  return (
    <div
      className="fixed inset-0 flex w-full overflow-hidden bg-[var(--color-canvas)]"
      aria-busy="true"
      aria-label="Loading chat"
    >
      {/* Sidebar */}
      <aside
        aria-hidden
        className="hidden h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-sidebar)] md:block"
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-4">
          <div className="skeleton h-4 w-16 rounded-full" />
        </div>
        <div className="flex-1 space-y-2.5 overflow-hidden px-3 pt-1">
          <div className="skeleton h-9 w-full rounded-[var(--radius-lg)]" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-8 rounded-[var(--radius-lg)]" style={{ width: `${92 - (i % 3) * 9}%` }} />
          ))}
        </div>
        <div className="shrink-0 border-t border-[var(--color-border)] p-3">
          <div className="flex items-center gap-2.5">
            <div className="skeleton h-7 w-7 rounded-full" />
            <div className="skeleton h-3 flex-1 rounded-full" />
          </div>
        </div>
      </aside>

      {/* Main column */}
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-canvas)] px-4">
          <div className="flex items-center gap-2">
            <div className="skeleton h-6 w-6 rounded-[var(--radius-md)]" />
            <div className="skeleton h-4 w-44 rounded-full" />
          </div>
          <div className="skeleton h-7 w-20 rounded-[var(--radius-md)]" />
        </header>

        {/* Messages: user bubble + a few assistant text lines, like the real thing */}
        <div className="flex flex-1 items-start justify-center px-4 pt-10" aria-hidden>
          <div className="flex w-full max-w-[42rem] flex-col gap-4">
            <div className="flex justify-end">
              <div className="skeleton h-9 w-44 rounded-2xl" />
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="skeleton h-3 w-[88%] rounded-full" />
              <div className="skeleton h-3 w-full rounded-full" />
              <div className="skeleton h-3 w-[64%] rounded-full" />
            </div>
            <div className="flex flex-col gap-2.5 pt-3">
              <div className="skeleton h-3 w-[76%] rounded-full" />
              <div className="skeleton h-3 w-[52%] rounded-full" />
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="flex justify-center px-4 pb-4">
          <div className="skeleton h-14 w-full max-w-2xl rounded-[var(--radius-xl)]" />
        </div>
      </main>
    </div>
  );
}
