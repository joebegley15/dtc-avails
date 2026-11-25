// Server-side data for the booker views. Import from server code only.
import { sql } from "./db";
import { loadCityCoords } from "./city-coords";
import {
  filterBookerShows,
  parseBookerFilters,
  type BookerFilters,
  type BookerShow,
} from "./booker";

// Same "today" as /avails: shows are in Texas and Oklahoma.
const BOOKER_TIME_ZONE = "America/Chicago";

/**
 * Every upcoming show with the fields a booker plans with. Only these
 * columns are selected: no avails, applicants, emails, or other contact info.
 */
export async function loadUpcomingBookerShows(): Promise<BookerShow[]> {
  const rows = (await sql`
    select
      s.id, s.city, s.neighborhood,
      to_char(s.show_date, 'YYYY-MM-DD') as date,
      to_char(s.show_time, 'HH24:MI') as time,
      s.venue, s.capacity,
      coalesce(array_agg(u.name order by u.name) filter (where u.id is not null), '{}')
        as producer_names
    from shows s
    left join show_producers sp on sp.show_id = s.id
    left join users u on u.id = sp.producer_id
    where s.show_date >= (now() at time zone ${BOOKER_TIME_ZONE}::text)::date
    group by s.id
    order by s.show_date, s.show_time, s.id
  `) as (Omit<BookerShow, "producerNames"> & { producer_names: string[] })[];

  return rows.map(({ producer_names, ...show }) => ({ ...show, producerNames: producer_names }));
}

export type BookerView = {
  filters: BookerFilters;
  shows: BookerShow[];
  /** Every upcoming show city, for the city filter. */
  cities: string[];
};

/** Loads upcoming shows and applies the filters in the URL. */
export async function loadBookerView(
  params: Record<string, string | string[] | undefined>
): Promise<BookerView> {
  const all = await loadUpcomingBookerShows();
  const cities = [...new Set(all.map((s) => s.city))].sort((a, b) => a.localeCompare(b));
  const filters = parseBookerFilters(params, cities);
  const coords = filters.market
    ? await loadCityCoords([filters.market, ...cities])
    : new Map();
  return { filters, shows: filterBookerShows(all, filters, coords), cities };
}
