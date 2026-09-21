"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadVisibleShows } from "@/lib/avails";

export type AvailsAnswer = { showId: number; available: boolean };

export type SubmitAvailsResult = { ok: boolean; saved: number; error?: string };

const MAX_ANSWERS = 500;

export async function submitAvails(
  answers: AvailsAnswer[]
): Promise<SubmitAvailsResult> {
  const user = await requireUser();

  // The list comes from the browser: keep only well-formed entries, and never
  // trust which shows it names. Visibility is re-derived from the database.
  const requested = new Map<number, boolean>();
  if (Array.isArray(answers)) {
    for (const answer of answers.slice(0, MAX_ANSWERS)) {
      if (
        answer &&
        Number.isInteger(answer.showId) &&
        typeof answer.available === "boolean"
      ) {
        requested.set(answer.showId, answer.available);
      }
    }
  }

  const visibleIds = new Set((await loadVisibleShows(user)).map((s) => s.id));
  const allowed = [...requested].filter(([showId]) => visibleIds.has(showId));

  if (allowed.length === 0) {
    return { ok: false, saved: 0, error: "There were no avails to save." };
  }

  await sql.transaction(
    allowed.map(
      ([showId, available]) => sql`
        insert into avails (user_id, show_id, available, submitted_at)
        values (${user.id}, ${showId}, ${available}, now())
        on conflict (user_id, show_id)
        do update set available = excluded.available, submitted_at = now()
      `
    )
  );

  return { ok: true, saved: allowed.length };
}
