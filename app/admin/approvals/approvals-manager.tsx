"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import type { ApprovedNomination, PendingNomination } from "@/lib/nominations";
import {
  formatDay,
  nominationLink,
  nominationMessage,
  timeAgo,
} from "@/lib/nomination-message";
import { approve, newLink, reject, type ApprovalResult } from "./actions";

const noopSubscribe = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

export function PendingNominations({
  nominations,
  now,
}: {
  nominations: PendingNomination[];
  /** Server time as ISO, so "how long ago" reads the same on both renders. */
  now: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Drop selections for rows that are gone after a refresh.
  const visibleSelected = nominations.filter((n) => selected.has(n.id)).map((n) => n.id);
  const allSelected = nominations.length > 0 && visibleSelected.length === nominations.length;

  function run(action: () => Promise<ApprovalResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setSelected(new Set());
      else setError(result.error ?? "Something went wrong.");
    });
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (nominations.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">Nothing waiting.</p>;
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelected(allSelected ? new Set() : new Set(nominations.map((n) => n.id)))
            }
            className="size-4 accent-[#DA1717]"
          />
          Select all
        </label>
        <button
          type="button"
          disabled={pending || visibleSelected.length === 0}
          onClick={() => run(() => approve(visibleSelected))}
          className="rounded-md bg-[#DA1717] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Approve selected{visibleSelected.length > 0 ? ` (${visibleSelected.length})` : ""}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {nominations.map((n) => (
          <li
            key={n.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-black/10 px-4 py-3"
          >
            <label className="flex min-w-0 flex-1 items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(n.id)}
                onChange={() => toggle(n.id)}
                aria-label={`Select ${n.comic_name}`}
                className="mt-1 size-4 shrink-0 accent-[#DA1717]"
              />
              <span className="min-w-0">
                <span className="block font-medium text-zinc-950">
                  {n.comic_name}
                  {n.instagram_handle && (
                    <>
                      {" "}
                      <a
                        href={`https://instagram.com/${n.instagram_handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-normal text-[#DA1717] underline"
                      >
                        @{n.instagram_handle}
                      </a>
                    </>
                  )}
                </span>
                {n.note && (
                  <span className="mt-1 block whitespace-pre-wrap text-sm text-zinc-700">
                    {n.note}
                  </span>
                )}
                <span className="mt-1 block text-sm text-zinc-500">
                  Nominated by {n.nominated_by_name} · {timeAgo(n.created_at, new Date(now))}
                </span>
              </span>
            </label>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => approve([n.id]))}
                className="rounded-md bg-[#DA1717] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => reject(n.id))}
                className="rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:border-zinc-950 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ApprovedNominations({
  nominations,
  now,
}: {
  nominations: ApprovedNomination[];
  now: string;
}) {
  if (nominations.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">None yet.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-4">Comic</th>
            <th className="py-2 pr-4">Nominated by</th>
            <th className="py-2 pr-4">Approved</th>
            <th className="py-2 pr-4">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {nominations.map((n) => (
            <ApprovedRow key={n.id} nomination={n} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovedRow({ nomination: n, now }: { nomination: ApprovedNomination; now: string }) {
  const origin = useOrigin();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const link = n.invite_token && origin ? nominationLink(origin, n.invite_token) : "";
  const expired = n.token_expires_at !== null && new Date(n.token_expires_at) <= new Date(now);

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await newLink(n.id);
      if (!result.ok) setError(result.error ?? "Couldn't replace the link.");
      setConfirming(false);
    });
  }

  return (
    <tr className="align-top">
      <td className="py-2 pr-4 font-medium text-zinc-950">{n.comic_name}</td>
      <td className="py-2 pr-4 text-zinc-600">{n.nominated_by_name}</td>
      <td className="py-2 pr-4 text-zinc-600">{timeAgo(n.reviewed_at, new Date(now))}</td>
      <td className="py-2 pr-4">
        {n.status === "signed_up" ? (
          <span className="text-sky-800">
            Used · signed up{n.signed_up_user_name ? ` as ${n.signed_up_user_name}` : ""}
          </span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className={expired ? "text-red-600" : "text-zinc-600"}>
              Not used yet ·{" "}
              {n.token_expires_at &&
                `${expired ? "expired" : "expires"} ${formatDay(n.token_expires_at)}`}
            </span>
            {!expired && link && (
              <span className="break-all text-xs text-zinc-400">{link}</span>
            )}
            <div className="flex flex-wrap items-center gap-x-3">
              {!expired && (
                <>
                  <CopyButton text={link} label="Copy link" disabled={!link} />
                  <CopyButton
                    text={nominationMessage(link)}
                    label="Copy message"
                    disabled={!link}
                  />
                </>
              )}
              {confirming ? (
                <span className="text-sm text-zinc-700">
                  Replace it? The old link stops working.{" "}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={regenerate}
                    className="font-medium text-[#DA1717] underline disabled:opacity-50"
                  >
                    {pending ? "Replacing…" : "Yes"}
                  </button>{" "}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirming(false)}
                    className="text-zinc-600 underline"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="text-sm text-zinc-500 underline hover:text-zinc-950"
                >
                  New link
                </button>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
      </td>
    </tr>
  );
}
