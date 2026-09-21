// Server-side data access for the /avails flow. Import from server code only.
import { sql } from "./db";
import { cityPart } from "./location";
import type { CurrentUser } from "./session";

// "Today" for show_date >= today. Shows are mostly in Texas, and using the
// database's own UTC date would hide tonight's shows from about 7 PM Central.
const AVAILS_TIME_ZONE = "America/Chicago";

export type VisibleShow = {
  id: number;
  city: string;
  neighborhood: string | null;
  show_date: string; // YYYY-MM-DD
  show_time: string; // HH:MM
  is_all_star: boolean;
  /** The user's saved answer, or null if they haven't answered. */
  available: boolean | null;
};

/**
 * The single rule for which shows a user may see and answer, used by both the
 * page and the submit action:
 *   - show_date is today or later
 *   - all-star shows only for all-star users, and for admins
 *
 * Venue and capacity are deliberately never selected, so they cannot reach the
 * client.
 */
export async function loadVisibleShows(user: CurrentUser): Promise<VisibleShow[]> {
  const canSeeAllStar = user.role === "admin" || user.is_all_star;

  return (await sql`
    select
      s.id, s.city, s.neighborhood,
      to_char(s.show_date, 'YYYY-MM-DD') as show_date,
      to_char(s.show_time, 'HH24:MI') as show_time,
      s.is_all_star,
      a.available
    from shows s
    left join avails a on a.show_id = s.id and a.user_id = ${user.id}
    where s.show_date >= (now() at time zone ${AVAILS_TIME_ZONE}::text)::date
      and (${canSeeAllStar}::boolean or not s.is_all_star)
    order by s.show_date, s.show_time, s.id
  `) as VisibleShow[];
}

export type AvailsProfile = {
  homeMarket: string | null;
  /** ISO timestamp of the user's most recent submission, or null. */
  lastSubmittedAt: string | null;
};

export async function loadAvailsProfile(user: CurrentUser): Promise<AvailsProfile> {
  const rows = (await sql`
    select
      home_market,
      (
        select to_char(max(submitted_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        from avails where user_id = u.id
      ) as last_submitted_at
    from users u
    where u.id = ${user.id}
  `) as { home_market: string | null; last_submitted_at: string | null }[];

  const row = rows[0];
  return {
    homeMarket: row?.home_market?.trim() || null,
    lastSubmittedAt: row?.last_submitted_at ?? null,
  };
}

/** True when the show's city differs from the user's home market (city part only). */
export function isTravelShow(showCity: string, homeMarket: string | null): boolean {
  if (!homeMarket) return false;
  return cityPart(showCity) !== cityPart(homeMarket);
}
