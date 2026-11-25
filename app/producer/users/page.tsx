import { requireLeadProducer } from "@/lib/auth";
import { sql } from "@/lib/db";
import { creatableRoles, roleLabel, type Role } from "@/lib/roles";
import { passLevelLabel, type PassLevel } from "@/lib/pass-level";
import { CreateUserForm } from "@/components/create-user-form";
import { createUserAsLeadProducer } from "./actions";

type CreatedRow = {
  id: number;
  name: string;
  role: Role;
  home_market: string | null;
  pass_level: PassLevel;
  created_at: string;
};

export default async function LeadProducerUsersPage() {
  const user = await requireLeadProducer();

  // Only accounts this Lead Producer added, and no contact details.
  const created = (await sql`
    select id, name, role, home_market, pass_level,
      to_char(created_at at time zone 'America/Chicago', 'Mon DD, YYYY') as created_at
    from users
    where created_by = ${user.id}
    order by created_at desc, id desc
  `) as CreatedRow[];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-lg font-semibold text-zinc-950">Create user</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Add one comic or producer at a time. Give them the starting password
        you set here. Comics need a home market.
      </p>

      <CreateUserForm
        action={createUserAsLeadProducer}
        roles={creatableRoles("lead_producer")}
        allowAllStar={false}
        submitLabel="Create user"
      />

      <h2 className="mt-10 text-base font-semibold text-zinc-950">Accounts you&apos;ve added</h2>
      {created.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">None yet.</p>
      ) : (
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Home market</th>
              <th className="py-2 pr-4">Pass</th>
              <th className="py-2">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {created.map((u) => (
              <tr key={u.id}>
                <td className="py-2 pr-4 font-medium text-zinc-950">{u.name}</td>
                <td className="py-2 pr-4 text-zinc-600">{roleLabel(u.role)}</td>
                <td className="py-2 pr-4 text-zinc-600">{u.home_market ?? "—"}</td>
                <td className="py-2 pr-4 text-zinc-600">
                  {u.role === "comic" ? passLevelLabel(u.pass_level) : "—"}
                </td>
                <td className="py-2 text-zinc-600">{u.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
