import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  ProducerShowsView,
  type ProducerOption,
  type ShowCardData,
} from "./producer-shows-view";

type ShowRow = {
  id: number;
  city: string;
  neighborhood: string | null;
  show_date: string;
  show_time: string;
  venue: string;
  capacity: number | null;
  is_all_star: boolean;
  producer_ids: number[];
  producer_names: string[];
};

type AvailsCountRow = {
  show_id: number;
  in_count: number;
  out_count: number;
};

type AvailableComicRow = {
  show_id: number;
  id: number;
  name: string;
  email: string;
  home_market: string | null;
  is_all_star: boolean;
};

const SHOW_COLUMNS = `
  s.id,
  s.city,
  s.neighborhood,
  to_char(s.show_date, 'YYYY-MM-DD') as show_date,
  to_char(s.show_time, 'HH24:MI') as show_time,
  s.venue,
  s.capacity,
  s.is_all_star,
  coalesce(array_agg(distinct u.id) filter (where u.id is not null), '{}') as producer_ids,
  coalesce(array_agg(distinct u.name) filter (where u.name is not null), '{}') as producer_names
`;

function cityPart(location: string): string {
  return location.split(",")[0]?.trim().toLowerCase() ?? "";
}

export default async function ProducerPage({
  searchParams,
}: PageProps<"/producer">) {
  const user = await requireUser();
  if (user.role !== "producer" && user.role !== "admin") {
    redirect("/login");
  }
  const isAdmin = user.role === "admin";

  // ?producer=<id> preselects a producer in the admin view. Ignored otherwise.
  const requested = (await searchParams).producer;
  const initialProducerId =
    isAdmin && typeof requested === "string" && /^\d+$/.test(requested)
      ? Number(requested)
      : null;
  const producerUserId = isAdmin ? null : user.id;

  const showRows = (isAdmin
    ? await sql`
        select ${sql.unsafe(SHOW_COLUMNS)}
        from shows s
        left join show_producers sp on sp.show_id = s.id
        left join users u on u.id = sp.producer_id
        where (s.show_date, s.show_time) >= (current_date, current_time)
        group by s.id
        order by s.show_date, s.show_time
      `
    : await sql`
        select ${sql.unsafe(SHOW_COLUMNS)}
        from shows s
        left join show_producers sp on sp.show_id = s.id
        left join users u on u.id = sp.producer_id
        where (s.show_date, s.show_time) >= (current_date, current_time)
          and exists (
            select 1 from show_producers sp2
            where sp2.show_id = s.id and sp2.producer_id = ${producerUserId}
          )
        group by s.id
        order by s.show_date, s.show_time
      `) as unknown as ShowRow[];

  const showIds = showRows.map((r) => r.id);

  const [{ total: totalComics }] = (await sql`
    select count(*)::int as total from users where role = 'comic'
  `) as { total: number }[];

  let availsCountRows: AvailsCountRow[] = [];
  let availableComicRows: AvailableComicRow[] = [];

  if (showIds.length > 0) {
    [availsCountRows, availableComicRows] = (await Promise.all([
      sql`
        select show_id,
          count(*) filter (where available)::int as in_count,
          count(*) filter (where not available)::int as out_count
        from avails
        where show_id = any(${showIds})
        group by show_id
      `,
      sql`
        select a.show_id, u.id, u.name, u.email, u.home_market, u.is_all_star
        from avails a
        join users u on u.id = a.user_id
        where a.show_id = any(${showIds}) and a.available = true
        order by u.name
      `,
    ])) as unknown as [AvailsCountRow[], AvailableComicRow[]];
  }

  const countsByShow = new Map<number, { inCount: number; outCount: number }>();
  for (const row of availsCountRows) {
    countsByShow.set(row.show_id, { inCount: row.in_count, outCount: row.out_count });
  }

  const comicsByShow = new Map<number, AvailableComicRow[]>();
  for (const row of availableComicRows) {
    const list = comicsByShow.get(row.show_id) ?? [];
    list.push(row);
    comicsByShow.set(row.show_id, list);
  }

  const shows: ShowCardData[] = showRows.map((s) => {
    const counts = countsByShow.get(s.id) ?? { inCount: 0, outCount: 0 };
    const noResponseCount = Math.max(0, totalComics - counts.inCount - counts.outCount);

    const availableComics = (comicsByShow.get(s.id) ?? [])
      .map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        homeMarket: c.home_market,
        isAllStar: c.is_all_star,
        isTravel: c.home_market ? cityPart(c.home_market) !== cityPart(s.city) : false,
      }))
      .sort((a, b) => {
        const tier = (c: { isAllStar: boolean; isTravel: boolean }) =>
          c.isAllStar ? 0 : c.isTravel ? 2 : 1;
        return tier(a) - tier(b) || a.name.localeCompare(b.name);
      });

    return {
      id: s.id,
      date: s.show_date,
      time: s.show_time,
      city: s.city,
      neighborhood: s.neighborhood,
      venue: s.venue,
      capacity: s.capacity,
      isAllStar: s.is_all_star,
      producerIds: s.producer_ids,
      producerNames: s.producer_names,
      inCount: counts.inCount,
      outCount: counts.outCount,
      noResponseCount,
      availableComics,
    };
  });

  const producers: ProducerOption[] = isAdmin
    ? ((await sql`
        select id, name from users where role in ('producer', 'admin') order by name
      `) as ProducerOption[])
    : [];

  return (
    <ProducerShowsView
      key={initialProducerId ?? "all"}
      shows={shows}
      producers={producers}
      isAdmin={isAdmin}
      initialProducerId={initialProducerId}
    />
  );
}
