"use client";

import { useEffect, useState } from "react";


function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function getSubtitle(date: Date): string {
  const h = date.getHours();
  if (h < 5 || h >= 21) return "How can I help you tonight?";
  return "How can I help you today?";
}

export function EmptyState() {
  const [greeting, setGreeting] = useState(() => getGreeting(new Date()));
  const [subtitle, setSubtitle] = useState(() => getSubtitle(new Date()));

  useEffect(() => {
    document.title = "lyra — chat agent";
    setGreeting(getGreeting(new Date()));
    setSubtitle(getSubtitle(new Date()));
  }, []);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-28 sm:pb-32">
      <div
        aria-hidden
        className="fade-in pointer-events-none absolute inset-0 select-none overflow-hidden"
      >
        <div
          className="aura-breathe absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 58% 44% at 50% 45%, color-mix(in srgb, var(--color-accent) 22%, var(--color-aura)) 0%, color-mix(in srgb, var(--color-aura) 55%, transparent) 42%, transparent 74%)",
              "radial-gradient(ellipse 44% 34% at 36% 38%, color-mix(in srgb, var(--color-update) 18%, transparent) 0%, transparent 68%)",
              "radial-gradient(ellipse 46% 36% at 64% 46%, color-mix(in srgb, #9333ea 14%, color-mix(in srgb, var(--color-accent) 18%, transparent)) 0%, transparent 68%)",
              "radial-gradient(ellipse 36% 28% at 52% 35%, color-mix(in srgb, #f472b6 9%, transparent) 0%, transparent 70%)",
              "radial-gradient(ellipse 85% 65% at 50% 48%, color-mix(in srgb, var(--color-aura) 70%, transparent) 0%, transparent 82%)",
            ].join(", "),
            maskImage:
              "radial-gradient(ellipse 88% 76% at 50% 46%, black 35%, transparent 95%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 88% 76% at 50% 46%, black 35%, transparent 95%)",
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 5%, transparent) 0%, transparent 45%)",
          }}
        />
      </div>

      <div className="rise-in relative flex flex-col items-center justify-center gap-2 text-center sm:gap-3">
        <h1
          suppressHydrationWarning
          style={{ fontFamily: "var(--font-wordmark)" }}
          className="flex items-center justify-center gap-2.5 text-3xl font-medium tracking-[-0.015em] text-[var(--color-text)] sm:gap-3.5 sm:text-5xl"
          aria-label={`${greeting}`}
        >
          <span suppressHydrationWarning className="text-[var(--color-text)]">
            {greeting}
          </span>
        </h1>
        <p
          suppressHydrationWarning
          className="text-xl font-normal tracking-[-0.01em] text-[var(--color-text-secondary)] sm:text-2xl"
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}
