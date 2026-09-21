"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { formatShowDate, formatShowTime } from "@/lib/format";
import type { ProducerOption } from "@/lib/show-parsing";
import { deleteShow, toggleAllStar } from "./actions";
import { ShowEditRow } from "./show-edit-row";
import type { ShowRowData } from "./types";

const noopSubscribe = () => () => {};

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ShowsManager({
  shows,
  producers,
  serverToday,
}: {
  shows: ShowRowData[];
  producers: ProducerOption[];
  serverToday: string;
}) {
  const [filter, setFilter] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [editingState, setEditingState] = useState<{
    target: number | "new";
    saved: boolean;
  } | null>(null);
  // After a successful mutation the action resolves a beat before the
  // refreshed `shows` arrive. Until the prop changes we keep rows in their
  // pending look, so nothing flashes back to stale values.
  const [settleFrom, setSettleFrom] = useState<ShowRowData[] | null>(null);
  const settling = settleFrom === shows;
  const editing =
    editingState && !(editingState.saved && !settling)
      ? editingState.target
      : null;
  const markMutated = () => setSettleFrom(shows);

  // "Today" is the admin's own date. The server's date is only used for the
  // first paint, so hydration matches.
  const today = useSyncExternalStore(noopSubscribe, localToday, () => serverToday);

  const { visible, upcomingCount, pastCount } = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matches = shows.filter(
      (s) =>
        !q ||
        s.city.toLowerCase().includes(q) ||
        s.venue.toLowerCase().includes(q) ||
        s.producer_names.some((name) => name.toLowerCase().includes(q))
    );
    const upcoming = matches.filter((s) => s.show_date >= today);
    return {
      visible: showPast ? matches : upcoming,
      upcomingCount: upcoming.length,
      pastCount: matches.length - upcoming.length,
    };
  }, [shows, filter, showPast, today]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by city, venue, or producer"
          aria-label="Filter shows"
          className="w-72 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
            className="h-4 w-4 accent-[#DA1717]"
          />
          Show past shows
        </label>
        <button
          type="button"
          onClick={() => setEditingState({ target: "new", saved: false })}
          className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950"
        >
          Add show
        </button>
        <Link
          href="/admin/bulk-upload"
          className="ml-auto rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white"
        >
          Bulk upload
        </Link>
      </div>

      <p className="mt-4 text-sm text-zinc-600">
        {upcomingCount} upcoming show{upcomingCount === 1 ? "" : "s"}
        {showPast && ` · ${pastCount} past`}
      </p>

      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
            <th className="border-l-4 border-transparent px-2 py-2">Date</th>
            <th className="px-2 py-2">Time</th>
            <th className="px-2 py-2">City</th>
            <th className="px-2 py-2">Neighborhood</th>
            <th className="px-2 py-2">Venue</th>
            <th className="px-2 py-2">Capacity</th>
            <th className="px-2 py-2">Producers</th>
            <th className="whitespace-nowrap px-2 py-2">All-star</th>
            <th className="px-2 py-2">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {editing === "new" && (
            <ShowEditRow
              show={null}
              producers={producers}
              saving={settling}
              onSaved={() => {
                setEditingState((s) => s && { ...s, saved: true });
                markMutated();
              }}
              onCancel={() => setEditingState(null)}
            />
          )}
          {visible.map((show) =>
            editing === show.id ? (
              <ShowEditRow
                key={show.id}
                show={show}
                producers={producers}
                saving={settling}
                onSaved={() => {
                  setEditingState((s) => s && { ...s, saved: true });
                  markMutated();
                }}
                onCancel={() => setEditingState(null)}
              />
            ) : (
              <ShowRow
                key={show.id}
                show={show}
                settling={settling}
                onMutated={markMutated}
                onEdit={() => setEditingState({ target: show.id, saved: false })}
              />
            )
          )}
          {visible.length === 0 && editing !== "new" && (
            <tr>
              <td colSpan={9} className="py-6 text-center text-zinc-500">
                No shows to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ShowRow({
  show,
  settling,
  onMutated,
  onEdit,
}: {
  show: ShowRowData;
  settling: boolean;
  onMutated: () => void;
  onEdit: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, startTransition] = useTransition();
  const pending = transitioning || settling;

  function run(action: () => Promise<{ ok: boolean } & { errors?: string[] }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onMutated();
      } else {
        setError(result.errors?.join(" ") ?? "Something went wrong.");
      }
    });
  }

  return (
    <tr className={pending ? "opacity-60" : undefined}>
      <td
        className={`whitespace-nowrap border-l-4 px-2 py-2 ${
          show.is_all_star ? "border-[#DA1717]" : "border-transparent"
        }`}
      >
        {formatShowDate(show.show_date)}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-zinc-700">
        {formatShowTime(show.show_time)}
      </td>
      <td className="px-2 py-2 font-medium text-zinc-950">
        {show.is_all_star && <span className="mr-1 text-[#DA1717]">★</span>}
        {show.city}
      </td>
      <td className="px-2 py-2 text-zinc-600">{show.neighborhood ?? "—"}</td>
      <td className="px-2 py-2 text-zinc-700">{show.venue}</td>
      <td className="px-2 py-2 text-zinc-600">{show.capacity ?? "—"}</td>
      <td className="px-2 py-2 text-zinc-600">
        {show.producer_ids.length > 0
          ? show.producer_ids.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <Link
                  href={`/producer?producer=${id}`}
                  className="underline decoration-zinc-300 underline-offset-2 hover:text-[#DA1717]"
                >
                  {show.producer_names[i]}
                </Link>
              </span>
            ))
          : "—"}
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          role="switch"
          aria-checked={show.is_all_star}
          aria-label={`All-star: ${show.city}`}
          disabled={pending}
          onClick={() => run(() => toggleAllStar(show.id))}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            show.is_all_star ? "bg-[#DA1717]" : "bg-zinc-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
              show.is_all_star ? "left-[18px]" : "left-0.5"
            }`}
          />
        </button>
      </td>
      <td className="whitespace-nowrap px-2 py-2">
        {confirmingDelete ? (
          <span className="text-sm text-zinc-700">
            Delete this show?{" "}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => deleteShow(show.id))}
              className="font-medium text-[#DA1717] underline"
            >
              Yes
            </button>{" "}
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingDelete(false)}
              className="text-zinc-600 underline"
            >
              No
            </button>
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="text-sm text-zinc-600 underline hover:text-zinc-950"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="ml-3 text-sm text-zinc-600 underline hover:text-zinc-950"
            >
              Delete
            </button>
          </>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
