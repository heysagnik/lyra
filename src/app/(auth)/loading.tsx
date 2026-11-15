import { LogoMark } from "@/components/brand/LogoMark";

/**
 * Brand-consistent loading state for auth routes (sign-in / sign-up) so
 * the chat skeleton from the root boundary never flashes under the auth
 * forms. The mark breathes once via opacity — quiet, no spinner.
 */
export default function AuthLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <LogoMark className="h-6 w-6 animate-pulse text-[var(--color-text-tertiary)]" />
    </div>
  );
}
