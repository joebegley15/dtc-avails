"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { Role } from "@/lib/session";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

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
