// Pure rules for comic pass levels. No database access, so tests and client
// code can use them.

export const PASS_LEVELS = ["full", "local"] as const;

/**
 * "full": any show in the TX/OK district (today's behavior).
 * "local": only shows within LOCAL_PASS_RADIUS_MILES of their home market.
 */
export type PassLevel = (typeof PASS_LEVELS)[number];

/** How far from their home market a locally passed comic may submit. */
export const LOCAL_PASS_RADIUS_MILES = 50;

export function isPassLevel(value: unknown): value is PassLevel {
  return typeof value === "string" && (PASS_LEVELS as readonly string[]).includes(value);
}

export function passLevelLabel(level: PassLevel): string {
  return level === "local" ? "Local" : "Full";
}

/**
 * A pass level typed into a CSV cell or form: "full"/"local", any case, also
 * "fully passed"/"locally passed". Blank is null (no value given).
 */
export function parsePassLevel(input: string): PassLevel | null | "bad" {
  const value = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (value === "") return null;
  if (value === "full" || value === "fully passed" || value === "fully") return "full";
  if (value === "local" || value === "locally passed" || value === "locally") return "local";
  return "bad";
}

export type Coords = { latitude: number; longitude: number };

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance in miles. */
export function haversineMiles(a: Coords, b: Coords): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Whether a comic with this pass level may see and submit to a show. Full
 * passes see everything. Local passes need coordinates for both their home
 * market and the show's city, within LOCAL_PASS_RADIUS_MILES: if either is
 * unknown the show is hidden, never guessed.
 */
export function passAllowsShow(
  level: PassLevel,
  home: Coords | null | undefined,
  show: Coords | null | undefined
): boolean {
  if (level === "full") return true;
  if (!home || !show) return false;
  return haversineMiles(home, show) <= LOCAL_PASS_RADIUS_MILES;
}
