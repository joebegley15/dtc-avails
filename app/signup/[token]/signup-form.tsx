"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptInviteState } from "./actions";

const initialState: AcceptInviteState = {};

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

export function SignupForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvite, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        autoFocus
        defaultValue={state.values?.email}
        className={inputClass}
      />
      <input
        name="username"
        placeholder="Username (optional)"
        autoCapitalize="none"
        autoComplete="username"
        spellCheck={false}
        defaultValue={state.values?.username}
        className={inputClass}
      />
      <input
        name="homeMarket"
        placeholder="Home market (optional)"
        defaultValue={state.values?.homeMarket}
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        minLength={8}
        autoComplete="new-password"
        className={inputClass}
      />
      <input
        name="confirm"
        type="password"
        placeholder="Confirm password"
        required
        minLength={8}
        autoComplete="new-password"
        className={inputClass}
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#DA1717] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
