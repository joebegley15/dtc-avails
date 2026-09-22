"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/session";
import { roleHomePath } from "@/lib/roles";
import { claimInviteAndCreateUser, lookupInvite } from "@/lib/invites";
import { uniqueUsername, usernameBase } from "@/lib/user-import";

export type AcceptInviteState = {
  error?: string;
  values?: { name: string; email: string; username: string; homeMarket: string };
};

const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes; reject longer input instead of
// silently truncating it.
const MAX_PASSWORD_BYTES = 72;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVALID_LINK_ERROR = "This link isn't valid. Ask for a new one.";
const USED_LINK_ERROR = "This link has already been used. Ask for a new one.";

export async function acceptInvite(
  _prevState: AcceptInviteState,
  formData: FormData
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const usernameRaw = String(formData.get("username") ?? "").trim().toLowerCase();
  const homeMarket = String(formData.get("homeMarket") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const values = { name, email, username: usernameRaw, homeMarket };

  // Checked here too, not just on the page: a link can be used (or revoked)
  // between the page loading and the form being submitted.
  const invite = await lookupInvite(token);
  if (invite.status !== "valid") {
    return {
      error: invite.status === "used" ? USED_LINK_ERROR : INVALID_LINK_ERROR,
      values,
    };
  }

  if (!name) return { error: "Name is required.", values };
  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Enter a valid email.", values };
  }
  if (usernameRaw && /\s/.test(usernameRaw)) {
    return { error: "Username can't contain spaces.", values };
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

  // Validated before touching the invite, so a typo never burns the link:
  // it's only claimed once an account is actually about to be created.
  const existingEmail = await sql`select 1 from users where lower(email) = ${email}`;
  if (existingEmail.length > 0) {
    return { error: "That email is already in use.", values };
  }

  let username = usernameRaw;
  if (username) {
    const takenByOther = await sql`
      select 1 from users where lower(username) = ${username}
    `;
    if (takenByOther.length > 0) {
      return { error: "That username is already in use.", values };
    }
  } else {
    const taken = new Set(
      (
        (await sql`select username from users where username is not null`) as {
          username: string;
        }[]
      ).map((r) => r.username.toLowerCase())
    );
    username = uniqueUsername(usernameBase(email), taken);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await claimInviteAndCreateUser(invite.id, {
    name,
    email,
    username,
    passwordHash,
    role: invite.role,
    homeMarket: homeMarket || null,
  });

  if (userId === null) {
    // Someone else finished with this exact link in the moment between our
    // lookup above and now.
    return { error: USED_LINK_ERROR, values };
  }

  await createSession(userId);
  redirect(roleHomePath(invite.role));
}
