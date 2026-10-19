"use client";

import { useSyncExternalStore } from "react";
import { CopyButton } from "@/components/copy-button";
import type { MyNomination } from "@/lib/nominations";
import {
  formatDay,
  nominationLink,
  nominationMessage,
} from "@/lib/nomination-message";

const noopSubscribe = () => () => {};

// The origin can only be known in the browser, so a preview deploy or a
// laptop gets links to itself.
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

const STATUS_TEXT: Record<MyNomination["status"], string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Not approved",
  signed_up: "Signed up",
};

const STATUS_STYLE: Record<MyNomination["status"], string> = {
  pending: "bg-zinc-100 text-zinc-600",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-zinc-100 text-zinc-400",
  signed_up: "bg-sky-100 text-sky-800",
};

export function MyNominations({
  nominations,
  now,
}: {
  nominations: MyNomination[];
  /** Server time as ISO, so expiry reads the same on both renders. */
  now: string;
}) {
  const origin = useOrigin();

  if (nominations.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">No nominations yet.</p>;
  }

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {nominations.map((n) => {
        const expired =
          n.token_expires_at !== null && new Date(n.token_expires_at) <= new Date(now);
        const link = n.invite_token && origin ? nominationLink(origin, n.invite_token) : "";

        return (
          <li key={n.id} className="rounded-md border border-black/10 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-medium text-zinc-950">
                {n.comic_name}
                {n.instagram_handle && (
                  <span className="font-normal text-zinc-500"> @{n.instagram_handle}</span>
                )}
              </p>
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[n.status]}`}
              >
                {STATUS_TEXT[n.status]}
              </span>
            </div>
            <p className="text-sm text-zinc-500">Nominated {formatDay(n.created_at)}</p>

            {n.status === "approved" && n.invite_token && (
              <div className="mt-2">
                {expired ? (
                  <p className="text-sm text-zinc-600">
                    This link expired. Ask Joe for a new one.
                  </p>
                ) : (
                  <>
                    <input
                      type="text"
                      readOnly
                      value={link || "Loading…"}
                      onFocus={(e) => e.target.select()}
                      aria-label={`Invite link for ${n.comic_name}`}
                      className="w-full rounded-md border border-black/10 bg-zinc-50 px-3 py-2 text-sm text-zinc-950 outline-none"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <CopyButton text={link} label="Copy link" disabled={!link} />
                      <CopyButton
                        text={nominationMessage(link)}
                        label="Copy message"
                        disabled={!link}
                      />
                      {n.token_expires_at && (
                        <span className="text-sm text-zinc-400">
                          Expires {formatDay(n.token_expires_at)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
