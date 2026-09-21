"use client";

import { useState, useTransition } from "react";
import { resetToDefault } from "./actions";

export function ResetToDefaultButton({ userId }: { userId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await resetToDefault(userId);
      setMessage({ ok: result.ok, text: result.message });
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <span className="text-sm text-zinc-700">
        Reset to the default password?{" "}
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="font-medium text-[#DA1717] underline disabled:opacity-50"
        >
          {pending ? "Resetting…" : "Yes"}
        </button>{" "}
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="text-zinc-600 underline"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setConfirming(true);
        }}
        className="self-start text-sm text-zinc-500 underline hover:text-zinc-950"
      >
        Reset to default
      </button>
      {message && (
        <span className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
