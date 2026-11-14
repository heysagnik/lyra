/**
 * Neutral loading state for auth routes (sign-in / sign-up) so the chat
 * skeleton from the root boundary never flashes under the auth forms.
 */
export default function AuthLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-text-tertiary)]" />
    </div>
  );
}
