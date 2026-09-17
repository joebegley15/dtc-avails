"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUser, type AddUserState } from "./actions";

const initialState: AddUserState = {};

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

export function AddUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 grid grid-cols-1 gap-3 rounded-md border border-black/10 p-4 sm:grid-cols-2"
    >
      <input name="name" placeholder="Name" required className={inputClass} />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className={inputClass}
      />
      <input
        name="phoneLast4"
        placeholder="Last 4 of phone"
        required
        inputMode="numeric"
        pattern="[0-9]{4}"
        maxLength={4}
        className={inputClass}
      />
      <select name="role" defaultValue="producer" className={inputClass}>
        <option value="producer">Producer</option>
        <option value="comic">Comic</option>
      </select>
      <input
        name="homeMarket"
        placeholder="Home market (optional)"
        className={inputClass}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="checkbox" name="isAllStar" className="h-4 w-4" />
        All-star
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#DA1717] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add user"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      </div>
    </form>
  );
}
