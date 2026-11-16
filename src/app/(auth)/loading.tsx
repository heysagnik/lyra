import { LogoSpinner } from "@/components/brand/LogoSpinner";

/**
 * Brand-consistent loading state for auth routes (sign-in / sign-up) so
 * the chat skeleton from the root boundary never flashes under the auth
 * forms. The Lyra mark traces itself as the spinner.
 */
export default function AuthLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <LogoSpinner className="h-6 w-6 text-[var(--color-text-tertiary)]" />
    </div>
  );
}
