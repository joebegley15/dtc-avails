import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { COUNTED_AVAIL, isTravelShow, offersInTown } from "@/lib/avails";
import { formatShowDate, formatShowTime } from "@/lib/format";

type ShowDetail = {
  id: number;
  city: string;
  neighborhood: string | null;
  show_date: string;
  show_time: string;
  venue: string;
  capacity: number | null;
  is_all_star: boolean;
  producer_names: string[];
};

type ResponseRow = {
  user_id: number;
  name: string;
  email: string | null;
  home_market: string | null;
  is_all_star: boolean;
  has_truck: boolean | null;
  available: boolean;
  down_to_help: boolean;
  in_town: boolean;
  submitted_at: string | null;
};

type Responder = ResponseRow & { isTravel: boolean; inTownShown: boolean };

// Shows are in Texas and Oklahoma.
const answeredAt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function AdminShowResponsesPage({
  params,
}: PageProps<"/admin/shows/[id]">) {
  await requireAdmin();

  const { id: idParam } = await params;
  if (!/^\d+$/.test(idParam)) notFound();
  const id = Number(idParam);

  const [shows, responses, totals] = await Promise.all([
    sql`
      select
        s.id, s.city, s.neighborhood,
        to_char(s.show_date, 'YYYY-MM-DD') as show_date,
        to_char(s.show_time, 'HH24:MI') as show_time,
        s.venue, s.capacity, s.is_all_star,
        coalesce(array_agg(u.name order by u.name) filter (where u.id is not null), '{}')
          as producer_names
      from shows s
      left join show_producers sp on sp.show_id = s.id
      left join users u on u.id = sp.producer_id
      where s.id = ${id}
      group by s.id
    ` as unknown as Promise<ShowDetail[]>,
    // Same counting rule as the In / Out column: an all-star show only
    // counts answers from all-star comics.
    sql`
      select
        u.id as user_id, u.name, u.email, u.home_market, u.is_all_star, u.has_truck,
        a.available, coalesce(a.down_to_help, false) as down_to_help,
        coalesce(a.in_town, false) as in_town, a.submitted_at
      from avails a
      join shows s on s.id = a.show_id
      join users u on u.id = a.user_id
      where a.show_id = ${id} and ${sql.unsafe(COUNTED_AVAIL)}
      order by u.name
    ` as unknown as Promise<ResponseRow[]>,
    // Same population as the producer page's "no response" count.
    sql`
      select count(*)::int as total from users u
      where role in ('comic', 'producer', 'lead_producer')
        or exists (select 1 from avails a where a.user_id = u.id)
    ` as unknown as Promise<{ total: number }[]>,
  ]);

  const show = shows[0];
  if (!show) notFound();

  const responders: Responder[] = responses.map((r) => ({
    ...r,
    isTravel: isTravelShow(show.city, r.home_market),
    // Ignore answers saved before the 50-mile rule for shows close to home.
    inTownShown: r.available && r.in_town && offersInTown(show.city, r.home_market),
  }));
  const inList = responders.filter((r) => r.available);
  const outList = responders.filter((r) => !r.available);
  const noResponse = Math.max(0, totals[0].total - responders.length);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href="/admin/shows"
        className="text-sm text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
      >
        ← All shows
      </Link>

      <h1 className="mt-4 text-lg font-semibold text-zinc-950">
        {show.is_all_star && <span className="mr-1 text-[#DA1717]">★</span>}
        {show.city}
        {show.neighborhood && (
          <span className="font-normal text-zinc-500"> · {show.neighborhood}</span>
        )}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        {formatShowDate(show.show_date, true)} · {formatShowTime(show.show_time)} ·{" "}
        {show.venue}
        {show.capacity !== null && ` · ${show.capacity} seats`}
      </p>
      {show.producer_names.length > 0 && (
        <p className="mt-1 text-sm text-zinc-500">
          Produced by {show.producer_names.join(", ")}
        </p>
      )}

      <p className="mt-6 text-sm font-medium text-zinc-800">
        <span className="text-emerald-700">{inList.length} in</span>
        <span className="text-zinc-400"> · </span>
        {outList.length} out
        <span className="text-zinc-400"> · </span>
        <span className="font-normal text-zinc-500">{noResponse} haven&apos;t answered</span>
      </p>
      {show.is_all_star && (
        <p className="mt-1 text-xs text-zinc-500">
          All-star show: only all-star comics&apos; answers count.
        </p>
      )}

      <ResponseTable title="In" rows={inList} showTags />
      <ResponseTable title="Out" rows={outList} />
    </div>
  );
}

function Tag({ className, children }: { className: string; children: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>
  );
}

function ResponseTable({
  title,
  rows,
  showTags = false,
}: {
  title: string;
  rows: Responder[];
  showTags?: boolean;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-zinc-950">
        {title} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">Nobody yet.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Home market</th>
                {showTags && <th className="px-2 py-2">Notes</th>}
                <th className="whitespace-nowrap px-2 py-2">Answered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((r) => (
                <tr key={r.user_id} className="align-top">
                  <td className="px-2 py-2 font-medium text-zinc-950">
                    {r.name}
                    {r.is_all_star && <span className="ml-1 text-[#DA1717]">★</span>}
                  </td>
                  <td className="px-2 py-2 text-zinc-600">{r.email ?? "—"}</td>
                  <td className="px-2 py-2 text-zinc-600">{r.home_market ?? "—"}</td>
                  {showTags && (
                    <td className="px-2 py-2">
                      <span className="flex flex-wrap gap-1">
                        {r.isTravel && <Tag className="bg-amber-100 text-amber-800">Travel</Tag>}
                        {r.inTownShown && (
                          <Tag className="bg-violet-100 text-violet-800">In town</Tag>
                        )}
                        {r.down_to_help && (
                          <Tag className="bg-emerald-100 text-emerald-800">Down to help</Tag>
                        )}
                        {r.has_truck === true && (
                          <Tag className="bg-sky-100 text-sky-800">Truck</Tag>
                        )}
                      </span>
                    </td>
                  )}
                  <td className="whitespace-nowrap px-2 py-2 text-zinc-500">
                    {r.submitted_at ? answeredAt.format(new Date(r.submitted_at)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
