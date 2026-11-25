import Link from "next/link";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { LOCAL_PASS_RADIUS_MILES } from "@/lib/pass-level";
import { CityForm } from "./city-form";

type CityRow = { name: string; latitude: number; longitude: number };

export default async function AdminCitiesPage() {
  await requireAdmin();

  const [cities, missing] = (await Promise.all([
    sql`select name, latitude, longitude from cities order by lower(name)`,
    // Upcoming show cities and home markets with no row: locally passed
    // comics can't see shows there (or anything, for a home market).
    sql`
      select distinct btrim(name) as name from (
        select city as name from shows where show_date >= current_date
        union
        select home_market from users where home_market is not null
      ) used
      where btrim(name) <> ''
        and not exists (select 1 from cities c where lower(c.name) = lower(btrim(used.name)))
      order by 1
    `,
  ])) as [CityRow[], { name: string }[]];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-zinc-950">Cities</h1>
        <Link href="/admin/shows" className="text-sm text-zinc-600 underline hover:text-zinc-950">
          Back to shows
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        Locally passed comics only see shows within {LOCAL_PASS_RADIUS_MILES} miles
        of their home market, measured with these coordinates. A show in a city
        that isn&apos;t listed is hidden from them. Cities are added automatically
        when the zip data knows them; leave latitude and longitude blank to look
        a city up there, or type them in for places it doesn&apos;t know.
      </p>

      {missing.length > 0 && (
        <div className="mt-6 rounded-md border border-amber-600/30 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">Missing coordinates</h2>
          <ul className="mt-2 space-y-2">
            {missing.map((m) => (
              <li key={m.name}>
                <span className="text-sm font-medium text-amber-900">{m.name}</span>
                <CityForm defaultName={m.name} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-base font-semibold text-zinc-950">Add or correct a city</h2>
      <CityForm />

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-4">City</th>
            <th className="py-2 pr-4">Latitude</th>
            <th className="py-2">Longitude</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {cities.map((c) => (
            <tr key={c.name}>
              <td className="py-2 pr-4 text-zinc-950">{c.name}</td>
              <td className="py-2 pr-4 tabular-nums text-zinc-600">{c.latitude.toFixed(4)}</td>
              <td className="py-2 tabular-nums text-zinc-600">{c.longitude.toFixed(4)}</td>
            </tr>
          ))}
          {cities.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-zinc-500">
                No cities yet. Run npm run migrate:pass-level.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
