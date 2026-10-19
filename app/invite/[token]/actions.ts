"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/session";
import { matchHomeMarket } from "@/lib/markets";
import { INVALID_INVITE_MESSAGE } from "@/lib/nomination-message";
import {
  claimNominationAndCreateUser,
  findInviteNomination,
  recordSignupAttempt,
} from "@/lib/nominations";

export type InviteSignupState = {
  error?: string;
  values?: { name: string; email: string; homeMarket: string };
};

const MAX_NAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes; reject longer input instead of
// silently truncating it.
const MAX_PASSWORD_BYTES = 72;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** Public: no session. The token is the only credential. */
export async function signUpFromInvite(
  _prevState: InviteSignupState,
  formData: FormData
): Promise<InviteSignupState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const homeMarket = String(formData.get("homeMarket") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const values = { name, email, homeMarket };

  if (!(await recordSignupAttempt(await clientIp()))) {
    return { error: "Too many tries. Wait an hour and try again.", values };
  }

  // Checked again here, not just on the page: the link can be used, replaced
  // or expire between the page loading and this submit.
  if (!(await findInviteNomination(token))) {
    return { error: INVALID_INVITE_MESSAGE, values };
  }

  if (!name) {
    return { error: "Enter your name.", values };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Keep your name under ${MAX_NAME_LENGTH} characters.`, values };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Enter a valid email. You'll use it to sign in.", values };
  }
  if (homeMarket && !matchHomeMarket(homeMarket)) {
    return { error: "Pick a home market from the list.", values };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      values,
    };
  }
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
    return { error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`, values };
  }
  if (password !== confirm) {
    return { error: "The two passwords don't match.", values };
  }

  // Before claiming, so a taken email never burns the link.
  const existingEmail = await sql`select 1 from users where lower(email) = ${email}`;
  if (existingEmail.length > 0) {
    return { error: "That email already has an account. Sign in instead.", values };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let userId: number | null;
  try {
    userId = await claimNominationAndCreateUser(token, {
      name,
      email,
      passwordHash,
      homeMarket: matchHomeMarket(homeMarket),
    });
  } catch (err) {
    // The same email signed up a moment ago (users_email_key).
    if ((err as { code?: string }).code === "23505") {
      return { error: "That email already has an account. Sign in instead.", values };
    }
    throw err;
  }

  if (userId === null) {
    return { error: INVALID_INVITE_MESSAGE, values };
  }

  await createSession(userId);
  redirect("/avails");
}
