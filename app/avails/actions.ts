"use server";

import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadVisibleShows } from "@/lib/avails";

/** available null means the show was left blank: any saved answer is removed. */
export type AvailsAnswer = {
  showId: number;
  available: boolean | null;
  downToHelp: boolean;
};

export type SubmitAvailsResult = { ok: boolean; saved: number; error?: string };

const MAX_ANSWERS = 500;

export async function submitAvails(
  answers: AvailsAnswer[],
  hasTruck: boolean
): Promise<SubmitAvailsResult> {
  const user = await requireUser();

  if (typeof hasTruck !== "boolean") {
    return { ok: false, saved: 0, error: "Answer whether you have a truck." };
  }

  // The list comes from the browser: keep only well-formed entries, and never
  // trust which shows it names. Visibility is re-derived from the database.
  const requested = new Map<
    number,
    { available: boolean | null; downToHelp: boolean }
  >();
  if (Array.isArray(answers)) {
    for (const answer of answers.slice(0, MAX_ANSWERS)) {
      if (
        answer &&
        Number.isInteger(answer.showId) &&
        (typeof answer.available === "boolean" || answer.available === null)
      ) {
        requested.set(answer.showId, {
          available: answer.available,
          downToHelp: answer.downToHelp === true,
        });
      }
    }
  }

  const visibleIds = new Set((await loadVisibleShows(user)).map((s) => s.id));
  const allowed = [...requested].filter(([showId]) => visibleIds.has(showId));
  const answered = allowed.flatMap(([showId, { available, downToHelp }]) =>
    available === null ? [] : [{ showId, available, downToHelp }]
  );
  const cleared = allowed.flatMap(([showId, { available }]) =>
    available === null ? [showId] : []
  );

  await sql.transaction([
    sql`update users set has_truck = ${hasTruck} where id = ${user.id}`,
    sql`
      delete from avails
      where user_id = ${user.id} and show_id = any(${cleared}::integer[])
    `,
    ...answered.map(
      ({ showId, available, downToHelp }) => sql`
        insert into avails (user_id, show_id, available, down_to_help, submitted_at)
        values (${user.id}, ${showId}, ${available}, ${downToHelp}, now())
        on conflict (user_id, show_id)
        do update set
          available = excluded.available,
          down_to_help = excluded.down_to_help,
          submitted_at = now()
      `
    ),
  ]);

  return { ok: true, saved: answered.length };
}
