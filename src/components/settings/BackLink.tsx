"use client";

import Link from "next/link";
import { CaretLeftIcon } from "@phosphor-icons/react";

export function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
    >
      <CaretLeftIcon className="h-4 w-4" aria-hidden />
      Back
    </Link>
  );
}
