"use client";

import Papa from "papaparse";
import { useRef, useState, useTransition } from "react";
import { formatShowDate, formatShowTime } from "@/lib/format";
import type { ProducerOption } from "@/lib/show-parsing";
import { ProducerPicker } from "../shows/producer-picker";
import {
  importShows,
  validateShows,
  type CsvRow,
  type PreviewRow,
  type ProducerPicks,
} from "./actions";

const REQUIRED_HEADERS = ["city", "date", "time", "producer", "venue"];
const KNOWN_HEADERS = [
  "city",
  "neighborhood",
  "date",
  "time",
  "producer",
  "venue",
  "capacity",
  "all_star",
] as const;

// Other spellings people use for the all-star column.
const HEADER_ALIASES: Record<string, string> = {
  "all-star": "all_star",
  "all star": "all_star",
  allstar: "all_star",
  is_all_star: "all_star",
  star: "all_star",
};

// Only rows that would actually be imported can be checked or unchecked.
const isSelectable = (r: PreviewRow) => r.show !== null && !r.duplicate;

export function BulkUploadForm({ producers }: { producers: ProducerOption[] }) {
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  // Row numbers the admin has unchecked. Everything else importable is in.
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  // Producers picked by hand for rows whose CSV names didn't match.
  const [picks, setPicks] = useState<ProducerPicks>({});
  // Only the latest validation may update the preview.
  const validationSeq = useRef(0);
  const [error, setError] = useState<string | null>(null);
  // Changing the key remounts the file input, which clears its selection.
  const [inputKey, setInputKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCsvRows(null);
    setPreview(null);
    setExcluded(new Set());
    setPicks({});
    setError(null);
    setInputKey((k) => k + 1);
  }

  function handleFile(file: File) {
    setCsvRows(null);
    setPreview(null);
    setExcluded(new Set());
    setPicks({});
    setError(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => {
        const key = h.trim().toLowerCase();
        return HEADER_ALIASES[key] ?? key;
      },
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length > 0) {
          setError(`The CSV is missing required column(s): ${missing.join(", ")}.`);
          return;
        }
        if (results.data.length === 0) {
          setError("The file has no data rows.");
          return;
        }

        const rows = results.data.map((r) => {
          const row = {} as CsvRow;
          for (const h of KNOWN_HEADERS) row[h] = String(r[h] ?? "");
          return row;
        });
        setCsvRows(rows);
        revalidate(rows, {});
      },
      error: (err) => setError(`Couldn't read that file: ${err.message}`),
    });
  }

  function revalidate(rows: CsvRow[], nextPicks: ProducerPicks) {
    const seq = ++validationSeq.current;
    startTransition(async () => {
      const result = await validateShows(rows, nextPicks);
      if (seq !== validationSeq.current) return;
      if ("error" in result) {
        setError(result.error);
      } else {
        setPreview(result.rows);
      }
    });
  }

  /** ids null goes back to the names in the CSV. */
  function pickProducers(row: number, ids: number[] | null) {
    if (!csvRows) return;
    const next = { ...picks };
    if (ids) next[row] = ids;
    else delete next[row];
    setPicks(next);
    revalidate(csvRows, next);
  }

  function handleImport() {
    if (!csvRows) return;
    startTransition(async () => {
      // On success the action redirects to /admin/shows.
      const result = await importShows(csvRows, [...excluded], picks);
      if (result?.error) setError(result.error);
    });
  }

  function toggleRow(row: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(row)) next.delete(row);
      else next.add(row);
      return next;
    });
  }

  const selectable = preview?.filter(isSelectable) ?? [];
  const selectedCount = selectable.filter((r) => !excluded.has(r.row)).length;
  const allSelected = selectable.length > 0 && selectedCount === selectable.length;
  const someSelected = selectedCount > 0 && !allSelected;

  function toggleAll() {
    setExcluded(allSelected ? new Set(selectable.map((r) => r.row)) : new Set());
  }

  const ready = selectable.length;
  const errorCount = preview?.filter((r) => r.errors.length > 0).length ?? 0;
  const duplicateCount = preview?.filter((r) => r.duplicate).length ?? 0;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          key={inputKey}
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="text-sm text-zinc-700 file:mr-3 file:rounded-md file:border file:border-black/10 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800"
        />
        {preview && (
          <>
            <button
              type="button"
              onClick={handleImport}
              disabled={pending || selectedCount === 0}
              className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending
                ? "Working…"
                : `Import ${selectedCount} show${selectedCount === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {pending && !preview && (
        <p className="mt-4 text-sm text-zinc-500">Checking rows…</p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {preview && (
        <>
          <p className="mt-6 text-sm font-medium text-zinc-800">
            {ready} ready, {errorCount} error{errorCount === 1 ? "" : "s"},{" "}
            {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"}
            <span className="font-normal text-zinc-500">
              {" "}
              · {selectedCount} selected to import
            </span>
          </p>

          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all importable shows"
                    checked={allSelected}
                    disabled={ready === 0 || pending}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[#DA1717]"
                  />
                </th>
                <th className="px-2 py-2">Row</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">City</th>
                <th className="px-2 py-2">Neighborhood</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Venue</th>
                <th className="px-2 py-2">Capacity</th>
                <th className="px-2 py-2">All-star</th>
                <th className="px-2 py-2">Producers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {preview.map((r) => (
                <PreviewTableRow
                  key={r.row}
                  row={r}
                  selected={!excluded.has(r.row)}
                  disabled={pending}
                  onToggle={() => toggleRow(r.row)}
                  producers={producers}
                  pickedIds={picks[r.row]}
                  onPick={(ids) => pickProducers(r.row, ids)}
                />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function PreviewTableRow({
  row,
  selected,
  disabled,
  onToggle,
  producers,
  pickedIds,
  onPick,
}: {
  row: PreviewRow;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  producers: ProducerOption[];
  pickedIds: number[] | undefined;
  onPick: (ids: number[] | null) => void;
}) {
  const { raw, show } = row;
  const hasErrors = row.errors.length > 0;
  const selectable = isSelectable(row);
  const unchecked = selectable && !selected;

  const rowClass = hasErrors
    ? "bg-red-50 align-top"
    : row.duplicate
      ? "bg-zinc-100 align-top text-zinc-400"
      : unchecked
        ? "align-top text-zinc-400"
        : "align-top text-zinc-800";

  // Names that weren't an exact match, so the admin can check them.
  const notes = row.producerMatches.filter((m) => m.how !== "exact");
  // Unmatched producers can be filled in by hand; keep the picker once used.
  const showPicker = row.producerErrors.length > 0 || row.producerPicked;

  return (
    <tr className={rowClass}>
      <td className="px-2 py-2">
        <input
          type="checkbox"
          aria-label={`Import row ${row.row}`}
          checked={selectable && selected}
          disabled={!selectable || disabled}
          onChange={onToggle}
          className="h-4 w-4 accent-[#DA1717]"
        />
      </td>
      <td className="px-2 py-2">{row.row}</td>
      <td className="px-2 py-2">
        {hasErrors ? (
          <ul className="list-disc pl-4 text-red-700">
            {row.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : row.duplicate ? (
          <span>
            Duplicate, will skip
            {row.duplicate === "in-file" && " (repeated in this file)"}
          </span>
        ) : unchecked ? (
          <span>Unchecked, won&apos;t import</span>
        ) : (
          <span className="font-medium text-emerald-700">Ready</span>
        )}
      </td>
      <td className="px-2 py-2">{show?.city ?? raw.city}</td>
      <td className="px-2 py-2">{show ? (show.neighborhood ?? "—") : raw.neighborhood}</td>
      <td className="whitespace-nowrap px-2 py-2">
        {show ? formatShowDate(show.showDate, true) : raw.date}
      </td>
      <td className="whitespace-nowrap px-2 py-2">
        {show ? formatShowTime(show.showTime) : raw.time}
      </td>
      <td className="px-2 py-2">{show?.venue ?? raw.venue}</td>
      <td className="px-2 py-2">{show ? (show.capacity ?? "—") : raw.capacity}</td>
      <td className="px-2 py-2">
        {show ? (show.isAllStar ? <span className="text-[#DA1717]">★</span> : "—") : raw.all_star}
      </td>
      <td className="px-2 py-2">
        {showPicker ? (
          <ProducerCellPicker
            raw={raw.producer}
            producers={producers}
            selected={pickedIds ?? row.producerIds}
            picked={row.producerPicked}
            onPick={onPick}
          />
        ) : show ? (
          row.producerNames.join(", ")
        ) : (
          raw.producer
        )}
        {!row.producerPicked && notes.map((m) => (
          <p
            key={m.input}
            className={`mt-0.5 text-xs ${
              m.how === "spelling" ? "text-amber-700" : "text-zinc-500"
            }`}
          >
            &ldquo;{m.input}&rdquo; → {m.name}{" "}
            {m.how === "initial"
              ? "(matched by first initial)"
              : "(similar spelling, please check)"}
          </p>
        ))}
      </td>
    </tr>
  );
}

function ProducerCellPicker({
  raw,
  producers,
  selected,
  picked,
  onPick,
}: {
  raw: string;
  producers: ProducerOption[];
  selected: number[];
  picked: boolean;
  onPick: (ids: number[] | null) => void;
}) {
  return (
    <div className="text-zinc-800">
      <ProducerPicker producers={producers} selected={selected} onChange={onPick} />
      <p className="mt-0.5 text-xs text-zinc-500">
        CSV: {raw.trim() ? <>&ldquo;{raw}&rdquo;</> : "(blank)"}
        {picked && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="ml-2 underline hover:text-zinc-950"
          >
            Use CSV
          </button>
        )}
      </p>
    </div>
  );
}
