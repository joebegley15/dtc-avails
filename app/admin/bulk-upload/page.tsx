import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BulkUploadForm } from "./bulk-upload-form";

export default async function BulkUploadPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-zinc-950">Bulk upload</h1>
        <Link
          href="/admin/shows"
          className="text-sm text-zinc-600 underline hover:text-zinc-950"
        >
          Back to shows
        </Link>
      </div>

      <div className="mt-3 text-sm text-zinc-600">
        <p>
          Upload a CSV with these headers:{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800">
            city, neighborhood, date, time, producer, venue, capacity
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Required: city, date, time, producer, venue. Optional:
            neighborhood, capacity.
          </li>
          <li>Date: YYYY-MM-DD or M/D/YYYY.</li>
          <li>Time: 20:00, 8:00 PM, or 8 PM.</li>
          <li>
            Producer: a producer or admin&apos;s name as it appears in Users.
            Separate several with &quot;;&quot;.
          </li>
        </ul>
      </div>

      <BulkUploadForm />
    </div>
  );
}
