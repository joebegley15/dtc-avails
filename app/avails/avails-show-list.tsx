"use client";

import { useTransition } from "react";
import { formatShowDateTime } from "@/lib/format";
import { submitAvailability } from "./actions";

export type AvailsShowData = {
  id: number;
  date: string;
  time: string;
  city: string;
  neighborhood: string | null;
  venue: string;
  capacity: number | null;
  isAllStar: boolean;
  isTravel: boolean;
  available: boolean | null;
};

function AvailsShowCard({ show }: { show: AvailsShowData }) {
  const [isPending, startTransition] = useTransition();

  function respond(available: boolean) {
    startTransition(() => {
      submitAvailability(show.id, available);
    });
  }

  return (
    <li className="rounded-md border border-black/10 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-950">
          {formatShowDateTime(show.date, show.time)}
        </span>
        <div className="flex items-center gap-1.5">
          {show.isAllStar && <span className="text-[#DA1717]">★</span>}
          {show.isTravel && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500">
              Travel
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 text-sm text-zinc-700">
        {show.city}
        {show.neighborhood && ` (${show.neighborhood})`} — {show.venue}
      </div>
      {show.capacity != null && (
        <div className="text-xs text-zinc-500">Capacity {show.capacity}</div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={isPending}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            show.available === true
              ? "border-[#DA1717] bg-[#DA1717] text-white"
              : "border-black/10 text-zinc-700 hover:border-zinc-950"
          }`}
        >
          I&apos;m in
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={isPending}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
            show.available === false
              ? "border-zinc-950 bg-zinc-950 text-white"
              : "border-black/10 text-zinc-700 hover:border-zinc-950"
          }`}
        >
          I&apos;m out
        </button>
        <span className="ml-auto text-xs text-zinc-400">
          {show.available === true
            ? "You're in"
            : show.available === false
              ? "You're out"
              : "No response yet"}
        </span>
      </div>
    </li>
  );
}

export function AvailsShowList({ shows }: { shows: AvailsShowData[] }) {
  if (shows.length === 0) {
    return (
      <p className="text-sm text-zinc-600">No upcoming shows right now.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {shows.map((show) => (
        <AvailsShowCard key={show.id} show={show} />
      ))}
    </ul>
  );
}
