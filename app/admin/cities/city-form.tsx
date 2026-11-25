"use client";

import { useActionState } from "react";
import { saveCity, type SaveCityState } from "./actions";

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

export function CityForm({ defaultName = "" }: { defaultName?: string }) {
  const [state, formAction, pending] = useActionState<SaveCityState, FormData>(saveCity, {});

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-center gap-2">
      <input
        name="name"
        defaultValue={defaultName}
        placeholder="City, ST (as on the show)"
        required
        className={`${inputClass} w-64`}
      />
      <input name="latitude" inputMode="decimal" placeholder="Latitude" className={`${inputClass} w-32`} />
      <input name="longitude" inputMode="decimal" placeholder="Longitude" className={`${inputClass} w-32`} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#DA1717] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-emerald-600">{state.success}</p>}
    </form>
  );
}
