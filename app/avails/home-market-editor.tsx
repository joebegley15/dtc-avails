"use client";

import { useState, useTransition } from "react";
import { HomeMarketSelect } from "@/components/home-market-select";
import { setOwnHomeMarket } from "./actions";

const selectClass =
  "h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

/**
 * The comedian's own home market on /avails. When it isn't set, it's a
 * highlighted prompt so new signups set it before answering shows.
 */
export function HomeMarketEditor({
  homeMarket,
  selectValue,
}: {
  /** As stored, for display. */
  homeMarket: string | null;
  /** The matching list entry, or "" if none matches. */
  selectValue: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(selectValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    setError(null);
    startSaving(async () => {
      const result = await setOwnHomeMarket(value);
      if (result.ok) setEditing(false);
      else setError(result.error ?? "Couldn't save. Try again.");
    });
  }

  const picker = (
    <div className="flex flex-wrap items-center gap-2">
      <HomeMarketSelect
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={saving}
        emptyLabel="Pick your home market"
        aria-label="Home market"
        className={selectClass}
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || value === ""}
        className="h-9 rounded-md bg-[#DA1717] px-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {homeMarket && (
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(selectValue);
            setError(null);
          }}
          disabled={saving}
          className="text-sm text-zinc-500 underline hover:text-zinc-950"
        >
          Cancel
        </button>
      )}
    </div>
  );

  if (!homeMarket) {
    return (
      <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
        <p className="text-sm font-medium text-amber-900">Set your home market</p>
        <p className="mb-2 text-sm text-amber-800">
          Where you&apos;re based. It tells us which shows are travel for you, so
          we can book you the right way.
        </p>
        {picker}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="text-sm text-zinc-500">
      {editing ? (
        <div className="mt-1">
          {picker}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <p>
          Home market: {homeMarket}{" "}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-zinc-500 underline hover:text-zinc-950"
          >
            Change
          </button>
        </p>
      )}
    </div>
  );
}
