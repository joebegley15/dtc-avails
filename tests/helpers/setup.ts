// Every test runs server code against fakes: no database, no cookies, and
// Next's redirect() throws a RedirectError the test can assert on.
import { afterEach, vi } from "vitest";
import { resetDb } from "./fake-db";
import { signOut } from "./fake-session";

vi.mock("@/lib/db", async () => (await import("./fake-db")));

vi.mock("@/lib/session", async () => {
  const fake = await import("./fake-session");
  return {
    SESSION_COOKIE_NAME: "dtc_session",
    getCurrentUser: async () => fake.currentUser(),
    getCurrentUserId: async () => fake.currentUser()?.id ?? null,
    createSession: async () => {},
    destroySession: async () => {},
  };
});

vi.mock("next/navigation", async () => {
  const { RedirectError } = await import("./fake-session");
  return {
    redirect: (url: string) => {
      throw new RedirectError(url);
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));

afterEach(() => {
  resetDb();
  signOut();
});
