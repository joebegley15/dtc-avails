import { redirect } from "next/navigation";
import {
  canSubmitAvails,
  canViewBookerViews,
  isProducing,
  roleHomePath,
  type Role,
} from "./roles";
import { getCurrentUser, type CurrentUser } from "./session";

/**
 * The starting password for users created by the bulk import, and the value
 * "Reset to default" restores. Change it here (e.g. next year). It is only
 * ever stored as a bcrypt hash.
 */
export const DEFAULT_PASSWORD = "DTC2026!";

/**
 * Gate for pages and actions any signed-in user may use. Call it at the top
 * of every such page and server action, before any database read or write.
 *
 * A user who still has to choose their own password is sent to
 * /change-password from everywhere that calls this, so the rule can't be
 * skipped by typing a URL or calling an action directly.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.must_change_password) {
    redirect("/change-password");
  }
  return user;
}

/**
 * Gate for everything under /admin. Call it at the top of every admin layout,
 * page, and server action: layouts don't re-run on client navigation, and
 * server actions are reachable by direct POST, so each entry point must check
 * for itself.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}

/**
 * Gate for a page or action limited to some roles. Anyone else is sent to
 * their own home page. Like requireAdmin, call it first in every page and
 * server action it protects.
 */
async function requireRoleWhere(allowed: (role: Role) => boolean): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed(user.role)) {
    redirect(roleHomePath(user.role));
  }
  return user;
}

/** Producers, Lead Producers and admins: the producer dashboard. */
export function requireProducer(): Promise<CurrentUser> {
  return requireRoleWhere(isProducing);
}

/** Lead Producers only: their one-at-a-time "Create user" form. */
export function requireLeadProducer(): Promise<CurrentUser> {
  return requireRoleWhere((role) => role === "lead_producer");
}

/** Everyone who submits avails as a comedian (not Bookers). */
export function requireComedian(): Promise<CurrentUser> {
  return requireRoleWhere(canSubmitAvails);
}

/** Bookers and admins: the read-only booker views and export. */
export function requireBookerViewer(): Promise<CurrentUser> {
  return requireRoleWhere(canViewBookerViews);
}

/**
 * Gate for /change-password only. It can't use requireUser(), which sends
 * flagged users here. Anyone who isn't flagged goes home instead: there is no
 * "current password" field, so the page is only for the forced first change.
 */
export async function requireUserMustChangePassword(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.must_change_password) {
    redirect(roleHomePath(user.role));
  }
  return user;
}
