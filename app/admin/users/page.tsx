import Link from "next/link";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildLink } from "@/lib/tokens";
import { CreateUserForm } from "@/components/create-user-form";
import { createUser } from "./actions";
import { DeleteUserButton } from "./delete-user-button";
import { EditUserButton } from "./edit-user-button";
import { LinkCell } from "./link-cell";
import { ResetPasswordButton } from "./reset-password-button";
import { ResetToDefaultButton } from "./reset-to-default-button";
import { matchCity } from "@/lib/cities";
import { creatableRoles, roleLabel, ROLES, type Role } from "@/lib/roles";
import type { PassLevel } from "@/lib/pass-level";
import {
  AllStarToggle,
  HomeMarketCell,
  InviteLinkButton,
  PassLevelSelect,
} from "./user-cells";
import { OTHER_MARKET, UserFilters } from "./user-filters";

const ROLE_FILTERS: string[] = [...ROLES];
const STATUSES = ["activated", "not-activated"];

type UserRow = {
  id: number;
  name: string;
  email: string | null;
  role: Role;
  pass_level: PassLevel;
  created_by_name: string | null;
  home_market: string | null;
  is_all_star: boolean;
  has_truck: boolean | null;
  access_token: string | null;
  activated: boolean;
};

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  await requireAdmin();

  // ?q= searches names and emails; ?role=, ?market= and ?status= filter the
  // table. Unknown values are ignored.
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const needle = query.toLowerCase();
  const roleParam = typeof params.role === "string" ? params.role : "";
  const statusParam = typeof params.status === "string" ? params.status : "";
  const status = STATUSES.includes(statusParam) ? statusParam : "";
  const marketParam = typeof params.market === "string" ? params.market : "";
  const role = ROLE_FILTERS.includes(roleParam) ? roleParam : "";
  const marketMatch = marketParam === OTHER_MARKET ? OTHER_MARKET : matchCity(marketParam);

  const allUsers = (await sql`
    select u.id, u.name, u.email, u.role, u.pass_level, u.home_market, u.is_all_star,
      u.has_truck, u.access_token,
      creator.name as created_by_name,
      -- Has chosen their own password.
      not (u.must_change_password or u.password_hash is null) as activated
    from users u
    left join users creator on creator.id = u.created_by
    -- Names are "First Last", so this is by first name.
    order by lower(u.name), u.id
  `) as UserRow[];

  // Each user's market through matchCity, so values saved in other forms
  // ("Austin") count as their city ("Austin, TX").
  const userMarkets = new Map(
    allUsers.map((u) => [u.id, u.home_market ? matchCity(u.home_market) : null])
  );
  // Filter options: every market a user has.
  const markets = [...new Set(userMarkets.values())]
    .filter((m): m is string => m !== null)
    .sort((a, b) => a.localeCompare(b));
  const market =
    marketMatch && (marketMatch === OTHER_MARKET || markets.includes(marketMatch))
      ? marketMatch
      : "";

  const filtered = allUsers.filter((u) => {
    if (
      needle &&
      !u.name.toLowerCase().includes(needle) &&
      !u.email?.toLowerCase().includes(needle)
    ) {
      return false;
    }
    if (role && u.role !== role) return false;
    if (status && u.activated !== (status === "activated")) return false;
    if (market) {
      const userMarket = userMarkets.get(u.id) ?? null;
      return market === OTHER_MARKET ? userMarket === null : userMarket === market;
    }
    return true;
  });

  const activatedCount = allUsers.filter((u) => u.activated).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-950">Users</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Add comics, producers, Lead Producers, and Bookers here.
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

      <CreateUserForm
        action={createUser}
        roles={creatableRoles("admin")}
        allowAllStar
      />

      <UserFilters
        key={`${role}|${market}|${status}`}
        role={role}
        market={market}
        markets={markets}
        status={status}
        query={query}
        activated={activatedCount}
        shown={filtered.length}
        total={allUsers.length}
      />

      <div className="mt-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Pass</th>
              <th className="py-2 pr-4">Added by</th>
              <th className="py-2 pr-4">Account</th>
              <th className="py-2 pr-4">Home market</th>
              <th className="py-2 pr-4">All-star</th>
              <th className="py-2 pr-4">Truck</th>
              <th className="py-2 pr-4">Link</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {filtered.map((u) => (
              <tr key={u.id}>
                <td className="py-2 pr-4 font-medium text-zinc-950">{u.name}</td>
                <td className="break-all py-2 pr-4 text-zinc-600">{u.email ?? "—"}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-zinc-600">{roleLabel(u.role)}</td>
                <td className="py-2 pr-4">
                  {u.role === "comic" ? (
                    <PassLevelSelect userId={u.id} passLevel={u.pass_level} />
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-zinc-600">{u.created_by_name ?? "—"}</td>
                <td className="whitespace-nowrap py-2 pr-4">
                  {u.activated ? (
                    <span className="text-xs font-medium text-emerald-700">Activated</span>
                  ) : (
                    <span className="text-xs font-medium text-amber-700">Not activated</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <HomeMarketCell
                    // Remount after a save so defaultValue tracks the server.
                    key={u.home_market ?? ""}
                    userId={u.id}
                    homeMarket={u.home_market}
                  />
                </td>
                <td className="py-2 pr-4">
                  <AllStarToggle userId={u.id} isAllStar={u.is_all_star} />
                </td>
                <td className="py-2 pr-4 text-zinc-600">
                  {u.has_truck === null ? "—" : u.has_truck ? "Yes" : "No"}
                </td>
                <td className="py-2 pr-4">
                  {u.access_token ? (
                    <LinkCell userId={u.id} name={u.name} link={buildLink(u.access_token)} />
                  ) : !u.activated && u.role !== "admin" ? (
                    <InviteLinkButton userId={u.id} />
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="py-2">
                  <div className="flex flex-col gap-1">
                    <EditUserButton
                      user={{
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        has_truck: u.has_truck,
                      }}
                    />
                    <ResetPasswordButton userId={u.id} />
                    {u.role !== "admin" && <ResetToDefaultButton userId={u.id} />}
                    {u.role !== "admin" && (
                      <DeleteUserButton userId={u.id} name={u.name} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="py-4 text-center text-zinc-500">
                  {allUsers.length === 0 ? "No users yet." : "No users match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
