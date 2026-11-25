// Pure role rules. No database or Next.js imports, so tests and client code
// can use them.

export const ROLES = ["admin", "lead_producer", "producer", "booker", "comic"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  lead_producer: "Lead Producer",
  producer: "Producer",
  booker: "Booker",
  comic: "Comic",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

/** Roles that produce shows: they get the producer dashboard and can be put on a show. */
export const PRODUCING_ROLES: readonly Role[] = ["producer", "lead_producer", "admin"];

/** SQL list of PRODUCING_ROLES, for `role in (...)`. */
export const PRODUCING_ROLES_SQL = "('producer', 'lead_producer', 'admin')";

export function isProducing(role: Role): boolean {
  return PRODUCING_ROLES.includes(role);
}

/**
 * Who can submit avails as a comedian. Bookers can't: they only read show
 * data to plan runs.
 */
export function canSubmitAvails(role: Role): boolean {
  return role !== "booker";
}

/** Who sees the read-only booker views. */
export function canViewBookerViews(role: Role): boolean {
  return role === "booker" || role === "admin";
}

/**
 * Which roles a user may create one at a time. Admins can create everyone
 * except other admins here (admins are never made through these flows);
 * Lead Producers only comics and regular producers. Everyone else, nobody.
 */
export function creatableRoles(creator: Role): Role[] {
  switch (creator) {
    case "admin":
      return ["comic", "producer", "lead_producer", "booker"];
    case "lead_producer":
      return ["comic", "producer"];
    default:
      return [];
  }
}

export function roleHomePath(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin/shows";
    case "lead_producer":
    case "producer":
      return "/producer";
    case "booker":
      return "/booker";
    case "comic":
      return "/avails";
  }
}
