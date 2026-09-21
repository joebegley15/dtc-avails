"use client";

import { useState, useTransition } from "react";
import type { ProducerOption } from "@/lib/show-parsing";
import { createShow, updateShow, type ShowFormValues } from "./actions";
import { ProducerPicker } from "./producer-picker";
import type { ShowRowData } from "./types";

const inputClass =
  "w-full min-w-0 rounded-md border border-black/10 bg-white px-2 py-1 text-sm text-zinc-950 outline-none focus:border-[#DA1717]";

function initialValues(
  show: ShowRowData | null,
  producers: ProducerOption[]
): ShowFormValues {
  if (!show) {
    return {
      city: "",
      neighborhood: "",
      date: "",
      time: "",
      venue: "",
      capacity: "",
      producerIds: [],
    };
  }
  const selectable = new Set(producers.map((p) => p.id));
  return {
    city: show.city,
    neighborhood: show.neighborhood ?? "",
    date: show.show_date,
    time: show.show_time,
    venue: show.venue,
    capacity: show.capacity === null ? "" : String(show.capacity),
    // Only producer/admin users can be picked, so drop any other link.
    producerIds: show.producer_ids.filter((id) => selectable.has(id)),
  };
}

/** Inline row used for both editing an existing show and adding a new one. */
export function ShowEditRow({
  show,
  producers,
  saving,
  onSaved,
  onCancel,
}: {
  /** null means "add a new show". */
  show: ShowRowData | null;
  producers: ProducerOption[];
  /** True from a successful save until the refreshed list arrives. */
  saving: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(() => initialValues(show, producers));
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const busy = pending || saving;

  function set<K extends keyof ShowFormValues>(key: K, value: ShowFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = show
        ? await updateShow(show.id, values)
        : await createShow(values);
      if (result.ok) {
        onSaved();
      } else {
        setErrors(result.errors);
      }
    });
  }

  return (
    <>
      <tr className="bg-zinc-50 align-top">
        <td className="border-l-4 border-transparent px-2 py-2">
          <input
            type="date"
            value={values.date}
            onChange={(e) => set("date", e.target.value)}
            aria-label="Date"
            className={inputClass}
          />
        </td>
        <td className="px-2 py-2">
          <input
            type="time"
            value={values.time}
            onChange={(e) => set("time", e.target.value)}
            aria-label="Time"
            className={inputClass}
          />
        </td>
        <td className="px-2 py-2">
          <input
            value={values.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="City"
            aria-label="City"
            className={inputClass}
          />
        </td>
        <td className="px-2 py-2">
          <input
            value={values.neighborhood}
            onChange={(e) => set("neighborhood", e.target.value)}
            placeholder="Neighborhood"
            aria-label="Neighborhood"
            className={inputClass}
          />
        </td>
        <td className="px-2 py-2">
          <input
            value={values.venue}
            onChange={(e) => set("venue", e.target.value)}
            placeholder="Venue"
            aria-label="Venue"
            className={inputClass}
          />
        </td>
        <td className="px-2 py-2">
          <input
            type="number"
            min={0}
            value={values.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            placeholder="Capacity"
            aria-label="Capacity"
            className={inputClass}
          />
        </td>
        <td className="px-2 py-2">
          <ProducerPicker
            producers={producers}
            selected={values.producerIds}
            onChange={(ids) => set("producerIds", ids)}
          />
        </td>
        <td className="px-2 py-2 text-zinc-400">—</td>
        <td className="whitespace-nowrap px-2 py-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-md bg-[#DA1717] px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="ml-2 text-sm text-zinc-600 underline hover:text-zinc-950"
          >
            Cancel
          </button>
        </td>
      </tr>
      {errors.length > 0 && (
        <tr className="bg-zinc-50">
          <td colSpan={9} className="border-l-4 border-transparent px-2 pb-3">
            <ul className="list-disc pl-5 text-sm text-red-600">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
