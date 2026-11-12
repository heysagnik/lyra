"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/client";


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
  const { data: session } = useSession();
  const [greeting, setGreeting] = useState(() => getGreeting(new Date()));
  const [subtitle, setSubtitle] = useState(() => getSubtitle(new Date()));
  const userName = session?.user?.name ? `, ${session.user.name}` : "";

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
        {/* Core aura — a single soft accent wash centered behind the greeting */}
        <div
          className="aura-breathe absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 52% 42% at 50% 42%, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-accent) 10%, transparent) 45%, transparent 75%)",
            maskImage:
              "radial-gradient(ellipse 85% 75% at 50% 46%, black 30%, transparent 92%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 85% 75% at 50% 46%, black 30%, transparent 92%)",
          }}
        />

        {/* Secondary glow — off-center, subtle, breathing out of phase */}
        <div
          className="aura-breathe absolute inset-0"
          style={{
            animationDelay: "-7s",
            background:
              "radial-gradient(ellipse 40% 32% at 64% 40%, color-mix(in srgb, var(--color-accent) 9%, transparent) 0%, transparent 70%)",
          }}
        />

        {/* Soft vertical falloff — grounds the gradient into the canvas */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--color-accent) 6%, transparent) 55%, transparent 85%)",
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
            {greeting}{userName}
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
