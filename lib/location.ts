/** Compares only the city segment of a "City, ST" style location, case-insensitively. */
export function cityPart(location: string): string {
  return location.split(",")[0]?.trim().toLowerCase() ?? "";
}
