"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, Gauge, Sun, UserRound, type LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    items: [
      {
        href: "/settings/account",
        label: "Account & Security",
        icon: UserRound,
      },
      {
        href: "/settings/appearance",
        label: "Appearance",
        icon: Sun,
      },
      {
        href: "/settings/usage",
        label: "Usage & Limits",
        icon: Gauge,
      },
    ],
  },
  {
    label: "Personalization",
    items: [
      {
        href: "/settings/personalization",
        label: "Chat memory",
        icon: Brain,
      },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-col gap-5 max-md:flex-row max-md:items-center max-md:gap-1"
    >
      {GROUPS.map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="max-md:contents">
          {group.label && (
            <p className="hidden px-3 pb-2 text-sm text-[var(--color-text-tertiary)] md:block">
              {group.label}
            </p>
          )}
          <ul className="flex items-center gap-1 md:flex-col md:items-stretch md:gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 whitespace-nowrap rounded-[var(--radius-lg)] px-3 py-2 text-sm transition-colors duration-[var(--duration-fast)] ${
                      active
                        ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <Icon
                      aria-hidden
                      strokeWidth={1.75}
                      className={`h-4 w-4 shrink-0 ${
                        active
                          ? "text-[var(--color-text)]"
                          : "text-[var(--color-text-tertiary)]"
                      }`}
                    />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
