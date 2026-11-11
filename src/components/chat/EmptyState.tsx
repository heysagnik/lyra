"use client";

import { useEffect, useState } from "react";
import { Asterisk } from "lucide-react";
import { useSession } from "@/lib/auth/client";

function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export function EmptyState() {
  const { data: session } = useSession();
  const [greeting] = useState(() => getGreeting(new Date()));
  const name = session?.user?.name?.trim();

  useEffect(() => {
    document.title = "lyra — chat agent";
  }, []);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-28 sm:pb-32">
      {/* Ambient gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden"
      >
        {/* Soft radial aura centered behind greeting */}
        <div
          className="absolute h-[32rem] w-[32rem] -translate-y-6 rounded-full blur-[100px] opacity-60 transition-opacity duration-700 dark:opacity-30 sm:h-[44rem] sm:w-[44rem]"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 26%, #818cf8) 0%, color-mix(in srgb, var(--color-accent) 12%, #c084fc) 40%, transparent 75%)",
          }}
        />

        {/* Soft upper-left cyan/sky glow */}
        <div
          className="absolute -top-16 -left-16 h-72 w-72 rounded-full blur-[90px] opacity-40 dark:opacity-20 sm:h-96 sm:w-96"
          style={{
            background: "radial-gradient(circle, #38bdf8 0%, transparent 70%)",
          }}
        />

        {/* Soft lower-right rose/pink glow */}
        <div
          className="absolute -bottom-10 -right-16 h-72 w-72 rounded-full blur-[90px] opacity-35 dark:opacity-20 sm:h-96 sm:w-96"
          style={{
            background: "radial-gradient(circle, #f472b6 0%, transparent 70%)",
          }}
        />

        {/* Subtle top-to-bottom ambient sheen */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--color-accent) 4%, transparent), transparent 70%)",
          }}
        />

        {/* Gentle vignette to blend softly into canvas edges */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 40%, var(--color-canvas) 100%)",
          }}
        />
      </div>

      <h1
        style={{ fontFamily: "var(--font-wordmark)" }}
        className="rise-in flex flex-col items-center justify-center gap-2.5 text-center text-3xl font-medium tracking-[-0.01em] text-[var(--color-text)] sm:flex-row sm:gap-3.5 sm:text-5xl"
        aria-label={`${greeting}${name ? `, ${name}` : ""}`}
      >
        <Asterisk
          aria-hidden
          strokeWidth={2}
          className="h-8 w-8 shrink-0 text-[var(--color-text)] sm:h-9 sm:w-9"
        />
        <span className="text-[var(--color-text)]">
          {greeting}
          {name ? `, ${name}` : ""}
        </span>
      </h1>
    </div>
  );
}
