"use client";

import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { Wordmark } from "@/components/brand/Wordmark";

interface AuthShellProps {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}

/**
 * Full-page auth layout: wordmark top-left, centered welcome column,
 * legal line at the bottom.
 */
export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      {/* Wordmark row */}
      <header className="flex items-center px-6 py-5">
        <Wordmark className="text-lg">
          <LogoMark className="h-5 w-5" />
          lyra
        </Wordmark>
      </header>

      {/* Centered form column */}
      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <div className="rise-in w-full max-w-md">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-1)]">
              <LogoMark className="h-10 w-10 text-[var(--color-text)]" />
            </span>
            <h1
            className="mt-5 text-2xl font-semibold text-[var(--color-text)]"
            style={{ fontFamily: "var(--font-wordmark)" }}
          >
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-[var(--color-text-tertiary)]">
              {subtitle}
            </p>
          </div>

          {children}
        </div>
      </main>

      {/* Legal footer */}
      <footer className="pb-6 text-center text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        {footer}
      </footer>
    </div>
  );
}
