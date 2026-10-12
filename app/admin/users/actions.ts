"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { DEFAULT_PASSWORD, requireAdmin } from "@/lib/auth";
import { buildLink, generateToken } from "@/lib/tokens";
import type { Role } from "@/lib/session";
import { matchHomeMarket } from "@/lib/markets";

const MIN_PASSWORD_LENGTH = 6;
// bcrypt only uses the first 72 bytes; reject longer input instead of
// silently truncating it.
const MAX_PASSWORD_BYTES = 72;

function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`;
  }
  return null;
}

export type AddUserState = { error?: string; success?: string };

const ROLES: Role[] = ["producer", "comic"];

export async function createUser(
  _prevState: AddUserState,
  formData: FormData
): Promise<AddUserState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const homeMarket = String(formData.get("homeMarket") ?? "").trim();
  const isAllStar = formData.get("isAllStar") === "on";

  if (!name || !email || !password || !role) {
    return { error: "Name, email, password, and role are required." };
  }
  const pwError = passwordError(password);
  if (pwError) {
    return { error: pwError };
  }
  if (!ROLES.includes(role)) {
    return { error: "Invalid role." };
  }
  if (homeMarket && !matchHomeMarket(homeMarket)) {
    return { error: "Pick a home market from the list." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await sql`
      insert into users (name, email, password_hash, role, home_market, is_all_star)
      values (${name}, ${email}, ${passwordHash}, ${role}, ${matchHomeMarket(homeMarket)}, ${isAllStar})
    `;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return { error: "That email is already in use." };
    }
    throw err;
  }

  revalidatePath("/admin/users");
  return { success: `Added ${name}.` };
}

export type ResetPasswordState = { error?: string; success?: string };

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  await requireAdmin();

  const userId = Number(formData.get("userId"));
  const password = String(formData.get("password") ?? "");

  if (!Number.isInteger(userId)) {
    return { error: "Invalid user." };
  }
  const pwError = passwordError(password);
  if (pwError) {
    return { error: pwError };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = (await sql`
    update users set password_hash = ${passwordHash}
    where id = ${userId}
    returning id
  `) as { id: number }[];

  if (updated.length === 0) {
    return { error: "User not found." };
  }

  return { success: "Password updated." };
}

export type ResetToDefaultResult = { ok: boolean; message: string };

/**
 * Sets the user's password back to DEFAULT_PASSWORD and makes them choose a
 * new one at their next login. Never applies to admins.
 */
export async function resetToDefault(
  userId: number
): Promise<ResetToDefaultResult> {
  await requireAdmin();

  if (typeof userId !== "number" || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, message: "Invalid user." };
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const updated = (await sql`
    update users
    set password_hash = ${passwordHash}, must_change_password = true
    where id = ${userId} and role <> 'admin'
    returning id
  `) as { id: number }[];

  if (updated.length === 0) {
    const found = await sql`select role from users where id = ${userId}`;
    return {
      ok: false,
      message:
        found.length === 0
          ? "User not found."
          : "Admins can't be reset to the default password.",
    };
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "Reset. They'll choose a new password at next login." };
}

export type RegenerateTokenResult = { ok: boolean; link?: string; error?: string };

/**
 * Replaces a user's access token with a fresh one, which immediately
 * invalidates their old link (the old value is simply overwritten and
 * discarded, so it can never match again). Only ever touches a user who
 * already has a token: this replaces a link, it doesn't create a first one.
 */
export async function regenerateAccessToken(
  userId: number
): Promise<RegenerateTokenResult> {
  await requireAdmin();

  if (typeof userId !== "number" || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, error: "Invalid user." };
  }

  const token = generateToken();
  const updated = (await sql`
    update users
    set access_token = ${token}, token_created_at = now(),
      -- Link-only users (no password) never change one. A not-yet-activated
      -- user with a password keeps the flag, so the new link still makes
      -- them choose one.
      must_change_password = must_change_password and password_hash is not null
    where id = ${userId} and access_token is not null
    returning id
  `) as { id: number }[];

  if (updated.length === 0) {
    return { ok: false, error: "This user doesn't have a link yet." };
  }

  revalidatePath("/admin/users");
  return { ok: true, link: buildLink(token) };
}

export type DeleteUserResult = { ok: boolean; message: string };

/**
 * Permanently deletes a non-admin user. Their avails and show-producer
 * assignments go with them (on delete cascade). The two references without a
 * cascade are cleared first: the legacy shows.producer_id column, and
 * invites.used_by, so a used invite still shows as used, just by "someone".
 * Admins can't be deleted here, which also means invites.created_by (always
 * an admin) never blocks a delete.
 */
export async function deleteUser(userId: number): Promise<DeleteUserResult> {
  await requireAdmin();

  if (typeof userId !== "number" || !Number.isInteger(userId) || userId <= 0) {
    return { ok: false, message: "Invalid user." };
  }

  const [, , deleted] = (await sql.transaction([
    sql`update shows set producer_id = null where producer_id = ${userId}`,
    sql`update invites set used_by = null where used_by = ${userId}`,
    sql`delete from users where id = ${userId} and role <> 'admin' returning id`,
  ])) as unknown as [unknown, unknown, { id: number }[]];

  if (deleted.length === 0) {
    const found = await sql`select 1 from users where id = ${userId}`;
    return {
      ok: false,
      message: found.length === 0 ? "User not found." : "Admins can't be deleted.",
    };
  }

  revalidatePath("/admin/users");
  return { ok: true, message: "Deleted." };
}

export type UpdateUserResult = { ok: boolean; error?: string };

function validUserId(userId: unknown): userId is number {
  return typeof userId === "number" && Number.isInteger(userId) && userId > 0;
}

/** Sets (or clears, with "") a user's home market. Only listed markets. */
export async function setHomeMarket(
  userId: number,
  homeMarket: string
): Promise<UpdateUserResult> {
  await requireAdmin();

  if (!validUserId(userId) || typeof homeMarket !== "string") {
    return { ok: false, error: "Invalid request." };
  }
  const market = homeMarket ? matchHomeMarket(homeMarket) : null;
  if (homeMarket && !market) {
    return { ok: false, error: "Pick a home market from the list." };
  }

  const updated = await sql`
    update users set home_market = ${market} where id = ${userId} returning id
  `;
  if (updated.length === 0) return { ok: false, error: "User not found." };

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Adds or removes a user's all-star star. */
export async function setAllStar(
  userId: number,
  isAllStar: boolean
): Promise<UpdateUserResult> {
  await requireAdmin();

  if (!validUserId(userId) || typeof isAllStar !== "boolean") {
    return { ok: false, error: "Invalid request." };
  }

  const updated = await sql`
    update users set is_all_star = ${isAllStar} where id = ${userId} returning id
  `;
  if (updated.length === 0) return { ok: false, error: "User not found." };

  revalidatePath("/admin/users");
  return { ok: true };
}

export type InviteLinkResult = { ok: boolean; link?: string; error?: string };

/**
 * Gives a not-yet-activated user (never set their own password) a sign-in
 * link, or returns the one they already have. Opening it signs them in, and
 * because must_change_password is set for anyone with an email, they land on
 * /change-password. Setting a password there clears the token, so the link
 * is one-time. Users without an email are link-only comics: their link stays.
 */
export async function getInviteLink(userId: number): Promise<InviteLinkResult> {
  await requireAdmin();

  if (!validUserId(userId)) return { ok: false, error: "Invalid user." };

  const token = generateToken();
  const rows = (await sql`
    update users
    set access_token = coalesce(access_token, ${token}),
        token_created_at = coalesce(token_created_at, now()),
        must_change_password = must_change_password or email is not null
    where id = ${userId}
      and role <> 'admin'
      and (must_change_password or password_hash is null)
    returning access_token
  `) as { access_token: string }[];

  if (rows.length === 0) {
    return { ok: false, error: "This user has already activated their account." };
  }

  revalidatePath("/admin/users");
  return { ok: true, link: buildLink(rows[0].access_token) };
}
