"use client";

import { useActionState, useState } from "react";
import { NOMINATION_NOTE_MAX } from "@/lib/nomination-message";
import { nominateComic, type NominateState } from "./actions";

const initialState: NominateState = {};

const inputClass =
  "rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

export function NominateForm() {
  const [state, formAction, pending] = useActionState(nominateComic, initialState);
  // Remount the fields after a successful nomination so they clear.
  const [submissions, setSubmissions] = useState(0);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.ok) setSubmissions((n) => n + 1);
  }

  return (
    <form
      key={submissions}
      action={formAction}
      className="mt-6 flex flex-col gap-3 rounded-md border border-black/10 p-4"
    >
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Comic&apos;s name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={state.ok ? "" : state.values?.name}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Instagram handle
        <input
          name="handle"
          required
          placeholder="@handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.ok ? "" : state.values?.handle}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Anything I should know? Where have you seen them?
        <textarea
          name="note"
          rows={3}
          maxLength={NOMINATION_NOTE_MAX}
          defaultValue={state.ok ? "" : state.values?.note}
          className={inputClass}
        />
        <span className="text-xs text-zinc-400">
          Optional, up to {NOMINATION_NOTE_MAX} characters.
        </span>
      </label>

      <div aria-live="polite" className="min-h-5 text-sm">
        {state.error && <p className="text-red-600">{state.error}</p>}
        {state.ok && (
          <p className="text-emerald-700">
            Nominated. You&apos;ll get a link to send them once it&apos;s approved.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Nominating…" : "Nominate"}
      </button>
    </form>
  );
}
