// Server-only: every US city in the zipcodes package, for home market search
// and validation, and the zip that distance checks measure each city from.
// The dataset is several MB, so client code reaches it through /api/cities.
import zipcodes, { type ZipCode } from "zipcodes";
import { HOME_MARKETS, matchHomeMarket } from "./markets";

type City = {
  /** "McKinney, TX": how it's shown and stored. */
  label: string;
  /** Normalized city name, for matching (see cityKey). */
  key: string;
  state: string;
  /** Number of zips, a stand-in for size when ranking search results. */
  size: number;
  /** The zip nearest the middle of the city's zips. */
  zip: string;
  /** The middle of the city's zips. */
  latitude: number;
  longitude: number;
};

/**
 * Places that share a postal city with a neighbor, so the zip data has no
 * entry under their own name. Each gets a zip in town.
 */
const EXTRA_CITIES: { name: string; state: string; zip: string }[] = [
  { name: "Lakeway", state: "TX", zip: "78734" },
  { name: "The Woodlands", state: "TX", zip: "77380" },
];

// Military mail "states", not places.
const SKIP_STATES = new Set(["AA", "AE", "AP"]);

// Where nearly every user is based: these rank first in search and win when
// a city is given without a state.
const HOME_STATES = new Set(["TX", "OK"]);

/**
 * "St. Jo", "Saint Jo" and "saint-jo" all become "saintjo"; "Mc Gregor" and
 * "McGregor" both become "mcgregor".
 */
function cityKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bst\b\.?/g, "saint")
    .replace(/\bft\b\.?/g, "fort")
    .replace(/\bmt\b\.?/g, "mount")
    .replace(/[^a-z0-9]/g, "");
}

/** USPS style to everyday spelling: "Mckinney" -> "McKinney", "Mc Gregor" -> "McGregor". */
function displayName(name: string): string {
  return name
    .replace(/\bMc\s+/g, "Mc")
    .replace(/\bMc([a-z])/g, (_, c: string) => `Mc${c.toUpperCase()}`);
}

let index: { byKey: Map<string, City>; all: City[] } | null = null;

function cities() {
  if (index) return index;

  const groups = new Map<string, ZipCode[]>();
  for (const z of Object.values(zipcodes.codes)) {
    if (z.country !== "US" || SKIP_STATES.has(z.state)) continue;
    const id = `${cityKey(z.city)}|${z.state}`;
    const group = groups.get(id);
    if (group) group.push(z);
    else groups.set(id, [z]);
  }

  const byKey = new Map<string, City>();
  for (const [id, zips] of groups) {
    const lat = zips.reduce((sum, z) => sum + z.latitude, 0) / zips.length;
    const lon = zips.reduce((sum, z) => sum + z.longitude, 0) / zips.length;
    const offset = (z: ZipCode) => (z.latitude - lat) ** 2 + (z.longitude - lon) ** 2;
    const middle = zips.reduce((best, z) => (offset(z) < offset(best) ? z : best));
    const { state } = zips[0];
    byKey.set(id, {
      label: `${displayName(zips[0].city)}, ${state}`,
      key: id.split("|")[0],
      state,
      size: zips.length,
      zip: middle.zip,
      latitude: lat,
      longitude: lon,
    });
  }
  for (const { name, state, zip } of EXTRA_CITIES) {
    const key = cityKey(name);
    // Sized like a mid-size suburb, since they have no zip count of their own.
    const at = zipcodes.lookup(zip);
    byKey.set(`${key}|${state}`, {
      label: `${name}, ${state}`,
      key,
      state,
      size: 5,
      zip,
      latitude: at?.latitude ?? 0,
      longitude: at?.longitude ?? 0,
    });
  }

  index = { byKey, all: [...byKey.values()] };
  return index;
}

/** "TX" or "Texas" to "TX"; null if it isn't a state. */
function stateCode(input: string): string | null {
  const code = zipcodes.states.normalize(input.trim().replace(/\./g, ""));
  return code && zipcodes.states.abbr[code] ? code : null;
}

function findCity(input: string): City | null {
  const comma = input.lastIndexOf(",");
  const name = comma === -1 ? input : input.slice(0, comma);
  const key = cityKey(name);
  if (!key) return null;
  const { byKey } = cities();

  if (comma !== -1) {
    const state = stateCode(input.slice(comma + 1));
    return state ? (byKey.get(`${key}|${state}`) ?? null) : null;
  }

  // No state ("Austin", from older data or a CSV): a listed home market,
  // else that city in Texas or Oklahoma.
  const listed = matchHomeMarket(name);
  if (listed) return findCity(listed);
  for (const state of HOME_STATES) {
    const city = byKey.get(`${key}|${state}`);
    if (city) return city;
  }
  return null;
}

/**
 * The canonical "City, ST" for free-typed input ("austin, texas",
 * " McKinney,tx "), or null when it isn't a US city.
 */
export function matchCity(input: string): string | null {
  return findCity(input)?.label ?? null;
}

/** The zip distance checks measure a "City, ST" location from, or null. */
export function cityZip(location: string): string | null {
  return findCity(location)?.zip ?? null;
}

/**
 * Where a "City, ST" location is, from the bundled zip data (no network
 * call), or null when it isn't a known US city. Used to fill the cities
 * table; request-time distance checks for local passes read that table.
 */
export function cityCoordinates(
  location: string
): { label: string; latitude: number; longitude: number } | null {
  const city = findCity(location);
  return city
    ? { label: city.label, latitude: city.latitude, longitude: city.longitude }
    : null;
}

/**
 * Cities for a search box. Matches the start of the city name or of any word
 * in it ("woodl" finds The Woodlands); a comma narrows by state ("spring, t").
 * Exact names rank first, then bigger cities, with Texas and Oklahoma
 * weighted up. An empty
 * query gives the listed home markets.
 */
export function searchCities(query: string, limit = 8): string[] {
  const comma = query.indexOf(",");
  const namePart = comma === -1 ? query : query.slice(0, comma);
  const statePart = comma === -1 ? "" : query.slice(comma + 1).trim().toUpperCase();
  const key = cityKey(namePart);
  if (!key) return [...HOME_MARKETS];

  const words = namePart.trim().toLowerCase().split(/\s+/).length;
  const matches: { city: City; score: number }[] = [];
  for (const city of cities().all) {
    if (statePart && !city.state.startsWith(statePart.slice(0, 2))) continue;
    const exact = city.key === key;
    if (!exact && !city.key.startsWith(key) && !(words === 1 && wordStarts(city.label, key))) {
      continue;
    }
    // Exact names first, then by size, with home states counting 4x.
    const weight = city.size * (HOME_STATES.has(city.state) ? 4 : 1);
    matches.push({ city, score: (exact ? 1e6 : 0) + weight });
  }

  matches.sort((a, b) => b.score - a.score || a.city.label.localeCompare(b.city.label));
  return matches.slice(0, limit).map((m) => m.city.label);
}

function wordStarts(label: string, key: string): boolean {
  const name = label.slice(0, label.lastIndexOf(","));
  return name.split(/[\s-]+/).some((word) => cityKey(word).startsWith(key));
}
