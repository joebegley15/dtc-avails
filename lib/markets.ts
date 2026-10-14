import { cityPart } from "./location";

/**
 * Home markets a comedian can pick: the 20 most populous cities in Texas
 * plus the Oklahoma cities over 100k (2020 census), alphabetical. Stored in
 * the same "City, ST" form as shows.city, so the travel check (which compares
 * city parts) lines up.
 */
export const HOME_MARKETS = [
  "Amarillo, TX",
  "Arlington, TX",
  "Austin, TX",
  "Broken Arrow, OK",
  "Brownsville, TX",
  "Corpus Christi, TX",
  "Dallas, TX",
  "Denton, TX",
  "El Paso, TX",
  "Fort Worth, TX",
  "Frisco, TX",
  "Garland, TX",
  "Grand Prairie, TX",
  "Houston, TX",
  "Irving, TX",
  "Killeen, TX",
  "Laredo, TX",
  "Lubbock, TX",
  "McKinney, TX",
  "Norman, OK",
  "Oklahoma City, OK",
  "Plano, TX",
  "San Antonio, TX",
  "Tulsa, OK",
] as const;

const BY_CITY = new Map(HOME_MARKETS.map((m) => [cityPart(m), m]));

/**
 * Show cities that aren't home markets, so formatCity can supply their state.
 * Add to this when a new city gets shows.
 */
const OTHER_SHOW_CITIES = [
  "Belton, TX",
  "Conroe, TX",
  "Katy, TX",
  "Richardson, TX",
  "Round Rock, TX",
  "San Marcos, TX",
  "Sugar Land, TX",
  "Waco, TX",
];
const OTHER_BY_CITY = new Map(OTHER_SHOW_CITIES.map((c) => [cityPart(c), c]));

/**
 * The canonical list entry for free-typed input ("austin", "Austin, TX",
 * " Austin,tx "), or null if it isn't one of the listed cities.
 */
export function matchHomeMarket(input: string): string | null {
  return BY_CITY.get(cityPart(input)) ?? null;
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * A show city in "City, ST" form: "austin" and " austin,tx " both become
 * "Austin, TX". A city with no state that isn't in either list takes the
 * state from `known` (other spellings of the same city), else stays city-only.
 */
export function formatCity(raw: string, known: readonly string[] = []): string {
  const listed = matchHomeMarket(raw) ?? OTHER_BY_CITY.get(cityPart(raw));
  if (listed) return listed;

  const [cityRaw = "", stateRaw = ""] = raw.split(",").map((part) => part.trim());
  const city = titleCase(cityRaw);
  const state =
    stateRaw.toUpperCase() ||
    known
      .find((k) => k.includes(",") && cityPart(k) === cityPart(raw))
      ?.split(",")[1]
      ?.trim()
      .toUpperCase();
  return state ? `${city}, ${state}` : city;
}
