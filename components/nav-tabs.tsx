"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavTab = { href: string; label: string };

export function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {tabs.map(({ href, label }) => {
        // Match on the path alone: a tab's href may carry a query string.
        const path = href.split("?")[0];
        const active = pathname === path || pathname.startsWith(`${path}/`);
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
