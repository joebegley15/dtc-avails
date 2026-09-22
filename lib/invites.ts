// Server-side data access for one-time signup invites. Import from server
// code only. The raw token is never stored: only its hash is, so reading the
// database can't be used to sign up as an invited user.
import { randomBytes, createHash } from "node:crypto";
import { sql } from "./db";

export type InviteRole = "producer" | "comic";

export type InviteRow = {
  id: number;
  role: InviteRole;
  created_at: string;
  created_by_name: string;
  used_at: string | null;
  used_by_name: string | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A URL-safe, effectively unguessable one-time token. */
function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Creates an invite and returns its raw token. This is the only moment the
 * token is ever available in full; only its hash is kept afterward. */
export async function createInvite(
  role: InviteRole,
  createdBy: number
): Promise<string> {
  const token = generateToken();
  await sql`
    insert into invites (token_hash, role, created_by)
    values (${hashToken(token)}, ${role}, ${createdBy})
  `;
  return token;
}

export type InviteLookup =
  | { status: "invalid" }
  | { status: "used" }
  | { status: "valid"; id: number; role: InviteRole };

/** Read-only: does this token exist, and is it still unused? */
export async function lookupInvite(token: string): Promise<InviteLookup> {
  const rows = (await sql`
    select id, role, used_at from invites where token_hash = ${hashToken(token)}
  `) as { id: number; role: InviteRole; used_at: string | null }[];

  const row = rows[0];
  if (!row) return { status: "invalid" };
  if (row.used_at) return { status: "used" };
  return { status: "valid", id: row.id, role: row.role };
}

export type NewInviteUser = {
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  role: InviteRole;
  homeMarket: string | null;
};

/**
 * Creates the user and claims the invite as one atomic step: the update
 * inside the CTE only succeeds if the invite is still unused, and the insert
 * only runs if that update returned a row. So if two requests race on the
 * same token, at most one user gets created. Returns the new user's id, or
 * null if the invite had already been used by the time this ran.
 */
export async function claimInviteAndCreateUser(
  inviteId: number,
  user: NewInviteUser
): Promise<number | null> {
  const rows = (await sql`
    with claimed as (
      update invites set used_at = now()
      where id = ${inviteId} and used_at is null
      returning id
    )
    insert into users (name, email, username, password_hash, role, home_market)
    select
      ${user.name}::text,
      ${user.email}::text,
      ${user.username}::text,
      ${user.passwordHash}::text,
      ${user.role}::text,
      ${user.homeMarket}::text
    from claimed
    returning id
  `) as { id: number }[];

  const newUserId = rows[0]?.id ?? null;
  if (newUserId !== null) {
    // Bookkeeping only, not part of the single-use guarantee: used_at above
    // already ensures the invite can't be claimed again.
    await sql`update invites set used_by = ${newUserId} where id = ${inviteId}`;
  }
  return newUserId;
}

export async function listInvites(): Promise<InviteRow[]> {
  return (await sql`
    select
      i.id, i.role,
      i.created_at::text as created_at,
      i.used_at::text as used_at,
      creator.name as created_by_name,
      used.name as used_by_name
    from invites i
    join users creator on creator.id = i.created_by
    left join users used on used.id = i.used_by
    order by i.created_at desc
  `) as unknown as InviteRow[];
}

/** Removes a pending invite so its link stops working. Refuses one already used. */
export async function revokeInvite(id: number): Promise<boolean> {
  const rows = await sql`
    delete from invites where id = ${id} and used_at is null returning id
  `;
  return rows.length > 0;
}
