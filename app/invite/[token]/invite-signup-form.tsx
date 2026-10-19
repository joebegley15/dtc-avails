"use client";

import { useActionState } from "react";
import { HomeMarketSelect } from "@/components/home-market-select";
import { signUpFromInvite, type InviteSignupState } from "./actions";

const initialState: InviteSignupState = {};

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

export function InviteSignupForm({ token, name }: { token: string; name: string }) {
  const [state, formAction, pending] = useActionState(signUpFromInvite, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Name
        <input
          name="name"
          required
          maxLength={100}
          autoComplete="name"
          defaultValue={state.values?.name ?? name}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-zinc-700">
        Email (you&apos;ll sign in with this)
        <input
          name="email"
          type="email"
          required
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          defaultValue={state.values?.email}
          className={inputClass}
        />
      </label>
      <HomeMarketSelect
        // Keyed on the echoed value: a select only reads defaultValue on mount.
        key={state.values?.homeMarket ?? ""}
        name="homeMarket"
        aria-label="Home market"
        defaultValue={state.values?.homeMarket ?? ""}
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        aria-label="Password"
        required
        minLength={8}
        autoComplete="new-password"
        className={inputClass}
      />
      <input
        name="confirm"
        type="password"
        placeholder="Confirm password"
        aria-label="Confirm password"
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
