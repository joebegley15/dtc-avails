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
          Upload a CSV of comic names. Each one gets a private link that
          signs them straight in, no username or password needed.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Required: name. Optional: home_market, all_star.</li>
          <li>Home market defaults to Austin, TX when blank.</li>
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
