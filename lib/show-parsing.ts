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
  /** How each CSV producer name was matched (empty for the add/edit forms). */
  producerMatches: ProducerMatch[];
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

export type MatchKind = "exact" | "initial" | "spelling";

/** How one name from a CSV cell was matched to a user. */
export type ProducerMatch = { input: string; name: string; how: MatchKind };

export type NameMatchResult =
  | { kind: "match"; producer: ProducerOption; how: MatchKind }
  | { kind: "ambiguous"; candidates: ProducerOption[]; sameName: boolean }
  | { kind: "unknown" };

// Lowercase, accents and punctuation removed, so "Zoë O'Brien" and
// "zoe obrien" compare equal.
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Edit distance where swapping two adjacent letters ("Tabte") counts as one. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Typos allowed, by length. Short names must match exactly: with "Al Li" and
// "Al Lu" one wrong letter is a different person, not a typo. A wrong match is
// worse than a "Unknown producer" error, which the admin can fix in seconds.
function allowedEdits(length: number): number {
  if (length <= 6) return 0;
  if (length <= 10) return 1;
  return 2;
}

// Last names are only compared when the first initial already matches, so they
// can afford a little more tolerance.
function allowedLastNameEdits(length: number): number {
  if (length <= 4) return 0;
  if (length <= 8) return 1;
  return 2;
}

// "T. Truman", "T Truman", "T.Truman" -> initial "t", last name "Truman".
const INITIAL_FORM = /^([A-Za-z])(?:\.\s*|\s+)(\S.*)$/;

/**
 * Finds the user a CSV name refers to, trying in order:
 *   1. the exact name (ignoring case, accents, punctuation)
 *   2. first initial + last name ("T. Truman" for "Tom Truman")
 *   3. a name within a typo or two of a real one ("Tom Trueman")
 * A match is only returned when exactly one user fits at that step. Two or
 * more fits are reported as ambiguous instead of guessing.
 */
export function matchProducerName(
  input: string,
  producers: ProducerOption[]
): NameMatchResult {
  const norm = normalizeName(input);
  if (!norm) return { kind: "unknown" };

  const entries = producers.map((producer) => {
    const name = normalizeName(producer.name);
    const tokens = name.split(" ");
    return {
      producer,
      name,
      initial: tokens[0]?.[0] ?? "",
      // "Mary Ann Smith" can be reached by "Smith" or "Ann Smith".
      lastNames:
        tokens.length > 1
          ? [...new Set([tokens.slice(1).join(" "), tokens[tokens.length - 1]])]
          : [],
    };
  });

  const pick = (
    found: typeof entries,
    how: MatchKind
  ): NameMatchResult | null => {
    if (found.length === 1) return { kind: "match", producer: found[0].producer, how };
    if (found.length > 1) {
      return {
        kind: "ambiguous",
        candidates: found.map((e) => e.producer),
        sameName: how === "exact",
      };
    }
    return null;
  };

  const exact = pick(entries.filter((e) => e.name === norm), "exact");
  if (exact) return exact;

  const initialForm = INITIAL_FORM.exec(input.trim());
  const initial = initialForm?.[1].toLowerCase() ?? "";
  const lastIn = initialForm ? normalizeName(initialForm[2]) : "";

  if (initialForm) {
    const byInitial = pick(
      entries.filter((e) => e.initial === initial && e.lastNames.includes(lastIn)),
      "initial"
    );
    if (byInitial) return byInitial;
  }

  // Closest name within the typo allowance, only if it is uniquely closest.
  const closest = (
    scored: { entry: (typeof entries)[number]; distance: number }[]
  ): NameMatchResult | null => {
    if (scored.length === 0) return null;
    const best = Math.min(...scored.map((x) => x.distance));
    const tied = scored.filter((x) => x.distance === best).map((x) => x.entry);
    return pick(tied, "spelling");
  };

  const fuzzyFull = closest(
    entries
      .map((entry) => ({ entry, distance: editDistance(norm, entry.name) }))
      .filter((x) => x.distance <= allowedEdits(norm.length))
  );
  if (fuzzyFull) return fuzzyFull;

  if (initialForm) {
    const fuzzyLast = closest(
      entries
        .filter((e) => e.initial === initial)
        .map((entry) => ({
          entry,
          distance: Math.min(
            ...entry.lastNames.map((ln) => editDistance(lastIn, ln)),
            Infinity
          ),
        }))
        .filter((x) => x.distance <= allowedLastNameEdits(lastIn.length))
    );
    if (fuzzyLast) return fuzzyLast;
  }

  return { kind: "unknown" };
}

function resolveProducerNames(
  names: string[],
  producers: ProducerOption[]
): {
  ids: number[];
  resolvedNames: string[];
  matches: ProducerMatch[];
  errors: string[];
} {
  const ids: number[] = [];
  const resolvedNames: string[] = [];
  const matches: ProducerMatch[] = [];
  const errors: string[] = [];

  for (const name of names) {
    const result = matchProducerName(name, producers);
    if (result.kind === "unknown") {
      errors.push(`Unknown producer: ${name}`);
    } else if (result.kind === "ambiguous") {
      errors.push(
        result.sameName
          ? `Ambiguous producer: ${name} matches more than one user`
          : `Ambiguous producer: ${name} could be ${result.candidates
              .map((c) => c.name)
              .join(" or ")}`
      );
    } else if (!ids.includes(result.producer.id)) {
      ids.push(result.producer.id);
      resolvedNames.push(result.producer.name);
      matches.push({ input: name, name: result.producer.name, how: result.how });
    }
  }
  return { ids, resolvedNames, matches, errors };
}

function resolveProducerIds(
  requested: number[],
  producers: ProducerOption[]
): {
  ids: number[];
  resolvedNames: string[];
  matches: ProducerMatch[];
  errors: string[];
} {
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
  return { ids, resolvedNames, matches: [], errors };
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
    return {
      show: null,
      producerNames: resolved.resolvedNames,
      producerMatches: resolved.matches,
      errors,
    };
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
    producerMatches: resolved.matches,
    errors,
  };
}
