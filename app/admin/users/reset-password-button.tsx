"use client";

import { useActionState, useState } from "react";
import { resetPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordButton({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: ResetPasswordState, formData: FormData) => {
      const result = await resetPassword(prev, formData);
      if (result.success) setOpen(false);
      return result;
    },
    initialState
  );

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-zinc-500 underline hover:text-zinc-950"
        >
          Reset password
        </button>
        {state.success && (
          <span className="text-sm text-emerald-600">{state.success}</span>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex items-center gap-2">
        <input
          type="password"
          name="password"
          placeholder="New password"
          required
          minLength={6}
          autoFocus
          autoComplete="new-password"
          className="w-40 rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm text-zinc-950 outline-none focus:border-[#DA1717]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#DA1717] px-2 py-1 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-zinc-500 underline hover:text-zinc-950"
        >
          Cancel
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
