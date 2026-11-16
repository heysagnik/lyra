"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LogoSpinner } from "@/components/brand/LogoSpinner";
import {
  BrainIcon,
  CaretDownIcon,
  CheckIcon,
  GlobeIcon,
  MagnifyingGlassIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

export type SearchState = "none" | "running" | "done" | "empty";

export interface ActivityTimelineProps {
  reasoning?: string;
  queries: string[];
  searchState: SearchState;
  sourceCount: number;
  /** The answer text has started (or finished) arriving. */
  answerStarted: boolean;
  /** This message is the one currently being generated. */
  isStreaming: boolean;
}

type StepStatus = "active" | "done" | "warn";

function formatSeconds(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "active") {
    return <LogoSpinner className="h-4 w-4 text-[var(--color-text)]" />;
  }
  if (status === "warn") {
    return <WarningCircleIcon aria-hidden className="h-3.5 w-3.5 text-[var(--color-warning)]" />;
  }
  return <CheckIcon aria-hidden className="icon-in h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />;
}

function Step({
  status,
  last,
  icon,
  label,
  meta,
  children,
}: {
  status: StepStatus;
  last: boolean;
  icon: React.ReactNode;
  label: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="step-in relative flex gap-2.5 pb-3 last:pb-0">
      {!last && (
        <span aria-hidden className="absolute left-[7px] top-5 bottom-0 w-px bg-[var(--color-border-strong)]/60" />
      )}
      <span className="relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <StatusIcon status={status} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          {icon}
          <span className={status === "active" ? "text-[var(--color-text)]" : undefined}>{label}</span>
          {meta ? <span className="text-[var(--color-text-tertiary)] tabular-nums">· {meta}</span> : null}
        </p>
        {children}
      </div>
    </li>
  );
}

function ReasoningBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 280;
  return (
    <div className="mt-1.5">
      <p
        className={`whitespace-pre-wrap break-words border-l border-[var(--color-border-strong)] pl-3 text-xs leading-relaxed text-[var(--color-text-tertiary)] ${
          expanded ? "max-h-72 overflow-y-auto" : "line-clamp-4"
        }`}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 pl-3 text-[11px] text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          {expanded ? "Show less" : "Show all"}
        </button>
      ) : null}
    </div>
  );
}

export function ActivityTimeline({
  reasoning,
  queries,
  searchState,
  sourceCount,
  answerStarted,
  isStreaming,
}: ActivityTimelineProps) {
  const panelId = useId();
  const hasReasoning = Boolean(reasoning?.trim());
  const searching = searchState === "running";
  const hasSearch = searchState !== "none";

  // Phase timing, measured on the client while the turn is live.
  const startedAt = useRef(Date.now());
  const [marks, setMarks] = useState<{ thoughtMs?: number; searchMs?: number }>({});
  const searchStartedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!isStreaming) return;
    if (searching && searchStartedAt.current === null) {
      searchStartedAt.current = Date.now();
      if (hasReasoning) setMarks((m) => ({ ...m, thoughtMs: Date.now() - startedAt.current }));
    }
    if (!searching && searchStartedAt.current !== null && marks.searchMs === undefined) {
      setMarks((m) => ({ ...m, searchMs: Date.now() - (searchStartedAt.current as number) }));
    }
    if (answerStarted && hasReasoning && marks.thoughtMs === undefined && !hasSearch) {
      setMarks((m) => ({ ...m, thoughtMs: Date.now() - startedAt.current }));
    }
  }, [isStreaming, searching, answerStarted, hasReasoning, hasSearch, marks.thoughtMs, marks.searchMs]);

  const live = isStreaming && !answerStarted;
  const thinkingActive = live && hasReasoning && !hasSearch;
  const planning = live && !hasReasoning && !hasSearch;

  // Open while work is happening, fold once the answer arrives; the user's choice wins.
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const expandable = hasReasoning && !planning;
  const open = expandable && (userToggled ?? live);

  if (!planning && !hasReasoning && !hasSearch) return null;


  let headline: string;
  if (planning) headline = "Understanding your question…";
  else if (searching) headline = queries.length > 1 ? `Searching the web · ${queries.length} queries…` : "Searching the web…";
  else if (thinkingActive) headline = "Thinking…";
  else if (live) headline = "Writing the answer…";
  else {
    const parts: string[] = [];
    if (hasReasoning) parts.push(marks.thoughtMs ? `Thought for ${formatSeconds(marks.thoughtMs)}` : "Thought it through");
    if (searchState === "empty") parts.push("Searched, no results");
    else if (hasSearch) {
      const q = queries.length > 1 ? `Searched ${queries.length} queries` : "Searched the web";
      parts.push(sourceCount > 0 ? `${q} · ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : q);
    }
    headline = parts.join(" · ");
  }

  return (
    <div className="mb-3 py-0.5">
      <button
        type="button"
        onClick={() => setUserToggled(!open)}
        disabled={!expandable}
        aria-expanded={open}
        aria-controls={panelId}
        className="group flex min-h-7 max-w-full items-center disabled:cursor-default gap-1.5 rounded-[var(--radius-sm)] py-1 text-xs text-[var(--color-text-tertiary)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--color-text-secondary)]"
      >
        {live ? (
          <LogoSpinner className="h-[18px] w-[18px] shrink-0 text-[var(--color-text-secondary)]" />
        ) : hasSearch ? (
          <GlobeIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <BrainIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
        )}
        <span role="status" aria-live="polite" className="truncate">
          {headline}
        </span>
        <CaretDownIcon
          aria-hidden
          className={`h-3 w-3 shrink-0 transition-transform ${expandable ? "" : "hidden"} duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <ol
          id={panelId}
          className="fade-in mt-1.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3.5 py-3"
        >
          {hasReasoning ? (
            <Step
              status={thinkingActive ? "active" : "done"}
              last={!hasSearch}
              icon={<BrainIcon aria-hidden className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />}
              label={thinkingActive ? "Thinking" : "Thought"}
              meta={!thinkingActive && marks.thoughtMs ? formatSeconds(marks.thoughtMs) : undefined}
            >
              <ReasoningBody text={reasoning as string} />
            </Step>
          ) : null}

          {hasSearch ? (
            <Step
              status={searching ? "active" : searchState === "empty" ? "warn" : "done"}
              last
              icon={<GlobeIcon aria-hidden className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />}
              label={searching ? "Searching the web" : "Searched the web"}
              meta={!searching && marks.searchMs ? formatSeconds(marks.searchMs) : undefined}
            >
              {queries.length > 0 ? (
                <ul className="mt-1.5 flex flex-col gap-1">
                  {queries.map((q) => (
                    <li
                      key={q}
                      className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"
                    >
                      <MagnifyingGlassIcon aria-hidden className="h-3 w-3 shrink-0 text-[var(--color-text-tertiary)]" />
                      <span className="truncate">{q}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!searching ? (
                <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                  {searchState === "empty"
                    ? "No results found. Answering from general knowledge."
                    : sourceCount > 0
                      ? `Read ${sourceCount} source${sourceCount === 1 ? "" : "s"}`
                      : null}
                </p>
              ) : null}
            </Step>
          ) : null}
        </ol>
      ) : null}
    </div>
  );
}
