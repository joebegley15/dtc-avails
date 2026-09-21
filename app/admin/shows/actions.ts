"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  showKey,
  validateShowInput,
  type ParsedShow,
  type ProducerOption,
} from "@/lib/show-parsing";
import {
  insertShowQuery,
  loadExistingShowKeys,
  loadProducerOptions,
  updateShowQueries,
} from "@/lib/shows";

export type ShowFormValues = {
  city: string;
  neighborhood: string;
  date: string;
  time: string;
  venue: string;
  capacity: string;
  producerIds: number[];
};

export type ShowActionResult = { ok: true } | { ok: false; errors: string[] };

const DUPLICATE_ERROR =
  "A show with the same date, time, and venue already exists.";

// Arguments arrive from the browser, so coerce instead of trusting the types.
function coerceValues(raw: ShowFormValues) {
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    city: text(raw?.city),
    neighborhood: text(raw?.neighborhood),
    date: text(raw?.date),
    time: text(raw?.time),
    venue: text(raw?.venue),
    capacity: text(raw?.capacity),
    producerIds: Array.isArray(raw?.producerIds)
      ? raw.producerIds.filter((id): id is number => Number.isInteger(id))
      : [],
  };
}

function validate(
  raw: ShowFormValues,
  producers: ProducerOption[]
): { show: ParsedShow } | { errors: string[] } {
  const { show, errors } = validateShowInput(coerceValues(raw), producers);
  return show ? { show } : { errors };
}

function asShowId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export async function createShow(
  values: ShowFormValues
): Promise<ShowActionResult> {
  await requireAdmin();

  const validated = validate(values, await loadProducerOptions());
  if ("errors" in validated) return { ok: false, errors: validated.errors };

  // The insert re-checks for a duplicate inside the statement itself.
  const inserted = (await insertShowQuery(validated.show)) as {
    show_id: number;
  }[];
  if (inserted.length === 0) return { ok: false, errors: [DUPLICATE_ERROR] };

  revalidatePath("/admin/shows");
  return { ok: true };
}

export async function updateShow(
  showId: number,
  values: ShowFormValues
): Promise<ShowActionResult> {
  await requireAdmin();

  const id = asShowId(showId);
  if (id === null) return { ok: false, errors: ["Invalid show."] };

  const existing = await sql`select id from shows where id = ${id}`;
  if (existing.length === 0) return { ok: false, errors: ["Show not found."] };

  const validated = validate(values, await loadProducerOptions());
  if ("errors" in validated) return { ok: false, errors: validated.errors };
  const { show } = validated;

  const others = await loadExistingShowKeys([show.showDate], id);
  if (others.has(showKey(show.showDate, show.showTime, show.venue))) {
    return { ok: false, errors: [DUPLICATE_ERROR] };
  }

  await sql.transaction(updateShowQueries(id, show));

  revalidatePath("/admin/shows");
  return { ok: true };
}

export async function toggleAllStar(showId: number): Promise<ShowActionResult> {
  await requireAdmin();

  const id = asShowId(showId);
  if (id === null) return { ok: false, errors: ["Invalid show."] };

  const updated = await sql`
    update shows set is_all_star = not is_all_star where id = ${id} returning id
  `;
  if (updated.length === 0) return { ok: false, errors: ["Show not found."] };

  revalidatePath("/admin/shows");
  return { ok: true };
}

export async function deleteShow(showId: number): Promise<ShowActionResult> {
  await requireAdmin();

  const id = asShowId(showId);
  if (id === null) return { ok: false, errors: ["Invalid show."] };

  // avails and show_producers rows go with it via ON DELETE CASCADE.
  await sql`delete from shows where id = ${id}`;

  revalidatePath("/admin/shows");
  return { ok: true };
}

// A valid bcrypt hash to compare against when the account has no password, so
// the response time doesn't reveal that.
const DUMMY_HASH =
  "$2b$10$erxkP9WAM02iF4N4uQHv2eEWT0P.9jnLbaTLgDESnPVkACYh3NxPi";

/** True only if `password` is the signed-in admin's own password. */
async function isOwnPassword(userId: number, password: unknown): Promise<boolean> {
  if (typeof password !== "string" || password === "") return false;

  const rows = (await sql`
    select password_hash from users where id = ${userId}
  `) as { password_hash: string | null }[];
  const hash = rows[0]?.password_hash ?? null;

  const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== null && matches;
}

export type PasswordCheckResult = { ok: boolean; error?: string };

/** Step 1 of "Delete all shows": is this the admin's own password? */
export async function checkPasswordForDeleteAll(
  password: string
): Promise<PasswordCheckResult> {
  const user = await requireAdmin();

  return (await isOwnPassword(user.id, password))
    ? { ok: true }
    : { ok: false, error: "Incorrect password." };
}

export type DeleteAllResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

/**
 * Step 2: deletes every show, past and upcoming. Their producer assignments
 * and every avail submitted for them go too, via ON DELETE CASCADE. The
 * password is checked again here; the step-1 check is only for feedback.
 */
export async function deleteAllShows(password: string): Promise<DeleteAllResult> {
  const user = await requireAdmin();

  if (!(await isOwnPassword(user.id, password))) {
    return { ok: false, error: "Incorrect password." };
  }

  const rows = (await sql`
    with gone as (delete from shows returning id)
    select count(*)::int as n from gone
  `) as { n: number }[];

  revalidatePath("/admin/shows");
  return { ok: true, deleted: rows[0]?.n ?? 0 };
}
