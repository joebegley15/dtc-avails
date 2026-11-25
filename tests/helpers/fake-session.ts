import type { CurrentUser } from "@/lib/session";
import type { Role } from "@/lib/roles";
import type { PassLevel } from "@/lib/pass-level";

export class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`redirect to ${url}`);
  }
}

let user: CurrentUser | null = null;

export function currentUser(): CurrentUser | null {
  return user;
}

export function signInAs(
  role: Role,
  extra: { id?: number; passLevel?: PassLevel; isAllStar?: boolean } = {}
): CurrentUser {
  user = {
    id: extra.id ?? 42,
    name: `Test ${role}`,
    role,
    is_all_star: extra.isAllStar ?? false,
    pass_level: extra.passLevel ?? "full",
    must_change_password: false,
    has_password: true,
    has_email: true,
  };
  return user;
}

export function signOut() {
  user = null;
}

/** Runs fn and returns where it redirected, or throws if it didn't. */
export async function redirectOf(fn: () => unknown): Promise<string> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof RedirectError) return err.url;
    throw err;
  }
  throw new Error("expected a redirect, but the call returned normally");
}
