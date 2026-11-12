"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { signIn, useSession } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignInPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      router.replace("/");
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to sign in");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome to lyra"
      subtitle="Sign in to continue to your chats"
      footer={<>By logging in, you agree to our Terms of Service and Privacy Policy.</>}
    >
      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-muted)] p-3 text-sm text-[var(--color-danger)]"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Email
          </label>
          <div className="relative mt-1.5">
            <Mail
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter Your Email"
              className="block w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] py-2.5 pl-11 pr-3 text-sm text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Password
          </label>
          <div className="relative mt-1.5">
            <Lock
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Your Password"
              className="block w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] py-2.5 pl-11 pr-3 text-sm text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-lg bg-[var(--color-accent)] text-sm font-medium text-[var(--color-on-accent)] transition-[opacity,transform] duration-[var(--duration-fast)] hover:opacity-90 active:scale-[0.96] disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-[var(--color-update)] hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
