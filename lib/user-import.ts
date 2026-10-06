// Pure planning and validation for the bulk user import. No database access:
// callers pass in the existing users.

export const USER_CSV_FIELDS = [
  "name",
  "email",
  "role",
  "home_market",
  "is_all_star",
] as const;

export type UserCsvRow = Record<(typeof USER_CSV_FIELDS)[number], string>;

export type ExistingUser = {
  id: number;
  // Link-based comics have no email; they can never be matched by one here.
  email: string | null;
  role: "admin" | "producer" | "comic";
};

export type ImportRole = "comic" | "producer";

export type PlannedUser = {
  name: string;
  email: string;
  role: ImportRole;
  /** null = leave an existing user's value alone (blank cell). */
  homeMarket: string | null;
  /** null = leave an existing user's value alone (blank cell). */
  isAllStar: boolean | null;
};

export type UserRowPlan = {
  /** 1-based position among the CSV's data rows. */
  row: number;
  raw: UserCsvRow;
  action: "add" | "update" | null;
  user: PlannedUser | null;
  existingId: number | null;
  errors: string[];
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

  return rows.map((raw, i) => {
    const row = i + 1;
    const errors: string[] = [];

    const name = raw.name.trim();
    const email = raw.email.trim().toLowerCase();
    const roleRaw = raw.role.trim().toLowerCase();
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
    } else if (roleRaw === "comic" || roleRaw === "producer") {
      role = roleRaw;
    } else if (roleRaw !== "") {
      errors.push(`Bad role: ${raw.role.trim()}`);
    }

    if (allStar === "bad") errors.push(`Bad all-star value: ${raw.is_all_star.trim()}`);

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
    if (errors.length > 0) {
      return { ...base, action: null, user: null, errors };
    }

    const user: PlannedUser = {
      name,
      email,
      role,
      homeMarket: homeMarket || null,
      isAllStar: allStar === "bad" ? null : allStar,
    };
    return { ...base, action: match ? "update" : "add", user, errors };
  });
}
