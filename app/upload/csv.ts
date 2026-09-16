import { sql } from "@/lib/db";

export type ParsedRow = {
  line: number;
  city: string;
  neighborhood: string | null;
  showDate: string;
  showTime: string;
  venue: string;
  capacity: number | null;
  producerName: string;
  producerId: number | null;
  errors: string[];
  duplicateInFile: boolean;
  duplicateInDb: boolean;
};

export type ParseResult = {
  rows: ParsedRow[];
  headerError: string | null;
  unmatchedProducers: string[];
};

const REQUIRED_COLUMNS = ["city", "date", "time", "venue"] as const;
const OPTIONAL_COLUMNS = ["neighborhood", "producer", "capacity"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas,
// and "" escaped quotes within a quoted field.
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normalizeKey(city: string, venue: string, date: string, time: string) {
  return [city, venue, date, time].map((v) => v.trim().toLowerCase()).join("|");
}

export async function parseAndValidate(csvText: string): Promise<ParseResult> {
  const table = parseCsvText(csvText);

  if (table.length === 0) {
    return { rows: [], headerError: "No data found.", unmatchedProducers: [] };
  }

  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const columnIndex: Record<string, number> = {};
  for (const name of [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]) {
    columnIndex[name] = header.indexOf(name);
  }

  const missing = REQUIRED_COLUMNS.filter((name) => columnIndex[name] === -1);
  if (missing.length > 0) {
    return {
      rows: [],
      headerError: `CSV is missing required column(s): ${missing.join(
        ", "
      )}. Expected header: city,neighborhood,date,time,producer,venue,capacity`,
      unmatchedProducers: [],
    };
  }

  const dataRows = table.slice(1);

  const [usersRaw, existingShowsRaw] = await Promise.all([
    sql`select id, name from users`,
    sql`select city, venue, to_char(show_date, 'YYYY-MM-DD') as show_date, to_char(show_time, 'HH24:MI') as show_time from shows`,
  ]);
  const users = usersRaw as unknown as { id: number; name: string }[];
  const existingShows = existingShowsRaw as unknown as {
    city: string;
    venue: string;
    show_date: string;
    show_time: string;
  }[];

  const producerMap = new Map<string, number>();
  for (const u of users) {
    producerMap.set(u.name.trim().toLowerCase(), u.id);
  }

  const existingKeys = new Set(
    existingShows.map((s) => normalizeKey(s.city, s.venue, s.show_date, s.show_time))
  );

  const seenInFile = new Set<string>();
  const unmatchedProducers = new Set<string>();

  const rows: ParsedRow[] = dataRows.map((cells, i) => {
    const errors: string[] = [];
    const city = (cells[columnIndex.city] ?? "").trim();
    const neighborhood =
      columnIndex.neighborhood >= 0 ? (cells[columnIndex.neighborhood] ?? "").trim() : "";
    const showDate = (cells[columnIndex.date] ?? "").trim();
    const showTime = (cells[columnIndex.time] ?? "").trim();
    const venue = (cells[columnIndex.venue] ?? "").trim();
    const capacityRaw =
      columnIndex.capacity >= 0 ? (cells[columnIndex.capacity] ?? "").trim() : "";
    const producerName =
      columnIndex.producer >= 0 ? (cells[columnIndex.producer] ?? "").trim() : "";

    if (!city) errors.push("Missing city");
    if (!venue) errors.push("Missing venue");
    if (!DATE_RE.test(showDate)) errors.push("Invalid date (expected YYYY-MM-DD)");
    if (!TIME_RE.test(showTime)) errors.push("Invalid time (expected HH:MM, 24-hour)");

    let capacity: number | null = null;
    if (capacityRaw) {
      const n = Number(capacityRaw);
      if (!Number.isInteger(n) || n < 0) {
        errors.push("Invalid capacity");
      } else {
        capacity = n;
      }
    }

    let producerId: number | null = null;
    if (producerName) {
      const match = producerMap.get(producerName.toLowerCase());
      if (match) {
        producerId = match;
      } else {
        unmatchedProducers.add(producerName);
      }
    }

    const key = normalizeKey(city, venue, showDate, showTime);
    const duplicateInDb = errors.length === 0 && existingKeys.has(key);
    const duplicateInFile = errors.length === 0 && seenInFile.has(key);
    if (errors.length === 0) seenInFile.add(key);

    return {
      line: i + 2,
      city,
      neighborhood: neighborhood || null,
      showDate,
      showTime,
      venue,
      capacity,
      producerName,
      producerId,
      errors,
      duplicateInFile,
      duplicateInDb,
    };
  });

  return {
    rows,
    headerError: null,
    unmatchedProducers: Array.from(unmatchedProducers).sort(),
  };
}
