import { createHmac, timingSafeEqual } from "crypto";

export const AUTH_COOKIE_NAME = "dtc_upload_session";
export const AUTH_COOKIE_PATH = "/upload";

function getPassword(): string {
  const password = process.env.UPLOAD_PASSWORD;
  if (!password) {
    throw new Error("UPLOAD_PASSWORD environment variable is not set");
  }
  return password;
}

export function checkPassword(password: string): boolean {
  return password === getPassword();
}

export function getSessionToken(): string {
  return createHmac("sha256", getPassword())
    .update("dtc-upload-portal")
    .digest("hex");
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = getSessionToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
