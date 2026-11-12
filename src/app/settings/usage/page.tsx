"use client";

import { useQuery } from "@tanstack/react-query";
import { ClockIcon, LightningIcon, ChartLineUpIcon } from "@phosphor-icons/react";
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
    <div className="space-y-8">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
          Usage
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Your daily message allowance and rate limits.
        </p>
      </header>

      <section>
        <h2 className="mb-2 px-1 text-sm text-[var(--color-text-tertiary)]">
          Daily messages
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-1)]">
          <div className="flex min-h-12 items-center justify-between gap-4 px-5 py-3">
            <span className="text-sm text-[var(--color-text)]">
              Messages used
            </span>
            <span className="text-sm tabular-nums text-[var(--color-text-tertiary)]">
              {isLoading ? "…" : `${turnsUsed} of ${dailyLimit}`}
            </span>
          </div>

          <div className="px-5 pb-3">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percentUsed)}
              aria-label="Daily messages used"
              className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-3)]"
            >
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(percentUsed, 2))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
              {isLoading ? "…" : `${remaining} messages remaining today`}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-sm text-[var(--color-text-tertiary)]">
          Details
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-1)]">
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3">
            <span className="flex min-w-0 items-center gap-3 text-sm text-[var(--color-text)]">
              <LightningIcon
                aria-hidden
                className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
              />
              Rate limit
            </span>
            <span className="text-sm text-[var(--color-text-tertiary)]">
              20 req / min
            </span>
          </div>

          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3">
            <span className="flex min-w-0 items-center gap-3 text-sm text-[var(--color-text)]">
              <ChartLineUpIcon
                aria-hidden
                className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
              />
              Tokens today
            </span>
            <span className="text-sm tabular-nums text-[var(--color-text-tertiary)]">
              {isLoading ? "…" : totalTokens.toLocaleString()}
            </span>
          </div>

          <div className="flex min-h-12 items-center justify-between gap-4 px-5 py-3">
            <span className="flex min-w-0 items-center gap-3 text-sm text-[var(--color-text)]">
              <ClockIcon
                aria-hidden
                className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
              />
              Usage resets
            </span>
            <span className="text-sm text-[var(--color-text-tertiary)]">
              00:00 UTC
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
