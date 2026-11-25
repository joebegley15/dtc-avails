"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CityCombobox } from "@/components/city-combobox";
import { roleLabel, type Role } from "@/lib/roles";
import type { CreateUserState } from "@/lib/user-create";

const initialState: CreateUserState = {};

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

/**
 * One account at a time: the admin's "Add user" and the Lead Producer's
 * "Create user". `roles` is only what the form offers; the server action
 * decides what this user may actually create.
 */
export function CreateUserForm({
  action,
  roles,
  allowAllStar,
  submitLabel = "Add user",
}: {
  action: (state: CreateUserState, formData: FormData) => Promise<CreateUserState>;
  roles: Role[];
  allowAllStar: boolean;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [role, setRole] = useState<Role>(roles[0]);
  const formRef = useRef<HTMLFormElement>(null);
  const isComic = role === "comic";

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
      <input name="name" placeholder="Name" required maxLength={100} className={inputClass} />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className={inputClass}
      />
      <input
        name="password"
        type="password"
        placeholder="Starting password (min 6 characters)"
        required
        minLength={6}
        autoComplete="new-password"
        className={inputClass}
      />
      <select
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className={inputClass}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <CityCombobox
        name="homeMarket"
        placeholder={isComic ? "Home city (required for comics)" : "Home city (optional)"}
        required={isComic}
        className={inputClass}
      />
      {isComic ? (
        <select name="passLevel" defaultValue="full" className={inputClass} aria-label="Pass level">
          <option value="full">Fully passed: any show in TX/OK</option>
          <option value="local">Locally passed: shows near home only</option>
        </select>
      ) : (
        <span />
      )}
      {allowAllStar && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="isAllStar" className="h-4 w-4" />
          All-star
        </label>
      )}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#DA1717] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : submitLabel}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-600">{state.success}</p>}
      </div>
    </form>
  );
}
