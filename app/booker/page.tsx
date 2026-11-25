import Link from "next/link";
import { requireBookerViewer } from "@/lib/auth";
import { bookerQuery } from "@/lib/booker";
import { loadBookerView } from "@/lib/booker-data";
import { formatShowDate, formatShowTime } from "@/lib/format";
import { BookerFilters } from "./booker-filters";

/** Read-only: every upcoming TX/OK show, for planning runs. */
export default async function BookerShowsPage({ searchParams }: PageProps<"/booker">) {
  await requireBookerViewer();
  const { filters, shows, cities } = await loadBookerView(await searchParams);
  const nextSort = filters.sort === "asc" ? "desc" : "asc";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-zinc-950">Upcoming shows</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Every upcoming show across Texas and Oklahoma.
          </p>
        </div>
        <a
          href={`/booker/export${bookerQuery(filters)}`}
          className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950"
        >
          Download CSV ({shows.length})
        </a>
      </div>

      <BookerFilters action="/booker" filters={filters} cities={cities} />

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
              <th className="py-2 pr-4">
                <Link
                  href={`/booker${bookerQuery(filters, { sort: nextSort })}`}
                  className="hover:text-zinc-950"
                  aria-label={`Sort by date, ${nextSort === "asc" ? "earliest" : "latest"} first`}
                >
                  Date {filters.sort === "asc" ? "↑" : "↓"}
                </Link>
              </th>
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">City</th>
              <th className="py-2 pr-4">Neighborhood</th>
              <th className="py-2 pr-4">Venue</th>
              <th className="py-2 pr-4 text-right">Est. capacity</th>
              <th className="py-2">Producer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {shows.map((s) => (
              <tr key={s.id} className="text-zinc-800">
                <td className="whitespace-nowrap py-2 pr-4">{formatShowDate(s.date, true)}</td>
                <td className="whitespace-nowrap py-2 pr-4">{formatShowTime(s.time)}</td>
                <td className="py-2 pr-4">{s.city}</td>
                <td className="py-2 pr-4 text-zinc-600">{s.neighborhood ?? "—"}</td>
                <td className="py-2 pr-4">{s.venue}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{s.capacity ?? "—"}</td>
                <td className="py-2 text-zinc-600">{s.producerNames.join(", ") || "—"}</td>
              </tr>
            ))}
            {shows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-zinc-500">
                  No upcoming shows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
