// Pure logic for the read-only booker views: filters, sorting, run planning,
// and CSV export. No database access, so tests can use it directly.
import { HOME_MARKETS } from "./markets";
import { haversineMiles, LOCAL_PASS_RADIUS_MILES, type Coords } from "./pass-level";

/**
 * What a booker sees for a show. Deliberately no applicant data and no
 * contact details for anyone: producers appear by name only.
 */
export type BookerShow = {
  id: number;
  city: string;
  neighborhood: string | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  venue: string;
  capacity: number | null;
  producerNames: string[];
};

export type BookerFilters = {
  /** An exact show city ("Katy, TX"), or "" for any. */
  city: string;
  /** A home market; matches shows within MARKET_RADIUS_MILES. "" for any. */
  market: string;
  /** Inclusive YYYY-MM-DD bounds, or "". */
  from: string;
  to: string;
  sort: "asc" | "desc";
};

/** A market filter takes in shows this close to the market city. */
export const MARKET_RADIUS_MILES = LOCAL_PASS_RADIUS_MILES;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function one(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Filters from the URL. Anything unrecognized is ignored, never trusted. */
export function parseBookerFilters(
  params: Record<string, string | string[] | undefined>,
  knownCities: readonly string[]
): BookerFilters {
  const city = one(params.city);
  const market = one(params.market);
  const from = one(params.from);
  const to = one(params.to);
  return {
    city: knownCities.includes(city) ? city : "",
    market: (HOME_MARKETS as readonly string[]).includes(market) ? market : "",
    from: isDate(from) ? from : "",
    to: isDate(to) ? to : "",
    sort: one(params.sort) === "desc" ? "desc" : "asc",
  };
}

/** Query string for links that keep the current filters. */
export function bookerQuery(filters: BookerFilters, overrides: Partial<BookerFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const key of ["city", "market", "from", "to"] as const) {
    if (merged[key]) params.set(key, merged[key]);
  }
  if (merged.sort === "desc") params.set("sort", "desc");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * Applies the filters. `coords` (keyed by lowercase city) is only needed for
 * a market filter: a show whose city has no coordinates never matches one.
 */
export function filterBookerShows(
  shows: BookerShow[],
  filters: BookerFilters,
  coords: Map<string, Coords> = new Map()
): BookerShow[] {
  const marketAt = filters.market ? coords.get(filters.market.toLowerCase()) : undefined;
  const filtered = shows.filter((s) => {
    if (filters.city && s.city !== filters.city) return false;
    if (filters.from && s.date < filters.from) return false;
    if (filters.to && s.date > filters.to) return false;
    if (filters.market) {
      const at = coords.get(s.city.trim().toLowerCase());
      if (!marketAt || !at || haversineMiles(marketAt, at) > MARKET_RADIUS_MILES) return false;
    }
    return true;
  });
  const dir = filters.sort === "desc" ? -1 : 1;
  return filtered.sort(
    (a, b) =>
      dir * (a.date.localeCompare(b.date) || a.time.localeCompare(b.time)) || a.id - b.id
  );
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type RunCity = {
  city: string;
  shows: BookerShow[];
  /** This city also has shows the night before or after. */
  consecutive: boolean;
};

export type RunDay = { date: string; cities: RunCity[] };

/** A stretch of consecutive nights that each have at least one show. */
export type Run = { start: string; end: string; nights: number; days: RunDay[] };

/**
 * Groups shows by date, then city, and splits the dates into runs of
 * consecutive nights, so a booker can chain cities night after night.
 */
export function planRuns(shows: BookerShow[]): Run[] {
  const byDate = new Map<string, Map<string, BookerShow[]>>();
  for (const s of shows) {
    const cities = byDate.get(s.date) ?? new Map<string, BookerShow[]>();
    cities.set(s.city, [...(cities.get(s.city) ?? []), s]);
    byDate.set(s.date, cities);
  }
  const dates = [...byDate.keys()].sort();
  const has = (date: string, city: string) => byDate.get(date)?.has(city) ?? false;
  const prevDay = (date: string) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  const runs: Run[] = [];
  for (const date of dates) {
    const cities = [...byDate.get(date)!.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([city, list]) => ({
        city,
        shows: [...list].sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id),
        consecutive: has(prevDay(date), city) || has(nextDay(date), city),
      }));
    const day = { date, cities };
    const last = runs[runs.length - 1];
    if (last && nextDay(last.end) === date) {
      last.days.push(day);
      last.end = date;
      last.nights += 1;
    } else {
      runs.push({ start: date, end: date, nights: 1, days: [day] });
    }
  }
  return runs;
}

// A cell starting with = + - @ can run as a formula when the file is opened
// in a spreadsheet, so neutralize it.
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const BOOKER_CSV_HEADERS = [
  "Date",
  "Time",
  "City",
  "Neighborhood",
  "Venue",
  "Capacity",
  "Producers",
] as const;

/** The filtered show list as CSV (no contact details). */
export function bookerShowsCsv(shows: BookerShow[]): string {
  const lines = [BOOKER_CSV_HEADERS.join(",")];
  for (const s of shows) {
    lines.push(
      [
        s.date,
        s.time,
        s.city,
        s.neighborhood ?? "",
        s.venue,
        s.capacity === null ? "" : String(s.capacity),
        s.producerNames.join("; "),
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
