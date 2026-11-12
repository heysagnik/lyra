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

function ThemePreview({ mode }: { mode: ThemeValue }) {
  // Half-and-half canvas for the System option
  const canvas =
    mode === "light"
      ? "#f6f6f6"
      : mode === "dark"
        ? "#141414"
        : "linear-gradient(90deg, #f6f6f6 50%, #141414 50%)";
  const surface = mode === "light" ? "#ffffff" : mode === "dark" ? "#1c1c1c" : "#e8e8e8";
  const text = mode === "light" ? "#171717" : mode === "dark" ? "#ededed" : "#6b6b6b";

  return (
    <div
      aria-hidden
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-1.5"
      style={{ background: canvas }}
    >
      {/* Mini app window */}
      <div
        className="flex h-12 flex-col justify-between rounded-[var(--radius-sm)] px-1.5 py-1.5"
        style={{ background: surface, color: text }}
      >
        <div
          className="h-1.5 w-1/2 rounded-full"
          style={{ background: text, opacity: 0.5 }}
        />
        <div
          className="h-4 w-3/4 rounded-[var(--radius-sm)]"
          style={{ background: text, opacity: 0.1 }}
        />
        <div
          className="flex h-4 items-center rounded-full px-1.5"
          style={{ background: text, opacity: 0.06 }}
        >
          <div
            className="h-1 w-1/3 rounded-full"
            style={{ background: text, opacity: 0.3 }}
          />
        </div>
      </div>
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
                  className={`relative flex-1 rounded-[var(--radius-lg)] border p-1 text-left transition-[border-color,box-shadow,transform] duration-[var(--duration-fast)] active:scale-[0.98] ${
                    selected
                      ? "border-[var(--color-update)] shadow-[0_0_0_1px_var(--color-update)]"
                      : "border-transparent hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <ThemePreview mode={value} />
                  <span className="mt-1.5 flex items-center justify-center gap-1 pb-1 text-[11px] leading-none text-[var(--color-text)]">
                    <Icon aria-hidden className="h-3 w-3" />
                    {label}
                  </span>
                  {selected && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-update)] text-[var(--color-on-accent)]">
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
