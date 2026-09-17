import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "dtc_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }
  return password;
}

export function checkAdminPassword(password: string): boolean {
  return password === getAdminPassword();
}

function getAdminSessionToken(): string {
  return createHmac("sha256", getAdminPassword())
    .update("dtc-admin-portal")
    .digest("hex");
}

function isValidAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = getAdminSessionToken();
  const provided = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return (
    provided.length === expectedBuffer.length &&
    timingSafeEqual(provided, expectedBuffer)
  );
}

export async function createAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, getAdminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}
