"use client";

import { useEffect, useState } from "react";
import { SunIcon, MonitorIcon, MoonStarsIcon, CheckIcon } from "@phosphor-icons/react";

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "dark", label: "Dark", icon: MoonStarsIcon },
] as const;

type ThemeValue = (typeof THEMES)[number]["value"];
const STORAGE_KEY = "lyra-theme";

const LIGHT = { canvas: "#fcfcfc", surface: "#ffffff", text: "#171717", border: "rgba(0,0,0,0.08)", pillBg: "rgba(23,23,23,0.06)", lineBg: "rgba(23,23,23,0.12)" };
const DARK = { canvas: "#161616", surface: "#1c1c1c", text: "#ededed", border: "rgba(255,255,255,0.09)", pillBg: "rgba(237,237,237,0.07)", lineBg: "rgba(237,237,237,0.12)" };

/** A miniature chat window drawn with the real theme colours. */
function MiniWindow({ t }: { t: typeof LIGHT }) {
  return (
    <div
      className="flex h-[52px] min-w-0 flex-1 flex-col justify-between gap-1 rounded-[calc(var(--radius-md)-2px)] px-2 py-1.5"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
    >
      {/* Title bar: dot + line */}
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: t.text, opacity: 0.55 }} />
        <span className="h-1 w-1/2 rounded-full" style={{ background: t.text, opacity: 0.45 }} />
      </div>
      {/* Message lines */}
      <div className="flex flex-col gap-1">
        <span className="h-1 w-3/4 rounded-full" style={{ background: t.lineBg }} />
        <span className="h-1 w-2/3 rounded-full" style={{ background: t.lineBg }} />
      </div>
      {/* Composer pill */}
      <div
        className="flex h-3 items-center rounded-full px-1"
        style={{ background: t.pillBg }}
      >
        <span
          className="h-1 w-1/3 rounded-full"
          style={{ background: t.text, opacity: 0.28 }}
        />
      </div>
    </div>
  );
}

function ThemePreview({ mode }: { mode: ThemeValue }) {
  return (
    <div
      aria-hidden
      className="relative overflow-hidden rounded-[var(--radius-md)] border p-1.5"
      style={{
        borderColor: mode === "dark" ? DARK.border : LIGHT.border,
        background: mode === "dark" ? DARK.canvas : LIGHT.canvas,
      }}
    >
      {mode === "system" ? (
        <div className="flex gap-1.5">
          <MiniWindow t={LIGHT} />
          <MiniWindow t={DARK} />
        </div>
      ) : (
        <MiniWindow t={mode === "dark" ? DARK : LIGHT} />
      )}
    </div>
  );
}

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<ThemeValue>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "system" || saved === "dark") {
        setTheme(saved);
        document.documentElement.dataset.theme = saved;
      }
    } catch {
      // ignore
    }
  }, []);

  const applyTheme = (next: ThemeValue) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
          Appearance
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Choose how lyra looks on this device.
        </p>
      </header>

      <section>
        <h2 className="mb-2 px-1 text-sm text-[var(--color-text-tertiary)]">
          Theme
        </h2>
        <div className="rounded-[var(--radius-xl)] bg-[var(--color-surface-1)] p-2">
          <div className="flex gap-1.5 sm:grid sm:grid-cols-3 sm:gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyTheme(value)}
                  aria-pressed={selected}
                  className={`group relative flex-1 rounded-[var(--radius-lg)] border p-1.5 text-left transition-[border-color,box-shadow,transform,background-color] duration-[var(--duration-fast)] active:scale-[0.98] ${
                    selected
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/[0.04] shadow-[0_0_0_1px_var(--color-accent)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-hover)]"
                  }`}
                >
                  <ThemePreview mode={value} />
                  <span
                    className={`mt-1.5 flex items-center justify-center gap-1 pb-0.5 text-[11px] leading-none transition-colors duration-[var(--duration-fast)] ${
                      selected
                        ? "font-medium text-[var(--color-text)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <Icon aria-hidden className="h-3 w-3" />
                    {label}
                  </span>
                  {selected && (
                    <span
                      className="absolute right-2.5 top-2.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[var(--shadow-control)]"
                      style={{ height: 18, width: 18 }}
                    >
                      <CheckIcon aria-hidden className="h-2.5 w-2.5" weight="bold" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-sm text-[var(--color-text-tertiary)]">
          Language
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-1)]">
          <div className="flex min-h-12 items-center justify-between gap-4 px-5 py-3">
            <span className="text-sm text-[var(--color-text)]">Language</span>
            <span className="text-sm text-[var(--color-text-tertiary)]">
              English
            </span>
          </div>
        </div>
        <p className="mt-2 px-1 text-xs text-[var(--color-text-tertiary)] opacity-80">
          English is the only supported language right now.
        </p>
      </section>
    </div>
  );
}
