"use client";

import { useMemo, useState } from "react";

export type ProducerOption = { id: number; name: string };

export type ShowCardData = {
  id: number;
  date: string;
  time: string;
  city: string;
  neighborhood: string | null;
  venue: string;
  capacity: number | null;
  isAllStar: boolean;
  producerIds: number[];
  producerNames: string[];
  inCount: number;
  outCount: number;
  noResponseCount: number;
  availableComics: {
    id: number;
    name: string;
    email: string;
    homeMarket: string | null;
    isAllStar: boolean;
    isTravel: boolean;
  }[];
};

function formatShowDateTime(dateStr: string, timeStr: string): string {
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  const datePart = dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timePart = dt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

function AllStarBadge() {
  return <span className="text-[#DA1717]">★</span>;
}

function CopyEmailsButton({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(emails.join(", "));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      disabled={emails.length === 0}
      className="mt-3 rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-950 disabled:opacity-50"
    >
      {copied ? "Copied!" : "Copy emails"}
    </button>
  );
}

function ShowCard({
  show,
  expanded,
  onToggle,
}: {
  show: ShowCardData;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-md border border-black/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-1 px-4 py-3 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-950">
            {formatShowDateTime(show.date, show.time)}
          </span>
          {show.isAllStar && (
            <span className="flex items-center gap-1 text-xs font-medium text-[#DA1717]">
              <AllStarBadge /> All-Star
            </span>
          )}
        </div>
        <div className="text-sm text-zinc-700">
          {show.city}
          {show.neighborhood && ` (${show.neighborhood})`} — {show.venue}
        </div>
        <div className="text-xs text-zinc-500">
          Capacity {show.capacity ?? "—"} · Producers:{" "}
          {show.producerNames.length > 0 ? show.producerNames.join(", ") : "—"}
        </div>
        <div className="text-xs font-medium text-zinc-700">
          {show.inCount} in / {show.outCount} out / {show.noResponseCount} no response
        </div>
      </button>

      {expanded && (
        <div className="border-t border-black/10 px-4 py-3">
          {show.availableComics.length === 0 ? (
            <p className="text-sm text-zinc-500">No comics available yet.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {show.availableComics.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium text-zinc-950">{c.name}</span>
                    {c.isAllStar && <AllStarBadge />}
                    {c.isTravel && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                        Travel
                      </span>
                    )}
                    <span className="text-zinc-500">{c.email}</span>
                    {c.homeMarket && (
                      <span className="text-zinc-400">· {c.homeMarket}</span>
                    )}
                  </li>
                ))}
              </ul>
              <CopyEmailsButton emails={show.availableComics.map((c) => c.email)} />
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function ProducerShowsView({
  shows,
  producers,
  isAdmin,
}: {
  shows: ShowCardData[];
  producers: ProducerOption[];
  isAdmin: boolean;
}) {
  const [selectedProducerId, setSelectedProducerId] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const filteredShows = useMemo(() => {
    if (!isAdmin || selectedProducerId === "all") return shows;
    const id = Number(selectedProducerId);
    return shows.filter((s) => s.producerIds.includes(id));
  }, [shows, isAdmin, selectedProducerId]);

  function toggle(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      {isAdmin && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Producer
          </label>
          <select
            value={selectedProducerId}
            onChange={(e) => setSelectedProducerId(e.target.value)}
            className="w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]"
          >
            <option value="all">All producers</option>
            {producers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredShows.length === 0 ? (
        <p className="text-sm text-zinc-600">
          You don&apos;t have any upcoming shows yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredShows.map((show) => (
            <ShowCard
              key={show.id}
              show={show}
              expanded={expandedIds.has(show.id)}
              onToggle={() => toggle(show.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
