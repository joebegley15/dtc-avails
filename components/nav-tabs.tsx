"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavTab = { href: string; label: string };

export function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();

  // Match on the path alone: a tab's href may carry a query string. When
  // tabs nest (/producer and /producer/nominate), the longest match wins.
  const pathOf = (href: string) => href.split("?")[0];
  const activeHref = tabs
    .filter(({ href }) => {
      const path = pathOf(href);
      return pathname === path || pathname.startsWith(`${path}/`);
    })
    .sort((a, b) => pathOf(b.href).length - pathOf(a.href).length)[0]?.href;

  return (
    <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {tabs.map(({ href, label }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "border-b-2 border-[#DA1717] pb-0.5 font-semibold text-[#DA1717]"
                : "border-b-2 border-transparent pb-0.5 text-zinc-600 hover:text-zinc-950"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
