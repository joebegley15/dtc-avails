"use client";

import type { ProducerOption } from "@/lib/show-parsing";

export function ProducerPicker({
  producers,
  selected,
  onChange,
}: {
  producers: ProducerOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const names = producers
    .filter((p) => selected.includes(p.id))
    .map((p) => p.name);

  function toggle(id: number) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  }

  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-md border border-black/10 px-2 py-1 text-sm text-zinc-950 marker:content-none">
        {names.length > 0 ? names.join(", ") : "Select producers"}
      </summary>
      <div className="absolute left-0 z-10 mt-1 max-h-56 w-56 overflow-auto rounded-md border border-black/10 bg-white p-2">
        {producers.map((p) => (
          <label key={p.id} className="flex items-center gap-2 py-0.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggle(p.id)}
              className="h-4 w-4 accent-[#DA1717]"
            />
            {p.name}
          </label>
        ))}
        {producers.length === 0 && (
          <p className="text-sm text-zinc-500">No producers yet.</p>
        )}
      </div>
    </details>
  );
}
