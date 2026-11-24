"use client";

import { useState, useTransition } from "react";
import { CityCombobox } from "@/components/city-combobox";
import { getInviteLink, setAllStar, setHomeMarket } from "./actions";

export function HomeMarketCell({
  userId,
  homeMarket,
}: {
  userId: number;
  homeMarket: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-0.5">
      {/* Saves when a city is picked, or when edited text is left (blank clears it). */}
      <CityCombobox
        defaultValue={homeMarket ?? ""}
        disabled={pending}
        placeholder="—"
        onCommit={(value) => {
          setError(null);
          startTransition(async () => {
            const result = await setHomeMarket(userId, value.trim());
            if (!result.ok) setError(result.error ?? "Couldn't save.");
          });
        }}
        className="w-44 rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm text-zinc-700 outline-none focus:border-[#DA1717] disabled:opacity-50"
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function AllStarToggle({
  userId,
  isAllStar,
}: {
  userId: number;
  isAllStar: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={pending}
        aria-pressed={isAllStar}
        title={isAllStar ? "Remove all-star" : "Make all-star"}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await setAllStar(userId, !isAllStar);
            if (!result.ok) setError(result.error ?? "Couldn't save.");
          });
        }}
        className={`text-lg leading-none disabled:opacity-50 ${
          isAllStar ? "text-[#DA1717]" : "text-zinc-300 hover:text-zinc-500"
        }`}
      >
        {isAllStar ? "★" : "☆"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function InviteLinkButton({ userId }: { userId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await getInviteLink(userId);
            if (!result.ok || !result.link) {
              setError(result.error ?? "Couldn't make a link.");
              return;
            }
            try {
              await navigator.clipboard.writeText(result.link);
            } catch {
              // Some browsers refuse clipboard writes after an await. The
              // row re-renders with the link's own Copy button either way.
            }
          });
        }}
        className="self-start text-sm text-zinc-500 underline hover:text-zinc-950 disabled:opacity-50"
      >
        {pending ? "Making link…" : "Get invite link"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
