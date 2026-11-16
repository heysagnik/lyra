interface WordmarkProps {
  className?: string;
  children?: React.ReactNode;
}

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
