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

/** Idle first viewport: a serif greeting with the Lyra mark. */
export function EmptyState() {
  const { data: session } = useSession();
  // Resolve once on mount; the greeting should not flip at midnight mid-session
  const [greeting] = useState(() => getGreeting(new Date()));
  const name = session?.user?.name?.trim();

  useEffect(() => {
    document.title = "lyra — chat agent";
  }, []);

  return (
    <h1
      style={{ fontFamily: "var(--font-wordmark)" }}
      className="rise-in flex flex-col items-center justify-center gap-2.5 text-center text-3xl font-medium tracking-[-0.01em] text-[var(--text)] sm:flex-row sm:gap-3 sm:text-5xl"
      aria-label={`${greeting}${name ? `, ${name}` : ""}`}
    >
      <Asterisk
        aria-hidden
        strokeWidth={2}
        className="h-8 w-8 shrink-0 text-[var(--accent)] sm:h-9 sm:w-9"
      />
      <span>
        {greeting}
        {name ? `, ${name}` : ""}
      </span>
    </h1>
  );
}
