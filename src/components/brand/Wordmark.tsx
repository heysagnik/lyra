interface WordmarkProps {
  className?: string;
  /** Render inside an h1 with the mark inline (sidebar) vs standalone (auth header) */
  children?: React.ReactNode;
}

/**
 * Lyra wordmark: the product name set in the display face with tight
 * tracking, optically aligned to the LogoMark's cap line. One component
 * so every surface renders the identical wordmark.
 */
export function Wordmark({ className, children }: WordmarkProps) {
  return (
    <span
      style={{ fontFamily: "var(--font-wordmark)" }}
      className={`inline-flex items-center gap-2 font-semibold tracking-[-0.01em] text-[var(--color-text)] ${className ?? ""}`}
    >
      {children ?? "lyra"}
    </span>
  );
}
