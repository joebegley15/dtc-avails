// Pure planning and validation for the bulk user import. No database access:
// callers pass in the existing users.
import { matchCity } from "./cities";
import { duplicateNameWarnings, type NamedPerson } from "./name-duplicates";
import { parsePassLevel, type PassLevel } from "./pass-level";
import type { Role } from "./roles";

export const USER_CSV_FIELDS = [
  "name",
  "email",
  "role",
  "home_market",
  "is_all_star",
  "pass_level",
] as const;

// Spreadsheet headers people actually type.
const HEADER_ALIASES: Record<string, string> = {
  "home market": "home_market",
  homemarket: "home_market",
  market: "home_market",
  "all-star": "is_all_star",
  "all star": "is_all_star",
  allstar: "is_all_star",
  all_star: "is_all_star",
  "is all star": "is_all_star",
  star: "is_all_star",
  "pass level": "pass_level",
  passlevel: "pass_level",
  pass: "pass_level",
};

/** Header matching ignores case and surrounding whitespace. */
export function normalizeUserHeader(header: string): string {
  const h = header.trim().toLowerCase();
  return HEADER_ALIASES[h] ?? h;
}

export type UserCsvRow = Record<(typeof USER_CSV_FIELDS)[number], string>;

export type ExistingUser = {
  id: number;
  name: string;
  // Link-based comics have no email; they can never be matched by one here.
  email: string | null;
  role: Role;
};

/**
 * Roles the import can create. Bookers are added by admins only, and this
 * import is admin-only. Lead Producers are promoted from producers on
 * /admin/users, and admins are added one at a time.
 */
export type ImportRole = "comic" | "producer" | "booker";
const IMPORT_ROLES: readonly string[] = ["comic", "producer", "booker"];

export type PlannedUser = {
  name: string;
  email: string;
  role: ImportRole;
  /** null = leave an existing user's value alone (blank cell). */
  homeMarket: string | null;
  /** null = leave an existing user's value alone (blank cell). */
  isAllStar: boolean | null;
  /**
   * Comics only. null = blank cell: new comics start "full", existing
   * users keep theirs.
   */
  passLevel: PassLevel | null;
};

export type UserRowPlan = {
  /** 1-based position among the CSV's data rows. */
  row: number;
  raw: UserCsvRow;
  action: "add" | "update" | null;
  user: PlannedUser | null;
  existingId: number | null;
  errors: string[];
  /** Possible duplicate names. Shown to the admin; they don't block import. */
  warnings: string[];
};

export const ADMIN_ROW_ERROR = "Add admins one at a time in /admin/users.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRUE_VALUES = new Set(["true", "yes", "y", "1", "x", "star", "★"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0"]);

function parseAllStar(value: string): boolean | null | "bad" {
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return "bad";
}

/**
 * Decides, for every CSV row, whether it adds a user, updates an existing one,
 * or is an error.
 *
 * Rules:
 *  - An email that already exists is an update: name, home market, and
 *    all-star only. Password and role are never touched.
 *  - Rows with role admin are errors, and so are rows that would touch an
 *    existing admin.
 *  - A new user whose name looks like an existing user's, or like an earlier
 *    row's, gets a warning. Two people can share a name, so it doesn't block.
 */
export function planUserImport(
  rows: UserCsvRow[],
  existing: ExistingUser[]
): UserRowPlan[] {
  // Link-based comics (null email) can never be matched by an email-based
  // CSV row, so they're simply left out of this lookup.
  const existingByEmail = new Map(
    existing.flatMap((u) => (u.email ? [[u.email.toLowerCase(), u] as const] : []))
  );
  const firstRowForEmail = new Map<string, number>();
  const earlierNames: NamedPerson[] = [];

  return rows.map((raw, i) => {
    const row = i + 1;
    const errors: string[] = [];

    const name = raw.name.trim();
    const email = raw.email.trim().toLowerCase();
    const roleRaw = raw.role.trim().toLowerCase();
    const passLevel = parsePassLevel(raw.pass_level);
    const homeMarket = raw.home_market.trim();
    const allStar = parseAllStar(raw.is_all_star);

    if (!name) errors.push("Missing name");
    if (!email) {
      errors.push("Missing email");
    } else if (!EMAIL_RE.test(email)) {
      errors.push(`Bad email: ${raw.email.trim()}`);
    }

    let role: ImportRole = "comic";
    if (roleRaw === "admin") {
      errors.push(ADMIN_ROW_ERROR);
    } else if (IMPORT_ROLES.includes(roleRaw)) {
      role = roleRaw as ImportRole;
    } else if (roleRaw === "lead_producer" || roleRaw === "lead producer") {
      errors.push("Make Lead Producers by editing a producer in /admin/users.");
    } else if (roleRaw !== "") {
      errors.push(`Bad role: ${raw.role.trim()}`);
    }

    const market = homeMarket ? matchCity(homeMarket) : null;
    if (homeMarket && !market) {
      errors.push(`Home market isn't a US city: ${homeMarket}`);
    }

    if (allStar === "bad") errors.push(`Bad all-star value: ${raw.is_all_star.trim()}`);
    if (passLevel === "bad") {
      errors.push(`Bad pass level: ${raw.pass_level.trim()} (use full or local)`);
    } else if (passLevel !== null && roleRaw !== "" && role !== "comic") {
      errors.push("Only comics have a pass level");
    }

    let match: ExistingUser | undefined;
    if (email && EMAIL_RE.test(email)) {
      const earlier = firstRowForEmail.get(email);
      if (earlier !== undefined) {
        errors.push(`Email repeated in this file (also row ${earlier})`);
      } else {
        firstRowForEmail.set(email, row);
      }
      match = existingByEmail.get(email);
      if (match?.role === "admin" && !errors.includes(ADMIN_ROW_ERROR)) {
        errors.push("That email belongs to an admin. Edit admins in /admin/users.");
      }
    }

    const base = {
      row,
      raw,
      existingId: match?.id ?? null,
    };
    const priorRows = [...earlierNames];
    if (name) earlierNames.push({ id: row, name });
    if (errors.length > 0) {
      return { ...base, action: null, user: null, errors, warnings: [] };
    }

    const user: PlannedUser = {
      name,
      email,
      role,
      homeMarket: market,
      isAllStar: allStar === "bad" ? null : allStar,
      passLevel: passLevel === "bad" ? null : passLevel,
    };
    const warnings = match
      ? []
      : duplicateNameWarnings(
          name,
          existing,
          priorRows,
          (u) => `${u.name} (${u.email ?? "link user"})`
        );
    return { ...base, action: match ? "update" : "add", user, errors, warnings };
  });
}
