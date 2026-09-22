"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import type { InviteRow } from "@/lib/invites";
import { createInviteLink, revokeInviteLink } from "./actions";

const noopSubscribe = () => () => {};

// The origin can only be known in the browser; the server-rendered link (if
// any) would show the wrong host on a preview deploy or a teammate's laptop.
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => ""
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function InviteManager({ invites }: { invites: InviteRow[] }) {
  const router = useRouter();
  const origin = useOrigin();
  const [role, setRole] = useState<"comic" | "producer">("comic");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const link = token && origin ? `${origin}/signup/${token}` : "";

  function generate() {
    setError(null);
    setToken(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createInviteLink(role);
      if (result.ok) {
        setToken(result.token);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, non-secure context); the
      // link is still selectable in the input, so this isn't fatal.
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-black/10 p-4">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "comic" | "producer")}
          disabled={pending}
          className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]"
        >
          <option value="comic">Comic</option>
          <option value="producer">Producer</option>
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate invite link"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {token && (
        <div className="mt-3 rounded-md border border-emerald-600/30 bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-800">
            Copy it now — it won&apos;t be shown again.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={link || "Loading…"}
              onFocus={(e) => e.target.select()}
              aria-label="Invite link"
              className="w-full min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950 outline-none sm:w-auto"
            />
            <button
              type="button"
              onClick={copyLink}
              disabled={!link}
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950 disabled:opacity-50"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">By</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {invites.map((invite) => (
            <InviteRowItem key={invite.id} invite={invite} />
          ))}
          {invites.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-zinc-500">
                No invites yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InviteRowItem({ invite }: { invite: InviteRow }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke() {
    startTransition(async () => {
      const result = await revokeInviteLink(invite.id);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error ?? "Couldn't revoke that link.");
        setConfirming(false);
      }
    });
  }

  return (
    <tr>
      <td className="py-2 pr-4 capitalize text-zinc-950">{invite.role}</td>
      <td className="py-2 pr-4 text-zinc-600">{formatDateTime(invite.created_at)}</td>
      <td className="py-2 pr-4 text-zinc-600">{invite.created_by_name}</td>
      <td className="py-2 pr-4">
        {invite.used_at ? (
          <span className="text-zinc-600">
            Used by {invite.used_by_name ?? "someone"} · {formatDateTime(invite.used_at)}
          </span>
        ) : (
          <span className="font-medium text-emerald-700">Pending</span>
        )}
      </td>
      <td className="py-2">
        {invite.used_at ? null : confirming ? (
          <span className="text-sm text-zinc-700">
            Revoke this link?{" "}
            <button
              type="button"
              disabled={pending}
              onClick={revoke}
              className="font-medium text-[#DA1717] underline disabled:opacity-50"
            >
              {pending ? "Revoking…" : "Yes"}
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
            Revoke
          </button>
        )}
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </td>
    </tr>
  );
}
