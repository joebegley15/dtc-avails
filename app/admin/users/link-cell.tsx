"use client";

import { useState, useTransition } from "react";
import { regenerateAccessToken } from "./actions";

export function LinkCell({ userId, link }: { userId: number; link: string }) {
  const [currentLink, setCurrentLink] = useState(link);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(currentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, non-secure context); the
      // link is still visible to copy by hand, so this isn't fatal.
    }
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateAccessToken(userId);
      if (result.ok && result.link) {
        setCurrentLink(result.link);
        setConfirming(false);
      } else {
        setError(result.error ?? "Couldn't replace the link.");
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="text-sm text-zinc-500 underline hover:text-zinc-950"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-zinc-500 underline hover:text-zinc-950"
          >
            New link
          </button>
        )}
      </div>
      {confirming && (
        <span className="text-sm text-zinc-700">
          Replace this link? The old one stops working.{" "}
          <button
            type="button"
            disabled={pending}
            onClick={regenerate}
            className="font-medium text-[#C8553D] underline disabled:opacity-50"
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
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
