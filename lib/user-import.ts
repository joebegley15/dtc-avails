// Pure planning and validation for the bulk user import. No database access:
// callers pass in the existing users and taken usernames.

export const USER_CSV_FIELDS = [
  "name",
  "email",
  "role",
  "home_market",
  "is_all_star",
  "username",
] as const;

export type UserCsvRow = Record<(typeof USER_CSV_FIELDS)[number], string>;

export type ExistingUser = {
  id: number;
  // Link-based comics have no email; they can never be matched by one here.
  email: string | null;
  role: "admin" | "producer" | "comic";
  username: string | null;
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
  /** New users: chosen or generated. Existing users: their current username. */
  username: string;
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

/** The part of the email before the @, lowercased, as a username base. */
export function usernameBase(email: string): string {
  const local = email.split("@")[0].trim().toLowerCase().replace(/\s+/g, "");
  return local || "user";
}

/** base, then base2, base3, ... until one isn't in `taken`. */
export function uniqueUsername(base: string, taken: Set<string>): string {
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) {
    candidate = `${base}${n}`;
  }
  return candidate;
}

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
 *    all-star only. Username, password, and role are never touched.
 *  - Rows with role admin are errors, and so are rows that would touch an
 *    existing admin.
 *  - New users get the username from the CSV if given (error if taken),
 *    otherwise one generated from the email, with a number added if needed.
 *
 * `takenUsernames` must be every existing username, lowercased.
 */
export function planUserImport(
  rows: UserCsvRow[],
  existing: ExistingUser[],
  takenUsernames: Set<string>
): UserRowPlan[] {
  // Link-based comics (null email) can never be matched by an email-based
  // CSV row, so they're simply left out of this lookup.
  const existingByEmail = new Map(
    existing.flatMap((u) => (u.email ? [[u.email.toLowerCase(), u] as const] : []))
  );
  const taken = new Set(takenUsernames);
  const firstRowForEmail = new Map<string, number>();

  const plans: UserRowPlan[] = rows.map((raw, i) => {
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
      username: match?.username ?? "",
    };
    return { ...base, action: match ? "update" : "add", user, errors };
  });

  // Usernames for new users. Explicit ones are reserved first so a generated
  // name can never take one that a later row asked for.
  const needsGenerated: UserRowPlan[] = [];
  for (const plan of plans) {
    if (plan.action !== "add" || !plan.user) continue;

    const explicit = plan.raw.username.trim().toLowerCase();
    if (!explicit) {
      needsGenerated.push(plan);
    } else if (/\s/.test(explicit)) {
      plan.errors.push("Username can't contain spaces");
    } else if (taken.has(explicit)) {
      plan.errors.push(`Username already taken: ${explicit}`);
    } else {
      taken.add(explicit);
      plan.user.username = explicit;
    }
  }
  for (const plan of needsGenerated) {
    if (!plan.user) continue;
    const username = uniqueUsername(usernameBase(plan.user.email), taken);
    taken.add(username);
    plan.user.username = username;
  }

  // Rows that failed in the username pass are errors, not adds.
  for (const plan of plans) {
    if (plan.errors.length > 0 && plan.action !== null) {
      plan.action = null;
      plan.user = null;
    }
  }

  return plans;
}
