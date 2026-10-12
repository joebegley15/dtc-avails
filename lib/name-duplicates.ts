// Flags names in a bulk user upload that look like someone already there, so
// an admin doesn't create a second account for the same comic. Uses the same
// matching as producer names on show upload: exact (ignoring case, accents,
// punctuation), first initial + last name, or a typo or two.
import { matchProducerName } from "./show-parsing";

export type NamedPerson = { id: number; name: string };

/** The people in `people` whose name matches `name`; [] if none. */
export function similarPeople<T extends NamedPerson>(name: string, people: T[]): T[] {
  const result = matchProducerName(name, people);
  const ids =
    result.kind === "match"
      ? new Set([result.producer.id])
      : result.kind === "ambiguous"
        ? new Set(result.candidates.map((c) => c.id))
        : null;
  return ids ? people.filter((p) => ids.has(p.id)) : [];
}

/**
 * Warnings for one new name: lookalikes among existing users, and among
 * earlier rows of the same file (`earlierRows` uses the row number as id).
 */
export function duplicateNameWarnings<T extends NamedPerson>(
  name: string,
  existing: T[],
  earlierRows: NamedPerson[],
  describeExisting: (user: T) => string
): string[] {
  const warnings = similarPeople(name, existing).map(
    (u) => `Possible duplicate of ${describeExisting(u)}`
  );
  for (const r of similarPeople(name, earlierRows)) {
    warnings.push(`Similar to row ${r.id} (${r.name})`);
  }
  return warnings;
}
