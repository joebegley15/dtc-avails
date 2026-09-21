import Link from "next/link";
import { DEFAULT_PASSWORD, requireAdmin } from "@/lib/auth";
import { UserImportForm } from "./user-import-form";

export default async function ImportUsersPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-zinc-950">Import users</h1>
        <Link
          href="/admin/users"
          className="text-sm text-zinc-600 underline hover:text-zinc-950"
        >
          Back to users
        </Link>
      </div>

      <div className="mt-3 text-sm text-zinc-600">
        <p>
          Upload a CSV with these headers:{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-800">
            name, email, role, home_market, is_all_star, username
          </code>
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Required: name, email. Everything else is optional.</li>
          <li>Role: comic (the default) or producer.</li>
          <li>
            Username: if blank, one is made from the part of the email before
            the @, with a number added if it&apos;s taken.
          </li>
          <li>
            An email that already exists is updated (name, home market,
            all-star). Its username and password are never changed. Blank cells
            leave existing values alone.
          </li>
          <li>Admins can&apos;t be imported. Add them one at a time in Users.</li>
        </ul>
      </div>

      <UserImportForm defaultPassword={DEFAULT_PASSWORD} />
    </div>
  );
}
