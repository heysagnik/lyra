"use client";

import { useQuery } from "@tanstack/react-query";
import type { UserUsageStats } from "@/lib/db/queries/usage";

interface UsageApiResponse {
  ok: boolean;
  stats: UserUsageStats;
}

export default function UsageSettingsPage() {
  const { data, isLoading } = useQuery<UsageApiResponse>({
    queryKey: ["usage-stats"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      if (!res.ok) {
        throw new Error("Failed to load usage statistics");
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  const stats = data?.stats;
  const turnsUsed = stats?.today.turns ?? 0;
  const dailyLimit = stats?.today.dailyLimit ?? 300;
  const remaining = stats?.today.remainingDailyTurns ?? 300;
  const percentUsed = stats?.today.percentUsed ?? 0;
  const totalTokens = (stats?.today.tokensIn ?? 0) + (stats?.today.tokensOut ?? 0);

  return (
    <div className="max-w-xl space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
          Usage
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Your daily message allowance and rate limits.
        </p>
      </header>

      {/* Main Usage Card */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-[var(--color-text)]">
            Daily Messages
          </span>
          <span className="text-sm font-medium tabular-nums text-[var(--color-text-secondary)]">
            {isLoading ? "…" : `${turnsUsed} / ${dailyLimit}`}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${Math.max(isLoading ? 0 : 2, Math.min(100, percentUsed))}%` }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <span>
            {isLoading ? "Loading…" : `${remaining} messages remaining today`}
          </span>
          <span>Resets at 00:00 UTC</span>
        </div>
      </section>

      {/* Quick Details */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            Rate limit
          </span>
          <p className="mt-1 text-base font-semibold text-[var(--color-text)]">
            20 req / min
          </p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            Tokens today
          </span>
          <p className="mt-1 text-base font-semibold tabular-nums text-[var(--color-text)]">
            {isLoading ? "…" : totalTokens.toLocaleString()}
          </p>
        </div>
      </section>
    </div>
  );
}
