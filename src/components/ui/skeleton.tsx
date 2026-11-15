import type { CSSProperties } from "react";

export interface SkeletonProps {
  className?: string;
  /** Stagger in ms. Offsets the shimmer sweep (and any caller-applied fade-in). */
  delay?: number;
  /** Passthrough for measured widths etc. */
  style?: CSSProperties;
}

/**
 * One shimmering placeholder block. Decorative only — pair with
 * `aria-busy` on the loading region and keep real content announced.
 * The stagger flows through `--skeleton-delay`, which `.skeleton::after`
 * picks up in globals.css.
 */
export function Skeleton({ className = "", delay = 0, style }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`skeleton ${className}`}
      style={
        delay
          ? ({ "--skeleton-delay": `${delay}ms`, ...style } as CSSProperties)
          : style
      }
    />
  );
}

/**
 * A text-sized line. Height and width come from the caller so the
 * skeleton mirrors the real content it stands in for.
 */
export function SkeletonLine({
  className = "",
  delay = 0,
  style,
}: SkeletonProps) {
  return (
    <Skeleton
      className={`rounded-full ${className}`}
      delay={delay}
      style={style}
    />
  );
}

/**
 * Deterministic width rhythm for repeated rows — no Math.random, so
 * server and client markup agree and nothing flickers on hydration.
 */
export const ROW_WIDTHS = [86, 64, 92, 72, 58, 80, 90, 68, 76, 62];

export function rowWidth(index: number): string {
  return `${ROW_WIDTHS[index % ROW_WIDTHS.length]}%`;
}
