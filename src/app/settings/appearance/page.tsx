"use client";

import { useEffect, useState } from "react";
import { Sun, Monitor, MoonStar } from "lucide-react";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: MoonStar },
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
  const surface = mode === "light" ? "#ffffff" : mode === "dark" ? "#1b1b1b" : "#1b1b1b";
  return (
    <div
      aria-hidden
      className="flex h-24 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)]"
      style={{ background: canvas }}
    >
      <div
        className="flex h-16 w-40 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-sm)]"
        style={{ background: surface }}
      >
        <span
          className="text-[10px] font-bold tracking-tight"
          style={{ color: mode === "light" ? "#141414" : "#efefef" }}
        >
          lyra
        </span>
        <div
          className="h-4 w-24 rounded-full"
          style={{ background: mode === "light" ? "#ececec" : "#282828" }}
        />
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {THEMES.map(({ value, label, icon: Icon }) => {
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyTheme(value)}
                  aria-pressed={selected}
                  className={`rounded-[var(--radius-lg)] border p-1.5 text-left transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] ${
                    selected
                      ? "border-[var(--color-update)] shadow-[0_0_0_1px_var(--color-update)]"
                      : "border-transparent hover:border-[var(--color-border-strong)]"
                  }`}
                >
                  <ThemePreview mode={value} />
                  <span className="mt-2 flex items-center justify-center gap-1.5 pb-1.5 text-sm text-[var(--color-text)]">
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {label}
                  </span>
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
