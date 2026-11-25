"use client";

import { useRouter } from "next/navigation";

export function ImportBanner({
  imported,
  skipped,
  errors,
  rejected,
}: {
  imported: number;
  /** Duplicates and unchecked rows. */
  skipped: number;
  errors: number;
  /** Rows skipped because their Show Status was "Rejected". */
  rejected: number;
}) {
  const router = useRouter();

  return (
    <div
      role="status"
      className="mt-4 flex items-center justify-between rounded-md border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
    >
      <span>
        {importSummary({ imported, skipped, errors, rejected })}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        // Drops ?imported&skipped&errors&rejected from the URL, which removes the banner.
        onClick={() => router.replace("/admin/shows")}
        className="ml-4 text-emerald-800 hover:text-emerald-950"
      >
        ✕
      </button>
    </div>
  );
}

/** "Imported 5 shows · 2 errors · 1 skipped as Rejected · 3 skipped". */
export function importSummary({
  imported,
  skipped,
  errors,
  rejected,
}: {
  imported: number;
  skipped: number;
  errors: number;
  rejected: number;
}): string {
  const parts = [`Imported ${imported} show${imported === 1 ? "" : "s"}`];
  parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  parts.push(`${rejected} skipped as Rejected`);
  if (skipped > 0) parts.push(`${skipped} other skipped (duplicates or unchecked)`);
  return parts.join(" · ");
}
