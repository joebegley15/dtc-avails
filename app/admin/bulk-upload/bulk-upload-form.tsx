"use client";

import Papa from "papaparse";
import { useState, useTransition } from "react";
import { formatShowDate, formatShowTime } from "@/lib/format";
import {
  importShows,
  validateShows,
  type CsvRow,
  type PreviewRow,
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
] as const;

export function BulkUploadForm() {
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Changing the key remounts the file input, which clears its selection.
  const [inputKey, setInputKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCsvRows(null);
    setPreview(null);
    setError(null);
    setInputKey((k) => k + 1);
  }

  function handleFile(file: File) {
    setCsvRows(null);
    setPreview(null);
    setError(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim().toLowerCase(),
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

        startTransition(async () => {
          const result = await validateShows(rows);
          if ("error" in result) {
            setError(result.error);
          } else {
            setPreview(result.rows);
          }
        });
      },
      error: (err) => setError(`Couldn't read that file: ${err.message}`),
    });
  }

  function handleImport() {
    if (!csvRows) return;
    startTransition(async () => {
      // On success the action redirects to /admin/shows.
      const result = await importShows(csvRows);
      if (result?.error) setError(result.error);
    });
  }

  const ready = preview?.filter((r) => r.show && !r.duplicate).length ?? 0;
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
              disabled={pending || ready === 0}
              className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Working…" : `Import ${ready} show${ready === 1 ? "" : "s"}`}
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
          </p>

          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Row</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">City</th>
                <th className="px-2 py-2">Neighborhood</th>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Venue</th>
                <th className="px-2 py-2">Capacity</th>
                <th className="px-2 py-2">Producers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {preview.map((r) => (
                <PreviewTableRow key={r.row} row={r} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function PreviewTableRow({ row }: { row: PreviewRow }) {
  const { raw, show } = row;
  const hasErrors = row.errors.length > 0;

  const rowClass = hasErrors
    ? "bg-red-50 align-top"
    : row.duplicate
      ? "bg-zinc-100 align-top text-zinc-400"
      : "align-top text-zinc-800";

  return (
    <tr className={rowClass}>
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
        {show ? row.producerNames.join(", ") : raw.producer}
      </td>
    </tr>
  );
}
