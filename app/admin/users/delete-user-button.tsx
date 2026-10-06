"use client";

import { useState, useTransition } from "react";
import { deleteUser } from "./actions";

export function DeleteUserButton({ userId, name }: { userId: number; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await deleteUser(userId);
      // On success the row disappears with the revalidated page.
      if (!result.ok) setError(result.message);
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <span className="text-sm text-zinc-700">
        Delete {name} and all their avails?{" "}
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="font-medium text-[#DA1717] underline disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Yes"}
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
          setError(null);
          setConfirming(true);
        }}
        className="self-start text-sm text-red-600 underline hover:text-red-800"
      >
        Delete
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
