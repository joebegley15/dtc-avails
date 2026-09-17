"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "./actions";

const initialState: AdminLoginState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input
        type="password"
        name="password"
        placeholder="Admin password"
        required
        autoFocus
        className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#DA1717] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
