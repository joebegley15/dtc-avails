"use server";

import { revalidatePath } from "next/cache";
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
