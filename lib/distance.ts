// Server-only: the zipcodes dataset is several MB, so keep it out of client
// bundles (lib/location and lib/markets are imported by client components).
import zipcodes from "zipcodes";
import { cityPart } from "./location";

/**
 * Places that share a postal city with a neighbor, so the zip database has no
 * entry under their own name. Maps cityPart to a zip in town.
 */
const ZIP_OVERRIDES: Record<string, string> = {
  lakeway: "78734",
  "the woodlands": "77380",
};

const zipCache = new Map<string, string | null>();

/**
 * One zip standing in for a "City, ST" location: of the city's zips, the one
 * nearest their average position, so a big city is measured from its middle
 * rather than an outlying zip. Null when the city or state isn't found.
 */
function cityZip(location: string): string | null {
  const key = location.trim().toLowerCase();
  const cached = zipCache.get(key);
  if (cached !== undefined) return cached;

  let zip: string | null = ZIP_OVERRIDES[cityPart(location)] ?? null;
  if (!zip) {
    const [city = "", state = ""] = location.split(",").map((part) => part.trim());
    const matches = city && state ? zipcodes.lookupByName(city, state) : [];
    if (matches.length > 0) {
      const lat = matches.reduce((sum, m) => sum + m.latitude, 0) / matches.length;
      const lon = matches.reduce((sum, m) => sum + m.longitude, 0) / matches.length;
      const offset = (m: (typeof matches)[number]) =>
        (m.latitude - lat) ** 2 + (m.longitude - lon) ** 2;
      zip = matches.reduce((best, m) => (offset(m) < offset(best) ? m : best)).zip;
    }
  }

  zipCache.set(key, zip);
  return zip;
}

/**
 * Straight-line miles (rounded) between two "City, ST" locations, or null when
 * either can't be found. Locations without a state can't be looked up.
 */
export function milesBetween(a: string, b: string): number | null {
  const from = cityZip(a);
  const to = cityZip(b);
  if (!from || !to) return null;
  return zipcodes.distance(from, to);
}
