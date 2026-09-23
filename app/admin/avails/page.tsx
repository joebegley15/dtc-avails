import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatShowDateTime } from "@/lib/format";
import { DownloadCsvButton } from "./download-csv-button";

type ComicRow = { id: number; name: string; email: string | null };

type ShowRow = {
  id: number;
  city: string;
  show_date: string;
  show_time: string;
  is_all_star: boolean;
};

type AvailRow = { user_id: number; show_id: number; available: boolean };

export default async function AdminAvailsPage() {
  await requireAdmin();

  const comics = (await sql`
    select id, name, email from users where role = 'comic' order by name
  `) as ComicRow[];

  const shows = (await sql`
    select id, city,
      to_char(show_date, 'YYYY-MM-DD') as show_date,
      to_char(show_time, 'HH24:MI') as show_time,
      is_all_star
    from shows
    where (show_date, show_time) >= (current_date, current_time)
    order by show_date, show_time, id
  `) as ShowRow[];

  const showIds = shows.map((s) => s.id);
  const avails =
    showIds.length > 0
      ? ((await sql`
          select user_id, show_id, available from avails
          where show_id = any(${showIds})
        `) as AvailRow[])
      : [];

  const cellMap = new Map<string, boolean>();
  for (const a of avails) {
    cellMap.set(`${a.user_id}-${a.show_id}`, a.available);
  }

  const showLabels = shows.map(
    (s) => `${formatShowDateTime(s.show_date, s.show_time)} — ${s.city}`
  );

  const cells = comics.map((c) =>
    shows.map((s) => {
      const value = cellMap.get(`${c.id}-${s.id}`);
      return value === true ? "in" : value === false ? "out" : "";
    })
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-950">Avails</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Who&apos;s in and out for upcoming shows.
          </p>
        </div>
        <DownloadCsvButton comics={comics} showLabels={showLabels} cells={cells} />
      </div>

      {shows.length === 0 || comics.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">Nothing to show yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="sticky left-0 bg-white py-2 pr-4">Comic</th>
                {shows.map((s, i) => (
                  <th
                    key={s.id}
                    className="whitespace-nowrap py-2 pr-4 font-medium normal-case text-zinc-600"
                  >
                    {showLabels[i]}
                    {s.is_all_star && (
                      <span className="ml-1 text-[#DA1717]">★</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {comics.map((c, ci) => (
                <tr key={c.id}>
                  <td className="sticky left-0 bg-white py-2 pr-4 font-medium text-zinc-950">
                    {c.name}
                  </td>
                  {shows.map((s, si) => (
                    <td key={s.id} className="py-2 pr-4">
                      {cells[ci][si] === "in" && (
                        <span className="font-medium text-emerald-600">in</span>
                      )}
                      {cells[ci][si] === "out" && (
                        <span className="text-zinc-400">out</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
