import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { loadProducerOptions } from "@/lib/shows";
import { BulkUploadForm } from "./bulk-upload-form";

export default async function BulkUploadPage() {
  await requireAdmin();
  const producers = await loadProducerOptions();

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
            Show Title, Showtime, Producers, Venue, Venue Fee, Ticket Price, Sold
            Tix, Capacity
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Required: Show Title, Showtime, Producers, Venue. Optional:
            Capacity, Show Status. Venue Fee, Ticket Price, and Sold Tix
            aren&apos;t imported.
          </li>
          <li>
            Show Status: rows marked &quot;Rejected&quot; are skipped
            entirely. Any other status, or a blank, imports as usual. The
            status itself isn&apos;t saved.
          </li>
          <li>
            Show Title: the city and state, with the neighborhood in
            parentheses, like &quot;Houston, TX (Rice Village)&quot;. For a
            county, put the city in parentheses: &quot;Bell County, TX,
            (Belton)&quot; is a show in Belton, TX.
          </li>
          <li>Showtime: the date then the time, like 10/30/26 6:00 PM.</li>
          <li>
            All-star: imported shows are regular shows. Star them on the Shows
            page, or add an all_star column where &quot;yes&quot;,
            &quot;x&quot;, or &quot;★&quot; makes it an all-star show, which
            only all-star comics see.
          </li>
          <li>
            Producers: a producer or admin&apos;s name as it appears in Users.
            Separate several with &quot;;&quot;, &quot;,&quot;, &quot;&amp;&quot;,
            or &quot;and&quot;. A first initial and last name (&quot;T.
            Truman&quot;) or a small spelling mistake still finds the right
            person; the preview shows each of those matches so you can check
            it. If a name can&apos;t be matched, pick the producers for that
            row yourself in the preview.
          </li>
          <li>
            In the preview, uncheck any show you don&apos;t want to import.
          </li>
        </ul>
      </div>

      <p className="mt-4 text-sm text-zinc-500">
        Importing users instead of shows?{" "}
        <Link href="/admin/users/import" className="underline hover:text-zinc-950">
          Import users
        </Link>
        .
      </p>

      <BulkUploadForm producers={producers} />
    </div>
  );
}
