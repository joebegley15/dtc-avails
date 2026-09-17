import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AppHeader } from "@/components/app-header";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader title="Admin" />
      <nav className="flex gap-4 border-b border-black/10 px-4 py-2 text-sm">
        <a href="/admin/shows" className="text-zinc-600 hover:text-zinc-950">
          Shows
        </a>
        <a href="/admin/users" className="text-zinc-600 hover:text-zinc-950">
          Users
        </a>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
