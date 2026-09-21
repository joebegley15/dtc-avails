"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/shows", label: "Shows" },
  { href: "/admin/bulk-upload", label: "Bulk upload" },
  { href: "/admin/users", label: "Users" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
