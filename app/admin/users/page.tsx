import Link from "next/link";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildLink } from "@/lib/tokens";
import { AddUserForm } from "./add-user-form";
import { LinkCell } from "./link-cell";
import { ResetPasswordButton } from "./reset-password-button";
import { ResetToDefaultButton } from "./reset-to-default-button";

type UserRow = {
  id: number;
  name: string;
  email: string | null;
  username: string | null;
  role: "admin" | "producer" | "comic";
  home_market: string | null;
  is_all_star: boolean;
  access_token: string | null;
};

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = (await sql`
    select id, name, email, username, role, home_market, is_all_star, access_token
    from users
    order by role, name
  `) as UserRow[];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-950">Users</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Add producers, comics, and admins here.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users/invite"
            className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950"
          >
            Invite a user
          </Link>
          <Link
            href="/admin/users/bulk-links"
            className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950"
          >
            Bulk links
          </Link>
          <Link
            href="/admin/users/import"
            className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white"
          >
            Import users
          </Link>
        </div>
      </div>

      <AddUserForm />

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Username</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Home market</th>
              <th className="py-2 pr-4">All-star</th>
              <th className="py-2 pr-4">Link</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2 pr-4 font-medium text-zinc-950">{u.name}</td>
                <td className="py-2 pr-4 text-zinc-600">{u.email ?? "—"}</td>
                <td className="py-2 pr-4 text-zinc-600">{u.username ?? "—"}</td>
                <td className="py-2 pr-4 capitalize text-zinc-600">{u.role}</td>
                <td className="py-2 pr-4 text-zinc-600">{u.home_market ?? "—"}</td>
                <td className="py-2 pr-4">
                  {u.is_all_star && <span className="text-[#DA1717]">★</span>}
                </td>
                <td className="py-2 pr-4">
                  {u.access_token ? (
                    <LinkCell userId={u.id} link={buildLink(u.access_token)} />
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex flex-col gap-1">
                    <ResetPasswordButton userId={u.id} />
                    {u.role !== "admin" && <ResetToDefaultButton userId={u.id} />}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-zinc-500">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
