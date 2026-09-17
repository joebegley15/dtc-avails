import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

export const SESSION_COOKIE_NAME = "dtc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type Role = "admin" | "producer" | "comic";

export type CurrentUser = {
  id: number;
  name: string;
  role: Role;
  is_all_star: boolean;
};

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set");
  }
  return secret;
}

function sign(userId: string): string {
  return createHmac("sha256", getAuthSecret()).update(userId).digest("hex");
}

function buildCookieValue(userId: number): string {
  const id = String(userId);
  return `${id}.${sign(id)}`;
}

function verifyCookieValue(value: string): number | null {
  const separatorIndex = value.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const id = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);
  const expected = sign(id);

  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(provided, expectedBuffer)) return null;

  const userId = Number(id);
  return Number.isInteger(userId) ? userId : null;
}

export async function createSession(userId: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, buildCookieValue(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!value) return null;
  return verifyCookieValue(value);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getCurrentUserId();
  if (userId === null) return null;

  const rows = (await sql`
    select id, name, role, is_all_star from users where id = ${userId}
  `) as CurrentUser[];

  return rows[0] ?? null;
}
