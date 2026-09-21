"use client";

import Papa from "papaparse";
import { useState, useTransition } from "react";
import type { UserCsvRow, UserRowPlan } from "@/lib/user-import";
import {
  importUsers,
  validateUsers,
  type ImportedUser,
  type ImportUsersResult,
} from "./actions";

const REQUIRED_HEADERS = ["name", "email"];
const KNOWN_HEADERS = [
  "name",
  "email",
  "role",
  "home_market",
  "is_all_star",
  "username",
] as const;

// Spreadsheet headers people actually type.
const HEADER_ALIASES: Record<string, string> = {
  "home market": "home_market",
  homemarket: "home_market",
  market: "home_market",
  "all-star": "is_all_star",
  "all star": "is_all_star",
  allstar: "is_all_star",
  all_star: "is_all_star",
  "is all star": "is_all_star",
  star: "is_all_star",
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

type Imported = Extract<ImportUsersResult, { added: number }>;

export function UserImportForm({ defaultPassword }: { defaultPassword: string }) {
  const [csvRows, setCsvRows] = useState<UserCsvRow[] | null>(null);
  const [preview, setPreview] = useState<UserRowPlan[] | null>(null);
  const [imported, setImported] = useState<Imported | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Changing the key remounts the file input, which clears its selection.
  const [inputKey, setInputKey] = useState(0);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCsvRows(null);
    setPreview(null);
    setImported(null);
    setError(null);
    setInputKey((k) => k + 1);
  }

  function handleFile(file: File) {
    setCsvRows(null);
    setPreview(null);
    setImported(null);
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
          const row = {} as UserCsvRow;
          for (const h of KNOWN_HEADERS) row[h] = String(r[h] ?? "");
          return row;
        });
        setCsvRows(rows);

        startTransition(async () => {
          const result = await validateUsers(rows);
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
    setError(null);
    startTransition(async () => {
      const result = await importUsers(csvRows);
      if ("error" in result) {
        setError(result.error);
      } else {
        setImported(result);
        setPreview(null);
        setCsvRows(null);
      }
    });
  }

  const addCount = preview?.filter((r) => r.action === "add").length ?? 0;
  const updateCount = preview?.filter((r) => r.action === "update").length ?? 0;
  const errorCount = preview?.filter((r) => r.errors.length > 0).length ?? 0;
  const importable = addCount + updateCount;

  if (imported) {
    return (
      <ImportResult
        result={imported}
        defaultPassword={defaultPassword}
        onAnother={reset}
      />
    );
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
        {preview && (
          <>
            <button
              type="button"
              onClick={handleImport}
              disabled={pending || importable === 0}
              className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {pending ? "Working…" : `Import ${importable} user${importable === 1 ? "" : "s"}`}
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
            {addCount} new, {updateCount} update{updateCount === 1 ? "" : "s"},{" "}
            {errorCount} error{errorCount === 1 ? "" : "s"}
          </p>

          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Row</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Username</th>
                <th className="px-2 py-2">Role</th>
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

function PreviewTableRow({ plan }: { plan: UserRowPlan }) {
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
        ) : plan.action === "update" ? (
          <span className="font-medium text-zinc-700">
            Update{" "}
            <span className="font-normal text-zinc-500">
              (username and password stay)
            </span>
          </span>
        ) : (
          <span className="font-medium text-emerald-700">New</span>
        )}
      </td>
      <td className="px-2 py-2">{user?.name ?? raw.name}</td>
      <td className="px-2 py-2">{user?.email ?? raw.email}</td>
      <td className="px-2 py-2">{user ? user.username : raw.username || "—"}</td>
      <td className="px-2 py-2 capitalize">
        {user ? (plan.action === "update" ? "unchanged" : user.role) : raw.role || "—"}
      </td>
      <td className="px-2 py-2">{user ? (user.homeMarket ?? "—") : raw.home_market}</td>
      <td className="px-2 py-2">
        {user
          ? user.isAllStar === null
            ? "—"
            : user.isAllStar
              ? "★"
              : "no"
          : raw.is_all_star}
      </td>
    </tr>
  );
}

function ImportResult({
  result,
  defaultPassword,
  onAnother,
}: {
  result: Imported;
  defaultPassword: string;
  onAnother: () => void;
}) {
  function downloadLogins() {
    // No password column: every new user starts with the same default one.
    const lines = [
      ["name", "email", "username"].join(","),
      ...result.newUsers.map((u) =>
        [u.name, u.email, u.username].map(csvCell).join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "logins.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6">
      <p
        role="status"
        className="rounded-md border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800"
      >
        Added {result.added}, updated {result.updated}.
        {result.skipped > 0 &&
          ` Skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"}.`}
      </p>

      {result.newUsers.length > 0 && (
        <>
          <p className="mt-4 text-sm text-zinc-700">
            New users log in with their email and{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-900">
              {defaultPassword}
            </code>
            , then set their own password.
          </p>

          <div className="mt-4 flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-zinc-800">
              New users ({result.newUsers.length})
            </h2>
            <button
              type="button"
              onClick={downloadLogins}
              className="rounded-md bg-[#DA1717] px-4 py-2 text-sm font-medium text-white"
            >
              Download logins CSV
            </button>
          </div>

          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Username</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {result.newUsers.map((u: ImportedUser) => (
                <tr key={u.email}>
                  <td className="px-2 py-2 text-zinc-950">{u.name}</td>
                  <td className="px-2 py-2 text-zinc-700">{u.username}</td>
                </tr>
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
        Import another file
      </button>
    </div>
  );
}
