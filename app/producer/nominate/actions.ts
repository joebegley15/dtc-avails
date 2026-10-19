"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { NOMINATION_NOTE_MAX, normalizeHandle } from "@/lib/nomination-message";

export type NominateState = {
  ok?: boolean;
  error?: string;
  values?: { name: string; handle: string; note: string };
};

const MAX_NAME_LENGTH = 100;

const STATUS_LABELS: Record<string, string> = {
  pending: "waiting for approval",
  approved: "approved",
  signed_up: "signed up",
};

export async function nominateComic(
  _prevState: NominateState,
  formData: FormData
): Promise<NominateState> {
  const user = await requireUser();
  if (user.role !== "producer" && user.role !== "admin") {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const handleInput = String(formData.get("handle") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const values = { name, handle: handleInput, note };

  if (!name) {
    return { error: "Enter the comic's name.", values };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Keep the name under ${MAX_NAME_LENGTH} characters.`, values };
  }
  if (!handleInput) {
    return { error: "Enter their Instagram handle.", values };
  }
  const handle = normalizeHandle(handleInput);
  if (!handle) {
    return {
      error: "That isn't an Instagram handle. Use letters, numbers, periods and underscores.",
      values,
    };
  }
  if (note.length > NOMINATION_NOTE_MAX) {
    return { error: `Keep the note under ${NOMINATION_NOTE_MAX} characters.`, values };
  }

  const existing = (await sql`
    select status from nominations
    where instagram_handle = ${handle}
      and status in ('pending', 'approved', 'signed_up')
    limit 1
  `) as { status: string }[];
  if (existing[0]) {
    return {
      error: `Already nominated. Status: ${STATUS_LABELS[existing[0].status] ?? existing[0].status}`,
      values,
    };
  }

  const sameName = await sql`
    select 1 from users where lower(trim(name)) = lower(${name}) limit 1
  `;
  if (sameName.length > 0) {
    return { error: "They already have an account.", values };
  }

  try {
    await sql`
      insert into nominations (comic_name, instagram_handle, note, nominated_by)
      values (${name}, ${handle}, ${note || null}, ${user.id})
    `;
  } catch (err) {
    // Another producer nominated the same handle a moment ago: the partial
    // unique index on live handles turned this insert away.
    if ((err as { code?: string }).code === "23505") {
      return { error: "Already nominated. Status: waiting for approval", values };
    }
    throw err;
  }

  revalidatePath("/producer/nominate");
  revalidatePath("/admin/approvals");
  return { ok: true };
}
