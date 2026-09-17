"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession, type Role } from "@/lib/session";
import { roleHomePath } from "@/lib/roles";

export type LoginState = { error?: string };

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phoneLast4 = String(formData.get("phoneLast4") ?? "").trim();

  if (!email || !phoneLast4) {
    return { error: "That email and code don't match." };
  }

  const rows = (await sql`
    select id, role from users
    where lower(email) = ${email} and phone_last4 = ${phoneLast4} and role != 'admin'
  `) as { id: number; role: Role }[];

  const user = rows[0];
  if (!user) {
    return { error: "That email and code don't match." };
  }

  await createSession(user.id);
  redirect(roleHomePath(user.role));
}
