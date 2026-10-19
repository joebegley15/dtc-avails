// Server-side data access for producer nominations. Import from server code
// only. A nomination is a name and an Instagram handle, not a user: the user
// row is only created when the comic signs up through the approved link.
//
// The invite token is stored in the clear (like users.access_token, see
// lib/tokens.ts) so the producer and admin can copy the link again later.
import { sql } from "./db";
import { generateToken } from "./tokens";
import { INVITE_LINK_DAYS, type NominationStatus } from "./nomination-message";

const LINK_INTERVAL = `${INVITE_LINK_DAYS} days`;

export type MyNomination = {
  id: number;
  comic_name: string;
  instagram_handle: string | null;
  status: NominationStatus;
  created_at: string;
  /** Only for approved nominations; never for signed_up ones. */
  invite_token: string | null;
  token_expires_at: string | null;
};

/** One producer's own nominations, newest first. */
export async function listMyNominations(producerId: number): Promise<MyNomination[]> {
  return (await sql`
    select id, comic_name, instagram_handle, status,
      created_at::text as created_at,
      case when status = 'approved' then invite_token end as invite_token,
      case when status = 'approved' then token_expires_at::text end as token_expires_at
    from nominations
    where nominated_by = ${producerId}
    order by created_at desc, id desc
  `) as MyNomination[];
}

export type PendingNomination = {
  id: number;
  comic_name: string;
  instagram_handle: string | null;
  note: string | null;
  nominated_by_name: string;
  created_at: string;
};

export async function listPendingNominations(): Promise<PendingNomination[]> {
  return (await sql`
    select n.id, n.comic_name, n.instagram_handle, n.note,
      u.name as nominated_by_name,
      n.created_at::text as created_at
    from nominations n
    join users u on u.id = n.nominated_by
    where n.status = 'pending'
    order by n.created_at, n.id
  `) as PendingNomination[];
}

export type ApprovedNomination = {
  id: number;
  comic_name: string;
  nominated_by_name: string;
  reviewed_at: string;
  status: "approved" | "signed_up";
  invite_token: string | null;
  token_expires_at: string | null;
  signed_up_user_name: string | null;
};

/** Approved nominations, used or not, most recently reviewed first. */
export async function listApprovedNominations(): Promise<ApprovedNomination[]> {
  return (await sql`
    select n.id, n.comic_name, n.status,
      u.name as nominated_by_name,
      n.reviewed_at::text as reviewed_at,
      case when n.status = 'approved' then n.invite_token end as invite_token,
      case when n.status = 'approved' then n.token_expires_at::text end as token_expires_at,
      su.name as signed_up_user_name
    from nominations n
    join users u on u.id = n.nominated_by
    left join users su on su.id = n.signed_up_user_id
    where n.status in ('approved', 'signed_up')
    order by n.reviewed_at desc nulls last, n.id desc
  `) as ApprovedNomination[];
}

export async function countPendingNominations(): Promise<number> {
  const [row] = (await sql`
    select count(*)::int as n from nominations where status = 'pending'
  `) as { n: number }[];
  return row?.n ?? 0;
}

/**
 * Approves pending nominations, each with its own fresh link. Returns how
 * many were approved; ones no longer pending are skipped.
 */
export async function approveNominations(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const results = await sql.transaction(
    ids.map(
      (id) => sql`
        update nominations set
          status = 'approved',
          invite_token = ${generateToken()},
          token_expires_at = now() + ${LINK_INTERVAL}::interval,
          reviewed_at = now()
        where id = ${id} and status = 'pending'
        returning id
      `
    )
  );
  return results.reduce((sum, rows) => sum + rows.length, 0);
}

export async function rejectNomination(id: number): Promise<boolean> {
  const rows = await sql`
    update nominations set status = 'rejected', reviewed_at = now()
    where id = ${id} and status = 'pending'
    returning id
  `;
  return rows.length > 0;
}

/** A new token and expiry for an approved, unused nomination. The old link stops working. */
export async function regenerateNominationLink(id: number): Promise<boolean> {
  const rows = await sql`
    update nominations set
      invite_token = ${generateToken()},
      token_expires_at = now() + ${LINK_INTERVAL}::interval
    where id = ${id} and status = 'approved'
    returning id
  `;
  return rows.length > 0;
}

export type InviteNomination = { id: number; comic_name: string };

/**
 * The nomination behind a /invite link, if the link still works: approved
 * (not yet used) and not expired. Anything else is null, without saying why.
 */
export async function findInviteNomination(token: string): Promise<InviteNomination | null> {
  if (!token) return null;
  const rows = (await sql`
    select id, comic_name from nominations
    where invite_token = ${token}
      and status = 'approved'
      and token_expires_at > now()
  `) as InviteNomination[];
  return rows[0] ?? null;
}

export type NewNominatedUser = {
  name: string;
  email: string;
  passwordHash: string;
  homeMarket: string | null;
};

/**
 * Claims the nomination and creates the comic in one statement: the insert
 * only runs if the claim matched, so two submits racing on one link create
 * at most one user. The user's id is reserved first so the claim can record
 * it (signed_up_user_id is a deferred foreign key). Returns the new user's
 * id, or null if the link stopped working in the meantime.
 */
export async function claimNominationAndCreateUser(
  token: string,
  user: NewNominatedUser
): Promise<number | null> {
  const [{ id: userId }] = (await sql`
    select nextval(pg_get_serial_sequence('users', 'id'))::int as id
  `) as { id: number }[];

  const rows = (await sql`
    with claimed as (
      update nominations set
        status = 'signed_up',
        signed_up_user_id = ${userId}
      where invite_token = ${token}
        and status = 'approved'
        and token_expires_at > now()
      returning id
    )
    insert into users (id, name, email, password_hash, role, home_market)
    select
      ${userId}::int,
      ${user.name}::text,
      ${user.email}::text,
      ${user.passwordHash}::text,
      'comic',
      ${user.homeMarket}::text
    from claimed
    returning id
  `) as { id: number }[];

  return rows[0]?.id ?? null;
}

const SIGNUP_ATTEMPTS_PER_HOUR = 10;

/**
 * Logs a signup attempt from this IP and says whether it's within the limit
 * (10 an hour). Every attempt counts, successful or not.
 */
export async function recordSignupAttempt(ip: string): Promise<boolean> {
  const [, [row]] = (await sql.transaction([
    sql`insert into signup_attempts (ip) values (${ip})`,
    sql`
      select count(*)::int as n from signup_attempts
      where ip = ${ip} and attempted_at > now() - interval '1 hour'
    `,
  ])) as [unknown, { n: number }[]];
  return (row?.n ?? 0) <= SIGNUP_ATTEMPTS_PER_HOUR;
}
