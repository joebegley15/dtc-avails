import { requireBookerViewer } from "@/lib/auth";
import { planRuns } from "@/lib/booker";
import { loadBookerView } from "@/lib/booker-data";
import { formatShowDate, formatShowTime } from "@/lib/format";
import { BookerFilters } from "../booker-filters";

/**
 * Groups upcoming shows in a date range by night and city, split into runs
 * of consecutive nights, so a booker can chain cities into a tour.
 */
export default async function RunPlannerPage({ searchParams }: PageProps<"/booker/runs">) {
  await requireBookerViewer();
  const params = await searchParams;
  // Only the date range applies here: a run crosses cities by design.
  const { filters, shows, cities } = await loadBookerView({
    from: params.from,
    to: params.to,
  });
  const runs = planRuns(shows);
  const multiNight = runs.filter((r) => r.nights > 1).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-lg font-semibold text-zinc-950">Run planner</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Shows grouped by night and city. Nights in a row with shows form a run;
        a city marked <span className="font-medium text-[#DA1717]">back-to-back</span>{" "}
        also has shows the night before or after.
      </p>

      <BookerFilters action="/booker/runs" filters={filters} cities={cities} showCityAndMarket={false} />

      <p className="mt-4 text-sm font-medium text-zinc-800">
        {shows.length} show{shows.length === 1 ? "" : "s"} · {runs.length} stretch
        {runs.length === 1 ? "" : "es"} of nights · {multiNight} with 2+ nights in a row
      </p>

      <div className="mt-4 space-y-6">
        {runs.map((run) => (
          <section key={run.start} className="rounded-md border border-black/10">
            <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/10 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-950">
              <span>
                {formatShowDate(run.start)}
                {run.nights > 1 && <> – {formatShowDate(run.end)}</>}
              </span>
              <span className={run.nights > 1 ? "text-[#DA1717]" : "font-normal text-zinc-500"}>
                {run.nights} night{run.nights === 1 ? "" : "s"} in a row
              </span>
            </h2>
            <ol className="divide-y divide-black/5">
              {run.days.map((day) => (
                <li key={day.date} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-6">
                  <span className="w-28 shrink-0 text-sm font-medium text-zinc-950">
                    {formatShowDate(day.date)}
                  </span>
                  <ul className="flex flex-1 flex-col gap-2">
                    {day.cities.map((c) => (
                      <li key={c.city} className="text-sm">
                        <span className="font-medium text-zinc-900">{c.city}</span>
                        {c.consecutive && (
                          <span className="ml-2 rounded bg-[#DA1717]/10 px-1.5 py-0.5 text-xs font-medium text-[#DA1717]">
                            back-to-back
                          </span>
                        )}
                        <ul className="mt-0.5 text-zinc-600">
                          {c.shows.map((s) => (
                            <li key={s.id}>
                              {formatShowTime(s.time)} · {s.venue}
                              {s.neighborhood && <> ({s.neighborhood})</>}
                              {s.capacity !== null && <> · cap. {s.capacity}</>}
                              {s.producerNames.length > 0 && <> · {s.producerNames.join(", ")}</>}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {runs.length === 0 && (
          <p className="text-sm text-zinc-500">No upcoming shows in this date range.</p>
        )}
      </div>
    </div>
  );
}
