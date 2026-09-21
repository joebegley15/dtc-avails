import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

/**
 * Gate for pages and actions any signed-in user may use. Call it at the top
 * of every such page and server action, before any database read or write.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
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
