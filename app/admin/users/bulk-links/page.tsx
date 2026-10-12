import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { BulkLinksForm } from "./bulk-links-form";

export default async function BulkLinksPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-zinc-950">Bulk links</h1>
        <Link
          href="/admin/users"
          className="text-sm text-zinc-600 underline hover:text-zinc-950"
        >
          Back to users
        </Link>
      </div>

      <div className="mt-3 text-sm text-zinc-600">
        <p>
          Paste comic names (separated by commas or new lines) or upload a
          CSV. Each one gets a private link that signs them straight in, no
          email or password needed. Then copy a ready-to-send invite for each
          person.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>CSV columns: name (required), home_market, all_star.</li>
          <li>Home market defaults to Austin, TX when blank.</li>
          <li>
            Home market must be one of the 20 cities in the Users dropdown
            (&ldquo;Austin&rdquo; or &ldquo;Austin, TX&rdquo; both work).
          </li>
          <li>
            A name that already matches a comic reuses their existing link
            instead of making a new one.
          </li>
        </ul>
      </div>

      <BulkLinksForm />
    </div>
  );
}
