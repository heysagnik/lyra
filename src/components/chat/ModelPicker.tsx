"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDownIcon, CaretRightIcon, CheckIcon } from "@phosphor-icons/react";
import { PROVIDERS, REGISTERED_MODELS, resolveModelDefinition } from "@/lib/llm/models";

export type EffortLevel = "low" | "standard" | "max";

export const EFFORT_LEVELS: { id: EffortLevel; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "Quick, brief answers" },
  { id: "standard", label: "Medium", hint: "Balanced depth" },
  { id: "max", label: "High", hint: "Most thorough, slower" },
];

export interface ModelPickerProps {
  /** Registry id or model id; unknown ids resolve to the default model. */
  model: string;
  onModelChange: (id: string) => void;
  effort: EffortLevel;
  onEffortChange: (effort: EffortLevel) => void;
}

function formatContext(tokens: number): string {
  return tokens >= 1_000_000 ? `${Math.round(tokens / 1_000_000)}M` : `${Math.round(tokens / 1000)}K`;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-[var(--color-surface-3)] px-1.5 py-px text-[10px] font-normal text-[var(--color-text-secondary)]">
      {children}
    </span>
  );
}

/** True on phones and touch devices (no hover), where the picker is a bottom sheet. */
function useSheetMode(): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (hover: none)");
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return matches;
}

function ModelSheet({
  activeId,
  effort,
  onSelectModel,
  onEffortChange,
  onClose,
}: {
  activeId: string;
  effort: EffortLevel;
  onSelectModel: (id: string) => void;
  onEffortChange: (effort: EffortLevel) => void;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheetRef.current?.focus();
  }, []);
  const effortIndex = Math.max(0, EFFORT_LEVELS.findIndex((e) => e.id === effort));

  return createPortal(
    <>
      <div className="fade-in fixed inset-0 z-[70] bg-[var(--color-scrim)]" onClick={onClose} aria-hidden />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Model and effort"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="sheet-in fixed inset-x-0 bottom-0 z-[80] mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 shadow-[var(--shadow-drawer)] outline-none"
      >
        <div aria-hidden className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-[var(--color-surface-3)]" />
        <p className="px-3 pb-1 pt-1 text-xs text-[var(--color-text-tertiary)]">Model</p>
        <div role="listbox" aria-label="Model" className="flex flex-col">
          {REGISTERED_MODELS.map((m) => {
            const selected = m.id === activeId;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onSelectModel(m.id)}
                className="flex h-12 w-full items-center gap-2 rounded-[var(--radius-lg)] px-3 text-left transition-colors duration-[var(--duration-fast)] active:bg-[var(--color-hover)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                    <span className="truncate">{m.label}</span>
                    {m.isDefaultPrimary ? <Tag>Default</Tag> : m.experimental ? <Tag>Experimental</Tag> : null}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-text-tertiary)]">{m.description}</span>
                </span>
                {selected ? <CheckIcon aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-text)]" /> : null}
              </button>
            );
          })}
        </div>

        <p className="px-3 pb-1.5 pt-4 text-xs text-[var(--color-text-tertiary)]">Effort</p>
        <div
          role="radiogroup"
          aria-label="Effort"
          className="relative mx-1 grid h-11 select-none grid-cols-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] p-1"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/3)] rounded-[var(--radius-md)] bg-[var(--color-surface-3)] transition-transform duration-[var(--duration-slow)] [transition-timing-function:var(--ease-drawer)]"
            style={{ transform: `translateX(${effortIndex * 100}%)` }}
          />
          {EFFORT_LEVELS.map((lvl) => {
            const selected = lvl.id === effort;
            return (
              <button
                key={lvl.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onEffortChange(lvl.id)}
                className={`relative z-10 rounded-[var(--radius-md)] text-sm transition-colors duration-[var(--duration-fast)] ${
                  selected ? "font-medium text-[var(--color-text)]" : "text-[var(--color-text-tertiary)]"
                }`}
              >
                {lvl.label}
              </button>
            );
          })}
        </div>
        <p className="px-3 pb-1 pt-2 text-xs text-[var(--color-text-tertiary)]">
          {EFFORT_LEVELS[effortIndex].hint}
        </p>
      </div>
    </>,
    document.body
  );
}

export function ModelPicker({ model, onModelChange, effort, onEffortChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const sheetMode = useSheetMode();

  const active = resolveModelDefinition(model);
  // The row whose effort submenu is showing; null until a row is hovered or keyboard-focused.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [anchorTop, setAnchorTop] = useState(0);
  const shown = focusedId ? resolveModelDefinition(focusedId) : null;
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const effortLabel = EFFORT_LEVELS.find((e) => e.id === effort)?.label ?? "Medium";

  useEffect(() => {
    if (!open || sheetMode) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open, sheetMode]);

  useEffect(() => {
    if (!open || sheetMode) return;
    setFocusedId(null);
    rootRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Show the submenu for a row, lined up with it (clamped so it stays inside the panel's height). */
  const reveal = (id: string, row: HTMLElement) => {
    const panel = panelRef.current;
    const list = listRef.current;
    if (panel && list) {
      setAnchorTop(Math.max(0, Math.min(row.offsetTop - list.scrollTop - 4, panel.clientHeight - 172)));
    }
    setFocusedId(id);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const q = <T extends HTMLElement>(sel: string) =>
    Array.from(rootRef.current?.querySelectorAll<T>(sel) ?? []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    const inSubmenu = (e.target as HTMLElement).closest('[role="menu"]') !== null;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = q<HTMLElement>(inSubmenu ? '[role="menuitemradio"]' : '[role="option"]');
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
      items[next]?.focus();
    } else if (e.key === "ArrowRight" && !inSubmenu && shown) {
      e.preventDefault();
      q<HTMLElement>('[role="menuitemradio"]')[0]?.focus();
    } else if (e.key === "ArrowLeft" && inSubmenu && shown) {
      e.preventDefault();
      q<HTMLElement>(`[role="option"][data-id="${shown.id}"]`)[0]?.focus();
    }
  };

  const choose = (id: string, next?: EffortLevel) => {
    onModelChange(id);
    if (next) onEffortChange(next);
    close();
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup={sheetMode ? "dialog" : "listbox"}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-[var(--radius-lg)] px-2 py-1.5 text-xs text-[var(--color-text)] transition-[background-color,transform] duration-[var(--duration-normal)] hover:bg-[var(--color-hover)] active:scale-[0.98] sm:text-sm"
      >
        <span className="font-medium">{active.label}</span>
        <span className="text-[var(--color-text-tertiary)]">· {effortLabel}</span>
        <CaretDownIcon
          aria-hidden
          className={`h-3.5 w-3.5 text-[var(--color-text-tertiary)] transition-transform duration-[var(--duration-normal)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && sheetMode ? (
        <ModelSheet
          activeId={active.id}
          effort={effort}
          onSelectModel={(id) => {
            onModelChange(id);
            setOpen(false);
          }}
          onEffortChange={onEffortChange}
          onClose={() => setOpen(false)}
        />
      ) : null}

      {open && !sheetMode ? (
        <div
          id={listId}
          onKeyDown={onKeyDown}
          onMouseLeave={() => setFocusedId(null)}
          className="absolute bottom-full right-0 z-30 mb-2 flex flex-col items-end gap-1 sm:block"
        >
          {/* Effort submenu, only while a model row is hovered: beside the row on wide screens, above the list on phones */}
          {shown ? (
          <div
            role="menu"
            aria-label={`${shown.label} effort`}
            style={{ top: anchorTop }}
            className="popover-in-up w-44 overflow-hidden sm:absolute sm:right-full sm:mr-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-1 shadow-[var(--shadow-popover)]"
          >
            {EFFORT_LEVELS.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                role="menuitemradio"
                aria-checked={lvl.id === effort}
                tabIndex={-1}
                title={lvl.hint}
                onClick={() => choose(shown.id, lvl.id)}
                className="flex w-full items-center justify-between rounded-[var(--radius-md)] px-2.5 py-1.5 text-left text-sm text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] focus-visible:bg-[var(--color-hover)]"
              >
                {lvl.label}
                {lvl.id === effort ? <CheckIcon aria-hidden className="h-3.5 w-3.5" /> : null}
              </button>
            ))}
            <div className="mx-1 my-1 border-t border-[var(--color-border)]" />
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-snug text-[var(--color-text-tertiary)]">
              {PROVIDERS[shown.providerId]?.name} · {formatContext(shown.contextWindow)} context
              <br />
              {shown.description}
            </p>
          </div>
          ) : null}

          <div
            ref={panelRef}
            className="popover-in-up relative w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-popover)]"
          >
            <p className="px-3.5 pb-1 pt-2.5 text-xs text-[var(--color-text-tertiary)]">
              {PROVIDERS.inferkit.name}
            </p>
            <div
              ref={listRef}
              role="listbox"
              aria-label="Model"
              className="max-h-[min(22rem,50vh)] overflow-y-auto overscroll-contain px-1 pb-1"
            >
              {REGISTERED_MODELS.map((m) => {
                const selected = m.id === active.id;
                const hovered = m.id === focusedId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    data-id={m.id}
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    onMouseEnter={(e) => reveal(m.id, e.currentTarget)}
                    onFocus={(e) => {
                      if (e.currentTarget.matches(":focus-visible")) reveal(m.id, e.currentTarget);
                    }}
                    onClick={() => choose(m.id)}
                    className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-sm text-[var(--color-text)] transition-colors duration-[var(--duration-fast)] ${
                      hovered ? "bg-[var(--color-hover)]" : ""
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium">{m.label}</span>
                    {m.isDefaultPrimary ? (
                      <Tag>Default</Tag>
                    ) : m.experimental ? (
                      <Tag>Experimental</Tag>
                    ) : null}
                    <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                      {hovered ? (
                        <>
                          {effortLabel}
                          <CaretRightIcon aria-hidden className="h-3 w-3" />
                        </>
                      ) : selected ? (
                        <CheckIcon aria-hidden className="h-3.5 w-3.5 text-[var(--color-text)]" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      ) : null}
    </div>
  );
}
