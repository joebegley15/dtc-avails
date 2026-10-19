// Client-safe helpers for producer nominations: no server imports.

export type NominationStatus = "pending" | "approved" | "rejected" | "signed_up";

/** How long an approved invite link works. */
export const INVITE_LINK_DAYS = 30;

/** Shown for any link that doesn't work: never says whether it was invalid, used or expired. */
export const INVALID_INVITE_MESSAGE =
  "This invite isn't valid anymore. Ask the producer who invited you for a new one.";

/** The note field's limit on /producer/nominate. */
export const NOMINATION_NOTE_MAX = 300;

/** The DM producers send with the link, over Instagram. */
export function nominationMessage(link: string): string {
  return `Hey! I run shows for Don't Tell Comedy out here and I'd love to have you on one. This link gets you into our avails system, where you pick which shows you're free for: ${link}

Takes a minute to set up. The link is just for you and expires in ${INVITE_LINK_DAYS} days.`;
}

/** The public link for an approved nomination's token. */
export function nominationLink(origin: string, token: string): string {
  return `${origin}/invite/${token}`;
}

/**
 * "@Some.Comic " -> "some.comic". Null if it isn't a possible Instagram
 * handle (letters, numbers, periods and underscores, at most 30).
 */
export function normalizeHandle(input: string): string | null {
  const handle = input.trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null;
}

/** "3 days ago", "just now". From an ISO timestamp, relative to `now`. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24 * 7, "week"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  for (const [size, unit] of units) {
    const n = Math.floor(seconds / size);
    if (n >= 1) return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  }
  return "just now";
}

/** "Nov 18, 2026" from an ISO timestamp. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}
