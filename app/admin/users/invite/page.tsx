import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listInvites } from "@/lib/invites";
import { InviteManager } from "./invite-manager";

export default async function InviteUserPage() {
  await requireAdmin();
  const invites = await listInvites();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-zinc-950">Invite a user</h1>
        <Link
          href="/admin/users"
          className="text-sm text-zinc-600 underline hover:text-zinc-950"
        >
          Back to users
        </Link>
      </div>

      <p className="mt-3 text-sm text-zinc-600">
        Generate a link and send it yourself, any way you like. Whoever opens
        it fills in their own name, email, username, and password. The link
        stops working the moment they finish, or if you revoke it first.
      </p>

      <InviteManager invites={invites} />
    </div>
  );
}
