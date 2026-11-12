"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretRightIcon, SignOutIcon, EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { signOut, useSession } from "@/lib/auth/client";

interface SessionRow {
  id: string;
  userAgent?: string | null;
  createdAt: Date | string;
}

interface LinkedAccount {
  providerId: string;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

function describeDevice(userAgent?: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";

  const system = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";

  return system ? `${browser} on ${system}` : browser;
}

function formatDate(value: Date | string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [devicesOpen, setDevicesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [sessionResult, accountResult] = await Promise.allSettled([
        fetchJson("/api/auth/list-sessions"),
        fetchJson("/api/auth/list-accounts"),
      ]);

      if (cancelled) return;

      setSessions(
        sessionResult.status === "fulfilled" && Array.isArray(sessionResult.value)
          ? (sessionResult.value as SessionRow[])
          : null
      );
      setAccounts(
        accountResult.status === "fulfilled" && Array.isArray(accountResult.value)
          ? (accountResult.value as LinkedAccount[])
          : null
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  };

  const name = session?.user?.name;
  const email = session?.user?.email;
  const image = session?.user?.image;
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const googleLinked = accounts?.some((a) => a.providerId === "google") ?? false;

  const deviceLabel =
    sessions === null
      ? "—"
      : sessions.length === 1
        ? "1 device"
        : `${sessions.length} devices`;

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-center pt-2 text-center">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar from the auth provider
          <img
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            className="h-16 w-16 rounded-full object-cover ring-1 ring-[var(--color-border-strong)]"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-3)] text-xl font-medium text-[var(--color-text)] ring-1 ring-[var(--color-border)]"
          >
            {initial}
          </span>
        )}
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-[var(--color-text)]">
          {name || "Your account"}
        </h1>
      </header>

      <section>
        <h2 className="mb-2 px-1 text-sm text-[var(--color-text-tertiary)]">
          Linked accounts
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-1)]">
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3">
            <span className="flex min-w-0 items-center gap-3 text-sm text-[var(--color-text)]">
              <EnvelopeSimpleIcon
                aria-hidden
                className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
              />
              Email
            </span>
            <span className="truncate text-sm text-[var(--color-text-tertiary)]">
              {email ?? "—"}
            </span>
          </div>
          <div className="flex min-h-12 items-center justify-between gap-4 px-5 py-3">
            <span className="flex min-w-0 items-center gap-3 text-sm text-[var(--color-text)]">
              <GoogleIcon />
              Google
            </span>
            <span className="truncate text-sm text-[var(--color-text-tertiary)]">
              {accounts === null
                ? "—"
                : googleLinked
                  ? name || "Linked"
                  : "Not linked"}
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-sm text-[var(--color-text-tertiary)]">
          Account security
        </h2>
        <div className="overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-1)]">
          <button
            type="button"
            aria-expanded={devicesOpen}
            aria-controls="active-devices"
            onClick={() => setDevicesOpen((open) => !open)}
            className="flex min-h-12 w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors duration-[var(--duration-fast)] hover:bg-[var(--color-hover)]"
          >
            <span className="text-sm text-[var(--color-text)]">Manage devices</span>
            <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-tertiary)]">
              {deviceLabel}
              <CaretRightIcon
                aria-hidden
                className={`h-4 w-4 transition-transform duration-[var(--duration-normal)] ${
                  devicesOpen ? "rotate-90" : ""
                }`}
              />
            </span>
          </button>

          {devicesOpen && (
            <ul
              id="active-devices"
              className="rise-in border-t border-[var(--color-border)]"
            >
              {sessions === null ? (
                <li className="px-5 py-3.5 text-sm text-[var(--color-text-tertiary)]">
                  Device details are unavailable right now.
                </li>
              ) : sessions.length === 0 ? (
                <li className="px-5 py-3.5 text-sm text-[var(--color-text-tertiary)]">
                  No active devices.
                </li>
              ) : (
                sessions.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-3 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-sm text-[var(--color-text)]">
                      {describeDevice(row.userAgent)}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
                      {formatDate(row.createdAt)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </section>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] text-sm font-medium text-[var(--color-text)] transition-[background-color,transform] duration-[var(--duration-fast)] hover:bg-[var(--color-hover)] active:scale-[0.96]"
      >
        <SignOutIcon aria-hidden className="h-4 w-4" />
        Log out
      </button>

      <div className="pt-6 text-center">
        <button
          type="button"
          disabled
          title="Account deletion isn't available yet"
          className="text-sm text-[var(--color-text-tertiary)] opacity-70"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
