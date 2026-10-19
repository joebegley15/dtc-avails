"use client";

import { useRef, useState, useTransition } from "react";
import type { Role } from "@/lib/session";
import { updateUser } from "./actions";

const inputClass =
  "rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

export type EditableUser = {
  id: number;
  name: string;
  email: string | null;
  role: Role;
  has_truck: boolean | null;
};

/** "Edit" opens a dialog for the user's name, email, role and truck answer. */
export function EditUserButton({ user }: { user: EditableUser }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? "");
  const [role, setRole] = useState<Role>(user.role);
  const [truck, setTruck] = useState(
    user.has_truck === null ? "" : user.has_truck ? "yes" : "no"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    // Start from the saved values each time.
    setName(user.name);
    setEmail(user.email ?? "");
    setRole(user.role);
    setTruck(user.has_truck === null ? "" : user.has_truck ? "yes" : "no");
    setError(null);
    dialogRef.current?.showModal();
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateUser(user.id, {
        name,
        email,
        role,
        hasTruck: truck === "" ? null : truck === "yes",
      });
      if (result.ok) dialogRef.current?.close();
      else setError(result.error ?? "Couldn't save.");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="self-start text-sm text-zinc-500 underline hover:text-zinc-950"
      >
        Edit
      </button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-black/10 p-0 backdrop:bg-black/30"
      >
        <form onSubmit={save} className="flex flex-col gap-3 p-5">
          <h2 className="text-base font-semibold text-zinc-950">Edit {user.name}</h2>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              placeholder={user.email ? undefined : "None yet"}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Role
            {user.role === "admin" ? (
              <span className="px-1 py-2 text-zinc-500">Admin (can&apos;t be changed here)</span>
            ) : (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className={inputClass}
              >
                <option value="comic">Comic</option>
                <option value="producer">Producer</option>
              </select>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Has a truck
            <select value={truck} onChange={(e) => setTruck(e.target.value)} className={inputClass}>
              <option value="">Not answered</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={pending}
              className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-[#DA1717] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
