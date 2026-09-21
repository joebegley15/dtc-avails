"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { createSession, type Role } from "@/lib/session";
import { roleHomePath } from "@/lib/roles";

export type LoginState = { error?: string };

const MISMATCH_ERROR = "That username and password don't match.";

// Compared against when the username doesn't exist, so a miss costs the same
// as a wrong password.
const DUMMY_HASH =
  "$2b$10$erxkP9WAM02iF4N4uQHv2eEWT0P.9jnLbaTLgDESnPVkACYh3NxPi";

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: MISMATCH_ERROR };
  }

  const rows = (await sql`
    select id, role, password_hash from users
    where lower(username) = ${username}
  `) as { id: number; role: Role; password_hash: string | null }[];

  const user = rows[0];
  const matches = await bcrypt.compare(
    password,
    user?.password_hash ?? DUMMY_HASH
  );
  if (!user || !user.password_hash || !matches) {
    return { error: MISMATCH_ERROR };
  }

  await createSession(user.id);
  redirect(roleHomePath(user.role));
}
