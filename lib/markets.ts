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
 * The canonical list entry for free-typed input ("austin", "Austin, TX",
 * " Austin,tx "), or null if it isn't one of the listed cities.
 */
export function matchHomeMarket(input: string): string | null {
  return BY_CITY.get(cityPart(input)) ?? null;
}
