// Access tokens for link-based sign-in (no username or password). The token
// itself is the credential, so it's stored in the clear (there's nothing to
// hash it against at lookup time) and must be unguessable on its own:
// crypto-random, never sequential, never derived from the user's name.
import { randomBytes } from "node:crypto";

/** ~22 URL-safe characters from 16 random bytes. */
export function generateToken(): string {
  return randomBytes(16).toString("base64url");
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL environment variable is not set");
  }
  return url.replace(/\/+$/, "");
}

export function buildLink(token: string): string {
  return `${appUrl()}/go/${token}`;
}
