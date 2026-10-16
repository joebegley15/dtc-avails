/** Compares only the city segment of a "City, ST" style location, case-insensitively. */
export function cityPart(location: string): string {
  return location.split(",")[0]?.trim().toLowerCase() ?? "";
}

/**
 * Approximate city-center coordinates, keyed by cityPart. Covers every home
 * market and show city: add to this when a new city gets shows, or distance
 * checks treat it as unknown.
 */
const CITY_COORDS: Record<string, [lat: number, lon: number]> = {
  amarillo: [35.222, -101.831],
  arlington: [32.736, -97.108],
  austin: [30.267, -97.743],
  belton: [31.056, -97.464],
  "broken arrow": [36.053, -95.791],
  brownsville: [25.901, -97.497],
  bryan: [30.674, -96.37],
  "college station": [30.628, -96.334],
  conroe: [30.312, -95.456],
  "copperas cove": [31.124, -97.903],
  "corpus christi": [27.8, -97.396],
  dallas: [32.777, -96.797],
  denton: [33.215, -97.133],
  "el paso": [31.762, -106.485],
  "fort worth": [32.755, -97.331],
  frisco: [33.151, -96.824],
  galveston: [29.301, -94.798],
  garland: [32.913, -96.639],
  georgetown: [30.633, -97.678],
  "grand prairie": [32.746, -96.998],
  houston: [29.76, -95.37],
  irving: [32.814, -96.949],
  jarrell: [30.825, -97.604],
  katy: [29.786, -95.824],
  killeen: [31.117, -97.728],
  kingwood: [30.05, -95.184],
  lakeway: [30.364, -97.98],
  laredo: [27.506, -99.507],
  lewisville: [33.046, -96.994],
  lubbock: [33.578, -101.855],
  mckinney: [33.198, -96.615],
  "new braunfels": [29.703, -98.125],
  norman: [35.222, -97.439],
  "oklahoma city": [35.468, -97.516],
  pasadena: [29.691, -95.209],
  pearland: [29.564, -95.286],
  plano: [33.02, -96.699],
  richardson: [32.948, -96.73],
  "round rock": [30.508, -97.679],
  "san antonio": [29.424, -98.494],
  "san marcos": [29.883, -97.941],
  spring: [30.08, -95.417],
  stafford: [29.616, -95.558],
  "sugar land": [29.62, -95.635],
  temple: [31.098, -97.343],
  "the woodlands": [30.166, -95.461],
  tulsa: [36.154, -95.993],
  waco: [31.549, -97.147],
  webster: [29.538, -95.118],
};

/**
 * Straight-line miles between two "City, ST" locations, or null when either
 * city isn't in CITY_COORDS.
 */
export function milesBetween(a: string, b: string): number | null {
  const from = CITY_COORDS[cityPart(a)];
  const to = CITY_COORDS[cityPart(b)];
  if (!from || !to) return null;

  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to[0] - from[0]);
  const dLon = rad(to[1] - from[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from[0])) * Math.cos(rad(to[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}
