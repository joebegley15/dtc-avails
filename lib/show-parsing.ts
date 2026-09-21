// Pure parsing and validation for show data. Shared by bulk upload, add show,
// and edit show. No database access here, so it is safe to import anywhere.

export type ProducerOption = { id: number; name: string };

export type ShowInput = {
  city: string;
  neighborhood: string;
  date: string;
  time: string;
  venue: string;
  capacity: string;
  /** Names from a CSV cell (already split), matched against `producers`. */
  producerNames?: string[];
  /** IDs from the multi-select, checked against `producers`. */
  producerIds?: number[];
};

export type ParsedShow = {
  city: string;
  neighborhood: string | null;
  showDate: string; // YYYY-MM-DD
  showTime: string; // HH:MM, 24-hour
  venue: string;
  capacity: number | null;
  producerIds: number[];
};

export type ShowValidation = {
  show: ParsedShow | null;
  producerNames: string[];
  errors: string[];
};

const MAX_CAPACITY = 2_000_000_000; // stays inside a Postgres integer

/** Accepts YYYY-MM-DD or M/D/YYYY; returns YYYY-MM-DD, or null if not a real date. */
export function parseDate(input: string): string | null {
  const value = input.trim();
  let year: number, month: number, day: number;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (m) {
    [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value))) {
    [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    return null;
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Accepts "20:00" (24-hour, two-digit hour), "8:00 PM", or "8 PM"
 * (case-insensitive, space optional). Returns HH:MM, or null.
 * A bare "8:00" is rejected: without AM/PM it is ambiguous.
 */
export function parseTime(input: string): string | null {
  const value = input.trim();

  let m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (m) return `${m[1]}:${m[2]}`;

  m = /^(\d{1,2})(?::([0-5]\d))?\s*(am|pm)$/i.exec(value);
  if (!m) return null;
  const hour12 = Number(m[1]);
  if (hour12 < 1 || hour12 > 12) return null;
  const isPm = m[3].toLowerCase() === "pm";
  const hour24 = (hour12 % 12) + (isPm ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${m[2] ?? "00"}`;
}

/** Empty is valid and means null. Otherwise a non-negative whole number. */
export function parseCapacity(
  input: string
): { ok: true; value: number | null } | { ok: false } {
  const value = input.trim();
  if (value === "") return { ok: true, value: null };
  if (!/^\d+$/.test(value)) return { ok: false };
  const n = Number(value);
  return n <= MAX_CAPACITY ? { ok: true, value: n } : { ok: false };
}

/** Splits a CSV producer cell on ";", trimming and dropping empties. */
export function splitProducerNames(input: string): string[] {
  return input
    .split(";")
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/** Identity for duplicate detection: same date, time, and venue. */
export function showKey(date: string, time: string, venue: string): string {
  return [date, time, venue.trim().toLowerCase()].join("|");
}

function resolveProducerNames(
  names: string[],
  producers: ProducerOption[]
): { ids: number[]; resolvedNames: string[]; errors: string[] } {
  const byName = new Map<string, ProducerOption[]>();
  for (const p of producers) {
    const key = p.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), p]);
  }

  const ids: number[] = [];
  const resolvedNames: string[] = [];
  const errors: string[] = [];
  for (const name of names) {
    const matches = byName.get(name.toLowerCase()) ?? [];
    if (matches.length === 0) {
      errors.push(`Unknown producer: ${name}`);
    } else if (matches.length > 1) {
      errors.push(`Ambiguous producer: ${name} matches more than one user`);
    } else if (!ids.includes(matches[0].id)) {
      ids.push(matches[0].id);
      resolvedNames.push(matches[0].name);
    }
  }
  return { ids, resolvedNames, errors };
}

function resolveProducerIds(
  requested: number[],
  producers: ProducerOption[]
): { ids: number[]; resolvedNames: string[]; errors: string[] } {
  const byId = new Map(producers.map((p) => [p.id, p]));
  const ids: number[] = [];
  const resolvedNames: string[] = [];
  const errors: string[] = [];
  for (const id of requested) {
    const match = byId.get(id);
    if (!match) {
      errors.push(`Unknown producer (id ${id})`);
    } else if (!ids.includes(id)) {
      ids.push(id);
      resolvedNames.push(match.name);
    }
  }
  return { ids, resolvedNames, errors };
}

/**
 * The one validation rule set for a show. `producers` is the list of users
 * with role producer or admin. Returns `show` only when there are no errors.
 */
export function validateShowInput(
  input: ShowInput,
  producers: ProducerOption[]
): ShowValidation {
  const errors: string[] = [];

  const city = input.city.trim();
  const neighborhood = input.neighborhood.trim();
  const venue = input.venue.trim();
  const dateRaw = input.date.trim();
  const timeRaw = input.time.trim();

  if (!city) errors.push("Missing city");
  if (!venue) errors.push("Missing venue");

  let showDate: string | null = null;
  if (!dateRaw) {
    errors.push("Missing date");
  } else {
    showDate = parseDate(dateRaw);
    if (!showDate) errors.push(`Bad date: ${dateRaw}`);
  }

  let showTime: string | null = null;
  if (!timeRaw) {
    errors.push("Missing time");
  } else {
    showTime = parseTime(timeRaw);
    if (!showTime) errors.push(`Bad time: ${timeRaw}`);
  }

  const capacity = parseCapacity(input.capacity);
  if (!capacity.ok) errors.push(`Bad capacity: ${input.capacity.trim()}`);

  const requested = input.producerNames ?? [];
  const resolved = input.producerIds
    ? resolveProducerIds(input.producerIds, producers)
    : resolveProducerNames(requested, producers);
  const hasProducerInput = input.producerIds
    ? input.producerIds.length > 0
    : requested.length > 0;
  if (!hasProducerInput) errors.push("Missing producer");
  errors.push(...resolved.errors);

  if (errors.length > 0 || !showDate || !showTime || !capacity.ok) {
    return { show: null, producerNames: resolved.resolvedNames, errors };
  }

  return {
    show: {
      city,
      neighborhood: neighborhood || null,
      showDate,
      showTime,
      venue,
      capacity: capacity.value,
      producerIds: resolved.ids,
    },
    producerNames: resolved.resolvedNames,
    errors,
  };
}
