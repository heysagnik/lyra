"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EnvelopeSimpleIcon, LockIcon } from "@phosphor-icons/react";
import { signUp, useSession } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignUpPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [name, setName] = useState("");
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
      const res = await signUp.email({
        name,
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to create account");
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
      title="Create your account"
      subtitle="Start your first chat with lyra"
      footer={<>By signing up, you agree to our Terms of Service and Privacy Policy.</>}
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
            htmlFor="name"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Name
          </label>
          <div className="relative mt-1.5">
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="block w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] py-2.5 pl-3 pr-3 text-sm text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            Email
          </label>
          <div className="relative mt-1.5">
            <EnvelopeSimpleIcon
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
              placeholder="Enter your email"
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
            <LockIcon
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
            />
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="block w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-1)] py-2.5 pl-11 pr-3 text-sm text-[var(--color-text)] transition-colors placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-focus)] focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-lg bg-[var(--color-accent)] text-sm font-medium text-[var(--color-on-accent)] transition-[opacity,transform] duration-[var(--duration-fast)] hover:opacity-90 active:scale-[0.96] disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-[var(--color-accent)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
