"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HOME_MARKETS } from "@/lib/markets";

/** Sentinel for "home market is blank or not one of HOME_MARKETS". */
export const OTHER_MARKET = "other";

const selectClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

export function UserFilters({
  role,
  market,
  shown,
  total,
}: {
  role: string;
  market: string;
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Local copies so a select shows its new value right away, not after the
  // server re-render. The page keys this component on the URL's values, so
  // back/forward navigation resets them.
  const [roleValue, setRoleValue] = useState(role);
  const [marketValue, setMarketValue] = useState(market);

  function update(next: { role?: string; market?: string }) {
    const params = new URLSearchParams();
    const r = next.role ?? roleValue;
    const m = next.market ?? marketValue;
    setRoleValue(r);
    setMarketValue(m);
    if (r) params.set("role", r);
    if (m) params.set("market", m);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <select
        aria-label="Filter by user type"
        value={roleValue}
        onChange={(e) => update({ role: e.target.value })}
        className={selectClass}
      >
        <option value="">All user types</option>
        <option value="comic">Comics</option>
        <option value="producer">Producers</option>
        <option value="admin">Admins</option>
      </select>
      <select
        aria-label="Filter by home market"
        value={marketValue}
        onChange={(e) => update({ market: e.target.value })}
        className={selectClass}
      >
        <option value="">All home markets</option>
        {HOME_MARKETS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={OTHER_MARKET}>Other / not set</option>
      </select>
      {(roleValue || marketValue) && (
        <button
          type="button"
          onClick={() => update({ role: "", market: "" })}
          className="text-sm text-zinc-500 underline hover:text-zinc-950"
        >
          Clear
        </button>
      )}
      <span className="text-sm text-zinc-500">
        {shown === total ? `${total} users` : `${shown} of ${total} users`}
      </span>
    </div>
  );
}
