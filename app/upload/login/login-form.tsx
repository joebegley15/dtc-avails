"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input
        type="password"
        name="password"
        placeholder="Password"
        required
        autoFocus
        className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-950 dark:border-white/10 dark:focus:border-zinc-50"
      />
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
      >
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
