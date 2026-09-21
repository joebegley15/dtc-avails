"use client";

import { useRouter } from "next/navigation";

export function ImportBanner({
  imported,
  skipped,
}: {
  imported: number;
  skipped: number;
}) {
  const router = useRouter();

  return (
    <div
      role="status"
      className="mt-4 flex items-center justify-between rounded-md border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
    >
      <span>
        Imported {imported} show{imported === 1 ? "" : "s"}, skipped {skipped}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        // Drops ?imported&skipped from the URL, which removes the banner.
        onClick={() => router.replace("/admin/shows")}
        className="ml-4 text-emerald-800 hover:text-emerald-950"
      >
        ✕
      </button>
    </div>
  );
}
