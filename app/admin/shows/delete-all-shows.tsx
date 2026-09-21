"use client";

import { useState, useTransition } from "react";
import { checkPasswordForDeleteAll, deleteAllShows } from "./actions";

type Step = "closed" | "password" | "confirm";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function DeleteAllShows({
  total,
  availsCount,
}: {
  total: number;
  availsCount: number;
}) {
  const [step, setStep] = useState<Step>("closed");
  // Kept only in memory while the panel is open, so the final delete can send
  // it again and the server can check it again.
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setStep("closed");
    setPassword("");
    setError(null);
  }

  function checkPassword() {
    setError(null);
    startTransition(async () => {
      const result = await checkPasswordForDeleteAll(password);
      if (result.ok) {
        setStep("confirm");
      } else {
        setError(result.error ?? "Incorrect password.");
        setPassword("");
      }
    });
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAllShows(password);
      if (result.ok) {
        setDeleted(result.deleted);
        close();
      } else {
        // e.g. the password check failed this time; start over.
        setError(result.error);
        setPassword("");
        setStep("password");
      }
    });
  }

  if (deleted !== null) {
    return (
      <p role="status" className="text-sm font-medium text-emerald-700">
        Deleted {plural(deleted, "show")}.
      </p>
    );
  }

  if (total === 0) return null;

  if (step === "closed") {
    return (
      <button
        type="button"
        onClick={() => setStep("password")}
        className="text-sm text-[#DA1717] underline hover:text-[#5A0000]"
      >
        Delete all shows
      </button>
    );
  }

  return (
    <div className="basis-full rounded-md border border-[#DA1717]/40 bg-red-50 p-4">
      <p className="text-sm font-medium text-[#5A0000]">
        Delete all {plural(total, "show")}?
      </p>
      <p className="mt-1 text-sm text-zinc-700">
        This permanently deletes every show, past and upcoming, along with
        their producer assignments
        {availsCount > 0 && (
          <>
            {" "}
            and the <strong>{plural(availsCount, "avail")}</strong> comics have
            submitted for them
          </>
        )}
        . Producers and comics themselves aren&apos;t affected. It
        can&apos;t be undone.
      </p>

      {step === "password" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            checkPassword();
          }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password to continue"
            aria-label="Your password"
            autoComplete="current-password"
            autoFocus
            required
            className="w-72 rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]"
          />
          <button
            type="submit"
            disabled={pending || password === ""}
            className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Checking…" : "Continue"}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="text-sm text-zinc-600 underline hover:text-zinc-950"
          >
            Cancel
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="w-full text-sm font-medium text-zinc-950">
            Password accepted. Are you sure you want to delete everything?
          </p>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Deleting…" : `Yes, delete all ${plural(total, "show")}`}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
