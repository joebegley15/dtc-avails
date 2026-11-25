import Link from "next/link";
import { HOME_MARKETS } from "@/lib/markets";
import { MARKET_RADIUS_MILES, type BookerFilters as Filters } from "@/lib/booker";

const fieldClass =
  "h-9 rounded-md border border-black/10 bg-white px-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

/** A plain GET form, so filters live in the URL and work without JavaScript. */
export function BookerFilters({
  action,
  filters,
  cities,
  showCityAndMarket = true,
}: {
  action: string;
  filters: Filters;
  cities: string[];
  showCityAndMarket?: boolean;
}) {
  return (
    <form method="get" action={action} className="mt-4 flex flex-wrap items-end gap-3 text-sm">
      {showCityAndMarket && (
        <>
          <label className="flex flex-col gap-1 text-zinc-600">
            City
            <select name="city" defaultValue={filters.city} className={fieldClass}>
              <option value="">Any city</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-zinc-600">
            Market (within {MARKET_RADIUS_MILES} mi)
            <select name="market" defaultValue={filters.market} className={fieldClass}>
              <option value="">Any market</option>
              {HOME_MARKETS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label className="flex flex-col gap-1 text-zinc-600">
        From
        <input type="date" name="from" defaultValue={filters.from} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-zinc-600">
        To
        <input type="date" name="to" defaultValue={filters.to} className={fieldClass} />
      </label>
      {filters.sort === "desc" && <input type="hidden" name="sort" value="desc" />}
      <button
        type="submit"
        className="h-9 rounded-md bg-[#DA1717] px-3 font-medium text-white"
      >
        Apply
      </button>
      <Link href={action} className="h-9 px-1 leading-9 text-zinc-500 underline hover:text-zinc-950">
        Clear
      </Link>
    </form>
  );
}
