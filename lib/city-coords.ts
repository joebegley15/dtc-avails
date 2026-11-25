// Server-side access to the cities lookup table: latitude/longitude for each
// home market and show city, used for the local-pass distance check. Import
// from server code only.
//
// Rows are filled from the bundled zip data (lib/cities, no network call) by
// the migration and whenever shows are saved, and by hand on /admin/cities
// for places the zip data doesn't know.
import { sql } from "./db";
import { cityCoordinates } from "./cities";
import type { Coords } from "./pass-level";

/** Lookup key: the stored "City, ST" text, trimmed and lowercased. */
export function cityKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Coordinates for the given names, keyed by cityKey(). Unknown names are absent. */
export async function loadCityCoords(names: string[]): Promise<Map<string, Coords>> {
  const keys = [...new Set(names.filter(Boolean).map(cityKey))];
  if (keys.length === 0) return new Map();
  const rows = (await sql`
    select lower(name) as key, latitude, longitude
    from cities
    where lower(name) = any(${keys}::text[])
  `) as { key: string; latitude: number; longitude: number }[];
  return new Map(rows.map((r) => [r.key, { latitude: r.latitude, longitude: r.longitude }]));
}

/**
 * Cities with no coordinates in the table that the zip data can't supply
 * either. Read-only: for warning the admin before an import.
 */
export async function citiesMissingCoords(names: string[]): Promise<string[]> {
  const unique = [...new Map(names.filter(Boolean).map((n) => [cityKey(n), n.trim()])).values()];
  const known = await loadCityCoords(unique);
  return unique
    .filter((n) => !known.has(cityKey(n)) && !cityCoordinates(n))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Adds rows for cities the table doesn't have yet but the zip data knows.
 * Returns the ones still missing coordinates.
 */
export async function ensureCityCoords(names: string[]): Promise<string[]> {
  const unique = [...new Map(names.filter(Boolean).map((n) => [cityKey(n), n.trim()])).values()];
  const known = await loadCityCoords(unique);
  const toAdd: { name: string; latitude: number; longitude: number }[] = [];
  const missing: string[] = [];
  for (const name of unique) {
    if (known.has(cityKey(name))) continue;
    const found = cityCoordinates(name);
    if (found) toAdd.push({ name, latitude: found.latitude, longitude: found.longitude });
    else missing.push(name);
  }
  if (toAdd.length > 0) {
    await sql`
      insert into cities (name, latitude, longitude)
      select * from unnest(
        ${toAdd.map((c) => c.name)}::text[],
        ${toAdd.map((c) => c.latitude)}::double precision[],
        ${toAdd.map((c) => c.longitude)}::double precision[]
      )
      on conflict do nothing
    `;
  }
  return missing.sort((a, b) => a.localeCompare(b));
}
