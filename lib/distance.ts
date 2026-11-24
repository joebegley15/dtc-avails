// Server-only, like lib/cities, which it measures from.
import zipcodes from "zipcodes";
import { cityZip } from "./cities";

/**
 * Straight-line miles (rounded) between two "City, ST" locations, or null when
 * either isn't a known US city.
 */
export function milesBetween(a: string, b: string): number | null {
  const from = cityZip(a);
  const to = cityZip(b);
  if (!from || !to) return null;
  return zipcodes.distance(from, to);
}
