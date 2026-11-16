"use client";

import { useId, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import type { SearchSource } from "@/types";

export interface SourcesRowProps {
  sources: SearchSource[];
}

const STACK_COUNT = 3;

/**
 * Site icon with a letter fallback. Loaded straight from Google's favicon
 * service (host name only, no referrer); if it fails or is blocked we show the
 * site's first letter instead.
 */
function Favicon({ hostname, className }: { hostname: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || hostname === "source") {
    return (
      <span className={`${className} flex items-center justify-center text-[10px] font-medium uppercase text-[var(--color-text-secondary)]`}>
        {hostname.charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote favicon, size known
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
      className={`${className} object-cover`}
    />
  );
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

/** ISO dates become "Nov 15"; relative strings from the search provider pass through. */
function formatDate(raw?: string | null): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  }
  return raw.length <= 18 ? raw : null;
}

export function SourcesRow({ sources }: SourcesRowProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!sources || sources.length === 0) return null;

  return (
    <section aria-label="Sources" className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="group flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] py-1 pl-1.5 pr-3 text-xs text-[var(--color-text-secondary)] transition-[border-color,background-color,color,transform] duration-[var(--duration-normal)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] active:scale-[0.98]"
      >
        <span aria-hidden className="flex -space-x-1.5">
          {sources.slice(0, STACK_COUNT).map((s, i) => (
            <Favicon
              key={s.url + i}
              hostname={getHostname(s.url)}
              className="h-5 w-5 rounded-full border-2 border-[var(--color-surface-1)] bg-[var(--color-surface-3)] transition-colors group-hover:border-[var(--color-hover)]"
            />
          ))}
        </span>
        <span>
          {sources.length} source{sources.length === 1 ? "" : "s"}
        </span>
        <CaretDownIcon
          aria-hidden
          className={`h-3 w-3 transition-transform duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <ol
          id={listId}
          className="fade-in mt-2 divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]"
        >
          {sources.map((source, index) => {
            const hostname = getHostname(source.url);
            const date = formatDate(source.date);
            return (
              <li key={source.url + index}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-3 px-3 py-2.5 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-[11px] font-medium tabular-nums text-[var(--color-text-secondary)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--color-text)]">
                      {source.title || hostname}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                      <Favicon hostname={hostname} className="h-3.5 w-3.5 shrink-0 rounded-sm" />
                      <span className="truncate">
                        {hostname}
                        {date ? ` · ${date}` : ""}
                      </span>
                    </span>
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
