interface LogoMarkProps {
  className?: string;
}

/**
 * Lyra brand mark: the flow glyph — one continuous stroke, round caps,
 * currentColor so it adapts to any surface. Sized by the caller.
 */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      fill="none"
      role="img"
      aria-label="Lyra logo"
    >
      <path
        d="M32,92.8S64,48,112,48c104,0,92.6,160-3.4,160-64,0-64-96,32-96,64,0,107.4,48,107.4,48"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={22}
        transform="translate(28 28) scale(0.78)"
      />
    </svg>
  );
}
