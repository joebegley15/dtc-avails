"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  showKey,
  splitProducerNames,
  validateShowInput,
  type ParsedShow,
  type ProducerMatch,
} from "@/lib/show-parsing";
import {
  insertShowQuery,
  loadExistingShowKeys,
  loadProducerOptions,
} from "@/lib/shows";

const CSV_FIELDS = [
  "city",
  "neighborhood",
  "date",
  "time",
  "producer",
  "venue",
  "capacity",
] as const;

export type CsvRow = Record<(typeof CSV_FIELDS)[number], string>;

export type PreviewRow = {
  /** 1-based position among the CSV's data rows. */
  row: number;
  raw: CsvRow;
  /** Parsed values; null when the row has errors. */
  show: ParsedShow | null;
  /** Producer names as matched in the database. */
  producerNames: string[];
  /** How each name in the CSV cell was matched (exact, initial, spelling). */
  producerMatches: ProducerMatch[];
  errors: string[];
  duplicate: "existing" | "in-file" | null;
};

export type ValidateResult = { rows: PreviewRow[] } | { error: string };

const MAX_ROWS = 1000;

// Rows come from the browser: coerce every field to a string.
function coerceRow(value: unknown): CsvRow {
  const source =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const row = {} as CsvRow;
  for (const field of CSV_FIELDS) {
    const v = source[field];
    row[field] = typeof v === "string" ? v : "";
  }
  return row;
}

async function validateRows(input: unknown): Promise<ValidateResult> {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "The file has no data rows." };
  }
  if (input.length > MAX_ROWS) {
    return { error: `Too many rows (${input.length}). The limit is ${MAX_ROWS}.` };
  }

  const producers = await loadProducerOptions();
  const raws = input.map(coerceRow);
  const validations = raws.map((raw) =>
    validateShowInput(
      {
        city: raw.city,
        neighborhood: raw.neighborhood,
        date: raw.date,
        time: raw.time,
        venue: raw.venue,
        capacity: raw.capacity,
        producerNames: splitProducerNames(raw.producer),
      },
      producers
    )
  );

  const dates = [
    ...new Set(validations.flatMap((v) => (v.show ? [v.show.showDate] : []))),
  ];
  const existing = await loadExistingShowKeys(dates);
  const seenInFile = new Set<string>();

  const rows = validations.map((v, i): PreviewRow => {
    let duplicate: PreviewRow["duplicate"] = null;
    if (v.show) {
      const key = showKey(v.show.showDate, v.show.showTime, v.show.venue);
      if (existing.has(key)) {
        duplicate = "existing";
      } else if (seenInFile.has(key)) {
        duplicate = "in-file";
      } else {
        seenInFile.add(key);
      }
    }
    return {
      row: i + 1,
      raw: raws[i],
      show: v.show,
      producerNames: v.producerNames,
      producerMatches: v.producerMatches,
      errors: v.errors,
      duplicate,
    };
  });

  return { rows };
}

/** Validates only. Saves nothing. */
export async function validateShows(rows: CsvRow[]): Promise<ValidateResult> {
  await requireAdmin();
  return validateRows(rows);
}

/**
 * Validates again on the server, inserts every valid non-duplicate show that
 * wasn't unchecked (and its producers) in one transaction, then redirects to
 * /admin/shows.
 *
 * The full row list is validated exactly as it was previewed; `excludedRows`
 * (1-based row numbers) can only remove shows from the import, never add.
 */
export async function importShows(
  rows: CsvRow[],
  excludedRows: number[] = []
): Promise<{ error: string } | undefined> {
  await requireAdmin();

  const result = await validateRows(rows);
  if ("error" in result) return result;

  const excluded = new Set(
    Array.isArray(excludedRows)
      ? excludedRows.filter((n): n is number => Number.isInteger(n))
      : []
  );
  const importable = result.rows.filter((r) => r.show && !r.duplicate);
  const toImport = importable.flatMap((r) =>
    r.show && !excluded.has(r.row) ? [r.show] : []
  );
  if (toImport.length === 0) {
    return {
      error:
        importable.length > 0
          ? "No shows are selected to import."
          : "There are no valid shows to import.",
    };
  }

  // Each insert re-checks for duplicates itself, so a show added by someone
  // else since validation is skipped instead of doubled.
  const results = (await sql.transaction(
    toImport.map(insertShowQuery)
  )) as unknown as unknown[][];
  const imported = results.filter((r) => r.length > 0).length;
  const skipped = result.rows.length - imported;

  revalidatePath("/admin/shows");
  redirect(`/admin/shows?imported=${imported}&skipped=${skipped}`);
}
