"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/session";
import { roleHomePath } from "@/lib/roles";
import { claimInviteAndCreateUser, lookupInvite } from "@/lib/invites";

export type AcceptInviteState = {
  error?: string;
  values?: { email: string; homeMarket: string };
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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const homeMarket = String(formData.get("homeMarket") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const values = { email, homeMarket };

  // Checked here too, not just on the page: a link can be used (or revoked)
  // between the page loading and the form being submitted. The invitee's
  // name isn't part of the form at all — it was fixed by the admin who sent
  // the link, so it comes from the invite itself, not from this submission.
  const invite = await lookupInvite(token);
  if (invite.status !== "valid") {
    return {
      error: invite.status === "used" ? USED_LINK_ERROR : INVALID_LINK_ERROR,
      values,
    };
  }

  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Enter a valid email.", values };
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

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await claimInviteAndCreateUser(invite.id, {
    name: invite.name,
    email,
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
