"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { DEFAULT_PASSWORD, requireUserMustChangePassword } from "@/lib/auth";
import { roleHomePath } from "@/lib/roles";

export type ChangePasswordState = { error?: string };

const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes; reject longer input instead of
// silently truncating it.
const MAX_PASSWORD_BYTES = 72;

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUserMustChangePassword();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return { error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes.` };
  }
  if (password.toLowerCase() === DEFAULT_PASSWORD.toLowerCase()) {
    return { error: "Choose a password other than the default one." };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await sql`
    update users
    set password_hash = ${passwordHash}, must_change_password = false
    where id = ${user.id}
  `;

  redirect(roleHomePath(user.role));
}
