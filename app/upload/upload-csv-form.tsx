"use client";

import { useState, useTransition } from "react";
import { checkCsv, commitCsv, type CommitResult } from "./actions";
import type { ParseResult } from "./csv";

const PLACEHOLDER = `city,neighborhood,date,time,producer,venue,capacity
"Austin, TX",East Austin,2026-09-18,19:00,Hunter Duncan,Cape Bottle Room,`;

export function UploadCsvForm() {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const validCount =
    preview?.rows.filter(
      (r) => r.errors.length === 0 && !r.duplicateInFile && !r.duplicateInDb
    ).length ?? 0;

  function handlePreview() {
    setCommitResult(null);
    startTransition(async () => {
      const res = await checkCsv(csvText);
      setPreview(res);
    });
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await commitCsv(csvText);
      setCommitResult(res);
      setPreview(null);
      setCsvText("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={csvText}
        onChange={(e) => {
          setCsvText(e.target.value);
          setPreview(null);
          setCommitResult(null);
        }}
        placeholder={PLACEHOLDER}
        rows={10}
        className="w-full rounded-md border border-black/10 bg-transparent p-3 font-mono text-xs outline-none focus:border-zinc-950 dark:border-white/10 dark:focus:border-zinc-50"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPending || !csvText.trim()}
          className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/10"
        >
          {isPending && !preview ? "Checking…" : "Preview"}
        </button>
        {preview && !preview.headerError && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || validCount === 0}
            className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {isPending
              ? "Uploading…"
              : `Upload ${validCount} new show${validCount === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      {preview?.headerError && (
        <p className="text-sm text-red-600 dark:text-red-400">{preview.headerError}</p>
      )}

      {preview && !preview.headerError && (
        <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">City</th>
                <th className="px-2 py-1.5">Neighborhood</th>
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Time</th>
                <th className="px-2 py-1.5">Venue</th>
                <th className="px-2 py-1.5">Capacity</th>
                <th className="px-2 py-1.5">Producer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/10">
              {preview.rows.map((r) => {
                const status =
                  r.errors.length > 0
                    ? { label: r.errors.join("; "), className: "text-red-600 dark:text-red-400" }
                    : r.duplicateInDb
                    ? {
                        label: "Duplicate (already in avails)",
                        className: "text-amber-600 dark:text-amber-400",
                      }
                    : r.duplicateInFile
                    ? {
                        label: "Duplicate (repeated in paste)",
                        className: "text-amber-600 dark:text-amber-400",
                      }
                    : { label: "New", className: "text-emerald-600 dark:text-emerald-400" };
                return (
                  <tr key={r.line}>
                    <td className={`px-2 py-1.5 font-medium ${status.className}`}>
                      {status.label}
                    </td>
                    <td className="px-2 py-1.5">{r.city}</td>
                    <td className="px-2 py-1.5">{r.neighborhood ?? ""}</td>
                    <td className="px-2 py-1.5">{r.showDate}</td>
                    <td className="px-2 py-1.5">{r.showTime}</td>
                    <td className="px-2 py-1.5">{r.venue}</td>
                    <td className="px-2 py-1.5">{r.capacity ?? ""}</td>
                    <td className="px-2 py-1.5">
                      {r.producerName}
                      {r.producerName && !r.producerId && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                          (no match)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {preview && preview.unmatchedProducers.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No matching user found for: {preview.unmatchedProducers.join(", ")}. These shows will
          be added without a linked producer.
        </p>
      )}

      {commitResult && (
        <div className="rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-300">
          Added {commitResult.inserted} show{commitResult.inserted === 1 ? "" : "s"}.
          {commitResult.skippedDuplicates > 0 &&
            ` Skipped ${commitResult.skippedDuplicates} duplicate(s).`}
          {commitResult.skippedInvalid > 0 &&
            ` Skipped ${commitResult.skippedInvalid} invalid row(s).`}
          {commitResult.unmatchedProducers.length > 0 &&
            ` No user match for: ${commitResult.unmatchedProducers.join(", ")}.`}
        </div>
      )}
    </div>
  );
}
