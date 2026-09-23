// Pure planning and validation for the bulk link-user upload. No database
// access: callers pass in the existing users to match against.

export const LINK_CSV_FIELDS = ["name", "home_market", "all_star"] as const;

export type LinkCsvRow = Record<(typeof LINK_CSV_FIELDS)[number], string>;

export type ExistingLinkUser = {
  id: number;
  name: string;
  role: "admin" | "producer" | "comic";
  access_token: string | null;
};

export type PlannedLinkUser = {
  name: string;
  homeMarket: string;
  allStar: boolean;
};

export type LinkRowPlan = {
  /** 1-based position among the CSV's data rows. */
  row: number;
  raw: LinkCsvRow;
  action: "add" | "existing" | null;
  user: PlannedLinkUser | null;
  /** Set when action is "existing": the matched user's id. */
  existingId: number | null;
  errors: string[];
};

export const DEFAULT_HOME_MARKET = "Austin, TX";

const TRUE_VALUES = new Set(["true", "yes", "y", "1", "x", "star", "★"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0"]);

function parseAllStar(value: string): boolean | "bad" {
  const v = value.trim().toLowerCase();
  if (v === "") return false;
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return "bad";
}

/**
 * Decides, for every CSV row, whether it creates a new comic, reuses an
 * existing one's link, or is an error.
 *
 * Rules:
 *  - Blank names are errors.
 *  - A name that case-insensitively matches an existing user is "existing":
 *    that user keeps their current token, nothing about them changes here.
 *  - A name matching more than one existing user is an error: never guess
 *    which one was meant.
 *  - A name matching an existing admin or producer is an error: this upload
 *    is for comics, and a link is a standing way to sign in as that account,
 *    so it must never attach to one silently.
 *  - A name repeated within the file is an error on every row after the
 *    first.
 */
export function planLinkUsers(
  rows: LinkCsvRow[],
  existing: ExistingLinkUser[]
): LinkRowPlan[] {
  const byName = new Map<string, ExistingLinkUser[]>();
  for (const u of existing) {
    const key = u.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), u]);
  }
  const seenInFile = new Map<string, number>();

  return rows.map((raw, i) => {
    const row = i + 1;
    const errors: string[] = [];
    const name = raw.name.trim();
    const key = name.toLowerCase();

    if (!name) errors.push("Missing name");

    const allStar = parseAllStar(raw.all_star);
    if (allStar === "bad") {
      errors.push(`Bad all-star value: ${raw.all_star.trim()}`);
    }

    if (name) {
      const earlier = seenInFile.get(key);
      if (earlier !== undefined) {
        errors.push(`Duplicate name in this file (also row ${earlier})`);
      } else {
        seenInFile.set(key, row);
      }
    }

    const matches = name ? (byName.get(key) ?? []) : [];
    let existingId: number | null = null;
    if (matches.length > 1) {
      errors.push("Ambiguous name: matches more than one existing user");
    } else if (matches.length === 1) {
      const match = matches[0];
      if (match.role !== "comic") {
        errors.push(`That name belongs to a ${match.role}. Links are for comics only.`);
      } else {
        existingId = match.id;
      }
    }

    if (errors.length > 0) {
      return { row, raw, action: null, user: null, existingId, errors };
    }

    const user: PlannedLinkUser = {
      name,
      homeMarket: raw.home_market.trim() || DEFAULT_HOME_MARKET,
      allStar: allStar === "bad" ? false : allStar,
    };

    return {
      row,
      raw,
      action: existingId !== null ? "existing" : "add",
      user,
      existingId,
      errors,
    };
  });
}
