"use client";

import Papa from "papaparse";
import { useState, useTransition } from "react";
import type { LinkCsvRow, LinkRowPlan } from "@/lib/link-users";
import {
  createLinkUsers,
  validateNames,
  type CreateLinkUsersResult,
  type LinkResultRow,
} from "./actions";

const REQUIRED_HEADERS = ["name"];
const KNOWN_HEADERS = ["name", "home_market", "all_star"] as const;

// Spreadsheet headers people actually type.
const HEADER_ALIASES: Record<string, string> = {
  "home market": "home_market",
  homemarket: "home_market",
  market: "home_market",
  "all-star": "all_star",
  "all star": "all_star",
  allstar: "all_star",
  is_all_star: "all_star",
  "is all star": "all_star",
  star: "all_star",
};

function normalizeHeader(header: string): string {
  const h = header.trim().toLowerCase();
  return HEADER_ALIASES[h] ?? h;
}

// A cell starting with = + - @ can run as a formula when the file is opened
// in a spreadsheet, so neutralize it.
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function downloadCsv(filename: string, lines: string[]) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  downloadCsv("comic-names-template.csv", [
    "name",
    "Jane Doe",
    "Alex Rivera",
  ]);
}

type Created = Extract<CreateLinkUsersResult, { created: number }>;

export function BulkLinksForm() {
  const [csvRows, setCsvRows] = useState<LinkCsvRow[] | null>(null);
  const [preview, setPreview] = useState<LinkRowPlan[] | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Changing the key remounts the file input, which clears its selection.
  const [inputKey, setInputKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCsvRows(null);
    setPreview(null);
    setCreated(null);
    setError(null);
    setInputKey((k) => k + 1);
  }

  function handleFile(file: File) {
    setCsvRows(null);
    setPreview(null);
    setCreated(null);
    setError(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
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
          const row = {} as LinkCsvRow;
          for (const h of KNOWN_HEADERS) row[h] = String(r[h] ?? "");
          return row;
        });
        setCsvRows(rows);

        startTransition(async () => {
          const result = await validateNames(rows);
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

  function handleCreate() {
    if (!csvRows) return;
    setError(null);
    startTransition(async () => {
      const result = await createLinkUsers(csvRows);
      if ("error" in result) {
        setError(result.error);
      } else {
        setCreated(result);
        setPreview(null);
        setCsvRows(null);
      }
    });
  }

  const newCount = preview?.filter((r) => r.action === "add").length ?? 0;
  const existingCount = preview?.filter((r) => r.action === "existing").length ?? 0;
  const errorCount = preview?.filter((r) => r.errors.length > 0).length ?? 0;
  const creatable = newCount + existingCount;

  if (created) {
    return <LinksResult result={created} onAnother={reset} />;
  }

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
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-sm text-zinc-600 underline hover:text-zinc-950"
        >
          Download template
        </button>
        {preview && (
          <>
            <button
              type="button"
              onClick={handleCreate}
              disabled={pending || creatable === 0}
              className="rounded-md bg-[#C8553D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Working…" : `Create ${creatable} link${creatable === 1 ? "" : "s"}`}
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
            {newCount} new, {existingCount} existing, {errorCount} error
            {errorCount === 1 ? "" : "s"}
          </p>

          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Row</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Home market</th>
                <th className="px-2 py-2">All-star</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {preview.map((r) => (
                <PreviewTableRow key={r.row} plan={r} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function PreviewTableRow({ plan }: { plan: LinkRowPlan }) {
  const { raw, user } = plan;
  const hasErrors = plan.errors.length > 0;

  return (
    <tr className={hasErrors ? "bg-red-50 align-top" : "align-top text-zinc-800"}>
      <td className="px-2 py-2">{plan.row}</td>
      <td className="px-2 py-2">
        {hasErrors ? (
          <ul className="list-disc pl-4 text-red-700">
            {plan.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : plan.action === "existing" ? (
          <span className="font-medium text-zinc-700">
            Exists, will reuse their link
          </span>
        ) : (
          <span className="font-medium text-emerald-700">New</span>
        )}
      </td>
      <td className="px-2 py-2">{user?.name ?? raw.name}</td>
      <td className="px-2 py-2">{user ? user.homeMarket : raw.home_market}</td>
      <td className="px-2 py-2">
        {user ? (user.allStar ? "★" : "no") : raw.all_star}
      </td>
    </tr>
  );
}

function LinksResult({
  result,
  onAnother,
}: {
  result: Created;
  onAnother: () => void;
}) {
  function downloadLinks() {
    downloadCsv("comic-links.csv", [
      ["name", "link"].join(","),
      ...result.links.map((l) => [l.name, l.link].map(csvCell).join(",")),
    ]);
  }

  return (
    <div className="mt-6">
      <p
        role="status"
        className="rounded-md border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800"
      >
        Created {result.created}, reused {result.existing}.
        {result.skipped > 0 &&
          ` Skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"}.`}
      </p>

      {result.links.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-zinc-800">
              Links ({result.links.length})
            </h2>
            <button
              type="button"
              onClick={downloadLinks}
              className="rounded-md bg-[#C8553D] px-4 py-2 text-sm font-medium text-white"
            >
              Download links CSV
            </button>
          </div>

          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Link</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {result.links.map((l) => (
                <LinkTableRow key={l.link} link={l} />
              ))}
            </tbody>
          </table>
        </>
      )}

      <button
        type="button"
        onClick={onAnother}
        className="mt-6 rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-zinc-800 hover:border-zinc-950"
      >
        Upload another file
      </button>
    </div>
  );
}

function LinkTableRow({ link }: { link: LinkResultRow }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, non-secure context); the
      // link is still visible to copy by hand, so this isn't fatal.
    }
  }

  return (
    <tr>
      <td className="px-2 py-2 text-zinc-950">{link.name}</td>
      <td className="max-w-xs truncate px-2 py-2 font-mono text-xs text-zinc-600">
        {link.link}
      </td>
      <td className="px-2 py-2">
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-black/10 px-2 py-1 text-xs font-medium text-zinc-800 hover:border-zinc-950"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </td>
    </tr>
  );
}
