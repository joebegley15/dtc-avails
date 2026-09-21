"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { createSession, type Role } from "@/lib/session";
import { roleHomePath } from "@/lib/roles";

// `email` is echoed back on failure: React resets the form after an action, and
// without it the user would have to retype their email after every typo.
export type LoginState = { error?: string; email?: string };

const MISMATCH_ERROR = "That email and password don't match.";

// Compared against when the email doesn't exist, so a miss costs the same
// as a wrong password.
const DUMMY_HASH =
  "$2b$10$erxkP9WAM02iF4N4uQHv2eEWT0P.9jnLbaTLgDESnPVkACYh3NxPi";

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const typedEmail = String(formData.get("email") ?? "").trim();
  const email = typedEmail.toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: MISMATCH_ERROR, email: typedEmail };
  }

  const rows = (await sql`
    select id, role, password_hash, must_change_password from users
    where lower(email) = ${email}
  `) as {
    id: number;
    role: Role;
    password_hash: string | null;
    must_change_password: boolean;
  }[];

  const user = rows[0];
  const matches = await bcrypt.compare(
    password,
    user?.password_hash ?? DUMMY_HASH
  );
  if (!user || !user.password_hash || !matches) {
    return { error: MISMATCH_ERROR, email: typedEmail };
  }

  await createSession(user.id);
  redirect(user.must_change_password ? "/change-password" : roleHomePath(user.role));
}
