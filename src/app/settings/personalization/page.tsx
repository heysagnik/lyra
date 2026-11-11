"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Brain, Trash2 } from "lucide-react";
import type { Memory } from "@/types";

const KIND_LABELS: Record<Memory["kind"], string> = {
  fact: "Fact",
  preference: "Preference",
  correction: "Correction",
};

export default function PersonalizationSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<{ memories: Memory[] }>({
    queryKey: ["memories"],
    queryFn: async () => {
      const res = await fetch("/api/memories");
      if (!res.ok) throw new Error("Failed to load memories");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete memory");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
  });

  const memories = data?.memories ?? [];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
          Chat memory
        </h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--color-text-tertiary)]">
          What lyra remembers about you across conversations. Delete anything
          that should be forgotten.
        </p>
      </header>

      <section>
        <h2 className="mb-2 px-1 text-sm text-[var(--color-text-tertiary)]">
          Memories
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-1)]">
          {isLoading ? (
            <div aria-hidden className="divide-y divide-[var(--color-border)]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="px-5 py-4">
                  <div className="h-3 w-20 animate-pulse rounded-full bg-[var(--color-surface-2)]" />
                  <div className="mt-2.5 h-3 w-3/4 animate-pulse rounded-full bg-[var(--color-surface-2)]" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <p role="alert" className="px-5 py-6 text-sm text-[var(--color-danger)]">
              Couldn&apos;t load memories. Try again later.
            </p>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <Brain
                aria-hidden
                className="h-8 w-8 text-[var(--color-text-tertiary)] opacity-60"
              />
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                Nothing remembered yet.
              </p>
              <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                As you chat, lyra saves facts and preferences it can reuse — they
                will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {memories.map((memory) => (
                <li
                  key={memory.id}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      {KIND_LABELS[memory.kind] ?? memory.kind}
                    </span>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text)]">
                      {memory.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(memory.id)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete memory: ${memory.content}`}
                    title="Forget this"
                    className="shrink-0 rounded-[var(--radius-md)] p-1.5 text-[var(--color-text-tertiary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-danger-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
