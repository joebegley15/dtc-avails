import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b-4 border-[#DA1717] bg-white px-6 py-4">
        <div className="flex items-baseline gap-8">
          <span className="text-xl font-bold tracking-tight text-[#1F3A5F]">
            Texahoma Avails
          </span>
          <AdminNav />
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
      <main className="flex-1">{children}</main>
    </div>
  );
}
