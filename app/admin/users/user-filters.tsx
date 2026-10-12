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
  status,
  activated,
  shown,
  total,
}: {
  role: string;
  market: string;
  status: string;
  /** How many of all users (unfiltered) have activated their account. */
  activated: number;
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
  const [statusValue, setStatusValue] = useState(status);

  function update(next: { role?: string; market?: string; status?: string }) {
    const params = new URLSearchParams();
    const r = next.role ?? roleValue;
    const m = next.market ?? marketValue;
    const s = next.status ?? statusValue;
    setRoleValue(r);
    setMarketValue(m);
    setStatusValue(s);
    if (r) params.set("role", r);
    if (m) params.set("market", m);
    if (s) params.set("status", s);
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
      <select
        aria-label="Filter by account status"
        value={statusValue}
        onChange={(e) => update({ status: e.target.value })}
        className={selectClass}
      >
        <option value="">All accounts</option>
        <option value="activated">Activated</option>
        <option value="not-activated">Not activated</option>
      </select>
      {(roleValue || marketValue || statusValue) && (
        <button
          type="button"
          onClick={() => update({ role: "", market: "", status: "" })}
          className="text-sm text-zinc-500 underline hover:text-zinc-950"
        >
          Clear
        </button>
      )}
      <span className="text-sm text-zinc-500">
        {shown === total ? `${total} users` : `${shown} of ${total} users`}
        {" · "}
        {activated} of {total} activated
      </span>
    </div>
  );
}
