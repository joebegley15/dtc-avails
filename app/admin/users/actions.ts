"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { DEFAULT_PASSWORD, requireAdmin } from "@/lib/auth";
import type { Role } from "@/lib/session";

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
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const homeMarket = String(formData.get("homeMarket") ?? "").trim();
  const isAllStar = formData.get("isAllStar") === "on";

  if (!name || !email || !username || !password || !role) {
    return { error: "Name, email, username, password, and role are required." };
  }
  if (/\s/.test(username)) {
    return { error: "Username can't contain spaces." };
  }
  const pwError = passwordError(password);
  if (pwError) {
    return { error: pwError };
  }
  if (!ROLES.includes(role)) {
    return { error: "Invalid role." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await sql`
      insert into users (name, email, username, password_hash, role, home_market, is_all_star)
      values (${name}, ${email}, ${username}, ${passwordHash}, ${role}, ${homeMarket || null}, ${isAllStar})
    `;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      const constraint =
        "constraint" in err ? String(err.constraint) : "";
      return {
        error: constraint.includes("username")
          ? "That username is already in use."
          : "That email is already in use.",
      };
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
