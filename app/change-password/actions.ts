"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { DEFAULT_PASSWORD, requireUserMustChangePassword } from "@/lib/auth";
import { roleHomePath } from "@/lib/roles";

export type ChangePasswordState = { error?: string; email?: string };

const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes; reject longer input instead of
// silently truncating it.
const MAX_PASSWORD_BYTES = 72;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_TAKEN_ERROR = "That email is already in use.";

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const user = await requireUserMustChangePassword();

  // Link-only comics have no email yet, so this doubles as their sign-up.
  const email = user.has_email
    ? null
    : String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fail = (error: string) => ({ error, email: email ?? undefined });

  if (email !== null && !EMAIL_RE.test(email)) {
    return fail("Enter a valid email.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return fail(`Password must be at most ${MAX_PASSWORD_BYTES} bytes.`);
  }
  if (password.toLowerCase() === DEFAULT_PASSWORD.toLowerCase()) {
    return fail("Choose a password other than the default one.");
  }
  if (password !== confirm) {
    return fail("The two passwords don't match.");
  }
  if (email !== null) {
    const taken = await sql`
      select 1 from users where lower(email) = ${email} and id <> ${user.id}
    `;
    if (taken.length > 0) return fail(EMAIL_TAKEN_ERROR);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await sql`
      update users
      set password_hash = ${passwordHash}, must_change_password = false,
        email = coalesce(email, ${email}::text),
        -- Any link that got them here is one-time: it stops working now.
        access_token = null, token_created_at = null
      where id = ${user.id}
    `;
  } catch (err) {
    // Someone else took the email between the check above and now.
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return fail(EMAIL_TAKEN_ERROR);
    }
    throw err;
  }

  redirect(roleHomePath(user.role));
}
