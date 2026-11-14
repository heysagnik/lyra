"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretLeftIcon } from "@phosphor-icons/react";

/**
 * Returns to the last chat surface the user was on (persisted by
 * ChatContainer) instead of always going home — so leaving Settings
 * drops you back exactly where you left off.
 */
export function BackLink() {
  const [href, setHref] = useState("/");

  useEffect(() => {
    try {
      const last = sessionStorage.getItem("lyra:lastChatPath");
      if (last && last.startsWith("/") && !last.startsWith("/settings")) {
        setHref(last);
      }
    } catch {
      // storage unavailable — fall back to "/"
    }
  }, []);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] active:scale-[0.98]"
    >
      <CaretLeftIcon className="h-4 w-4" aria-hidden />
      Back
    </Link>
  );
}
