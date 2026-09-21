// Server-side database helpers for shows. Import from server code only.
import { sql } from "./db";
import { showKey, type ParsedShow, type ProducerOption } from "./show-parsing";

/** Users a show can be attached to: role producer or admin. */
export async function loadProducerOptions(): Promise<ProducerOption[]> {
  return (await sql`
    select id, name from users
    where role in ('producer', 'admin')
    order by name
  `) as ProducerOption[];
}

/** showKey() of every existing show on the given dates. */
export async function loadExistingShowKeys(
  dates: string[],
  excludeShowId?: number
): Promise<Set<string>> {
  if (dates.length === 0) return new Set();

  const rows = (await sql`
    select
      to_char(show_date, 'YYYY-MM-DD') as show_date,
      to_char(show_time, 'HH24:MI') as show_time,
      venue
    from shows
    where show_date = any(${dates}::date[])
      and id is distinct from ${excludeShowId ?? null}::integer
  `) as { show_date: string; show_time: string; venue: string }[];

  return new Set(rows.map((r) => showKey(r.show_date, r.show_time, r.venue)));
}

/**
 * Inserts a show and its show_producers rows in one statement. The duplicate
 * check (same date, time, and venue) is part of the statement, so a duplicate
 * inserts nothing and returns no rows. Run it alone or inside sql.transaction.
 */
export function insertShowQuery(show: ParsedShow) {
  return sql`
    with new_show as (
      insert into shows (city, neighborhood, show_date, show_time, venue, capacity)
      select
        ${show.city}::text,
        ${show.neighborhood}::text,
        ${show.showDate}::date,
        ${show.showTime}::time,
        ${show.venue}::text,
        ${show.capacity}::integer
      where not exists (
        select 1 from shows
        where show_date = ${show.showDate}::date
          and show_time = ${show.showTime}::time
          and lower(btrim(venue)) = lower(${show.venue}::text)
      )
      returning id
    )
    insert into show_producers (show_id, producer_id)
    select new_show.id, pid
    from new_show, unnest(${show.producerIds}::integer[]) as pid
    returning show_id
  `;
}

/** Update a show and replace its producers. Run inside sql.transaction. */
export function updateShowQueries(showId: number, show: ParsedShow) {
  return [
    sql`
      update shows set
        city = ${show.city}::text,
        neighborhood = ${show.neighborhood}::text,
        show_date = ${show.showDate}::date,
        show_time = ${show.showTime}::time,
        venue = ${show.venue}::text,
        capacity = ${show.capacity}::integer
      where id = ${showId}
    `,
    sql`delete from show_producers where show_id = ${showId}`,
    sql`
      insert into show_producers (show_id, producer_id)
      select ${showId}::integer, pid
      from unnest(${show.producerIds}::integer[]) as pid
    `,
  ];
}
