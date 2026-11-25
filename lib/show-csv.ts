// Pure CSV handling for the show bulk upload: header names, the row shape the
// browser sends to the server, and the Show Status rule. Safe to import from
// client code and tests.
import Papa from "papaparse";

export const SHOW_CSV_FIELDS = [
  "show_title",
  "showtime",
  "producers",
  "venue",
  "capacity",
  "all_star",
  "show_status",
] as const;

export type CsvRow = Record<(typeof SHOW_CSV_FIELDS)[number], string>;

export const REQUIRED_SHOW_HEADERS = ["show_title", "showtime", "producers", "venue"];

// The export's "Show Title" and "Show Status", and other spellings people use
// for the all-star column.
const HEADER_ALIASES: Record<string, string> = {
  "show title": "show_title",
  "show status": "show_status",
  "all-star": "all_star",
  "all star": "all_star",
  allstar: "all_star",
  is_all_star: "all_star",
  star: "all_star",
};

/** Header matching ignores case and surrounding whitespace. */
export function normalizeShowHeader(header: string): string {
  const key = header.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? key;
}

/**
 * A row whose Show Status is "Rejected" (any case, trimmed) is skipped
 * entirely: no show is created or updated from it. Any other value, or a
 * blank, imports as usual. Show Status is never stored.
 */
export function isRejectedStatus(status: string | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "rejected";
}

export type ParsedShowCsv =
  | { ok: true; rows: CsvRow[]; headers: string[] }
  | { ok: false; error: string };

/** Parses CSV text into rows of the known fields. Missing optional columns become "". */
export function parseShowCsv(text: string): ParsedShowCsv {
  const results = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeShowHeader,
  });
  const headers = results.meta.fields ?? [];
  const missing = REQUIRED_SHOW_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    const names = missing.map((h) => h.replace("_", " "));
    return { ok: false, error: `The CSV is missing required column(s): ${names.join(", ")}.` };
  }
  if (results.data.length === 0) {
    return { ok: false, error: "The file has no data rows." };
  }
  const rows = results.data.map((r) => {
    const row = {} as CsvRow;
    for (const h of SHOW_CSV_FIELDS) row[h] = String(r[h] ?? "");
    return row;
  });
  return { ok: true, rows, headers };
}
