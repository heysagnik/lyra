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
      <div
        aria-hidden
        className="fade-in pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(52% 40% at 50% 42%, var(--color-aura) 0%, transparent 70%)",
        }}
      />

      <h1
        style={{ fontFamily: "var(--font-wordmark)" }}
        className="rise-in relative flex flex-col items-center justify-center gap-2.5 text-center text-3xl font-medium tracking-[-0.01em] text-[var(--color-text)] sm:flex-row sm:gap-3.5 sm:text-5xl"
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
