import type { CurrentUser } from "@/lib/session";
import { NavTabs, type NavTab } from "./nav-tabs";

/**
 * Admins and producers get both sides of the app: the shows they produce, and
 * their own avails as a comedian. Comics only ever see /avails, so no tabs.
 */
function tabsFor(user: CurrentUser): NavTab[] {
  switch (user.role) {
    case "admin":
      return [
        { href: "/admin/shows", label: "Shows" },
        { href: "/admin/bulk-upload", label: "Bulk upload" },
        { href: "/admin/users", label: "Users" },
        // Preselects the admin's own shows; the picker can still show all.
        { href: `/producer?producer=${user.id}`, label: "Producer" },
        { href: "/avails", label: "Comedian" },
      ];
    case "producer":
      return [
        { href: "/producer", label: "Producer" },
        { href: "/avails", label: "Comedian" },
      ];
    case "comic":
      return [];
  }
}

export function hasTabs(user: CurrentUser): boolean {
  return tabsFor(user).length > 0;
}

export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b-4 border-[#DA1717] bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <span className="text-xl font-bold tracking-tight text-[#1F3A5F]">
          Texahoma Avails
        </span>
        <NavTabs tabs={tabsFor(user)} />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-zinc-600">{user.name}</span>
        {/* Plain <a>: /logout is a route handler, not a page to prefetch. */}
        <a
          href="/logout"
          className="text-zinc-500 underline hover:text-zinc-950"
        >
          Sign out
        </a>
      </div>
    </header>
  );
}
