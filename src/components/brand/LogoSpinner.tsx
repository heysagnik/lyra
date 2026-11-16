interface LogoSpinnerProps {
  className?: string;
}

/**
 * Loading spinner built from the Lyra mark: a bright segment flows along the
 * glyph's single continuous stroke over a faint copy of the full mark.
 * currentColor, sized by the caller; falls back to the static mark under
 * prefers-reduced-motion.
 */
export function LogoSpinner({ className }: LogoSpinnerProps) {
  const d =
    "M32,92.8S64,48,112,48c104,0,92.6,160-3.4,160-64,0-64-96,32-96,64,0,107.4,48,107.4,48";
  const common = {
    d,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 32,
    pathLength: 1,
    transform: "translate(28 28) scale(0.78)",
  };
  return (
    <svg viewBox="0 0 256 256" className={className} fill="none" aria-hidden="true">
      <path {...common} opacity={0.25} className="logo-spinner-track" />
      <path {...common} className="logo-spinner-trace" />
    </svg>
  );
}
