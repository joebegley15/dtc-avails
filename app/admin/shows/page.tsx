import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { loadProducerOptions } from "@/lib/shows";
import { ImportBanner } from "./import-banner";
import { ShowsManager } from "./shows-manager";
import type { ShowRowData } from "./types";

function toCount(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export default async function AdminShowsPage({
  searchParams,
}: PageProps<"/admin/shows">) {
  await requireAdmin();

  const params = await searchParams;
  const imported = toCount(params.imported);
  const skipped = toCount(params.skipped);

  const [shows, producers] = await Promise.all([
    sql`
      select
        s.id, s.city, s.neighborhood,
        to_char(s.show_date, 'YYYY-MM-DD') as show_date,
        to_char(s.show_time, 'HH24:MI') as show_time,
        s.venue, s.capacity, s.is_all_star,
        coalesce(array_agg(u.id order by u.name) filter (where u.id is not null), '{}') as producer_ids,
        coalesce(array_agg(u.name order by u.name) filter (where u.id is not null), '{}') as producer_names
      from shows s
      left join show_producers sp on sp.show_id = s.id
      left join users u on u.id = sp.producer_id
      group by s.id
      order by s.show_date, s.show_time, s.id
    ` as unknown as Promise<ShowRowData[]>,
    loadProducerOptions(),
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <h1 className="text-lg font-semibold text-zinc-950">Shows</h1>

      {imported !== null && skipped !== null && (
        <ImportBanner imported={imported} skipped={skipped} />
      )}

      <ShowsManager
        shows={shows}
        producers={producers}
        serverToday={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
