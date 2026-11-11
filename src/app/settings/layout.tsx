import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { QueryProvider } from "@/components/providers/QueryProvider";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] md:flex">
      {/* Mobile: back link + horizontally scrolling sections */}
      <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--color-border)] bg-[var(--color-canvas)]/95 backdrop-blur-sm md:hidden">
        <div className="flex h-12 items-center px-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <SettingsNav />
        </div>
      </header>

      {/* Desktop: fixed settings rail */}
      <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col border-r border-[var(--color-border)] px-3 py-4 md:flex">
        <Link
          href="/"
          className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>
        <SettingsNav />
      </aside>

      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-8 md:py-16">
          <QueryProvider>{children}</QueryProvider>
        </main>
      </div>
    </div>
  );
}
