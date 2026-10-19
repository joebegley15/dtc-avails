import { requireAdmin } from "@/lib/auth";
import { listApprovedNominations, listPendingNominations } from "@/lib/nominations";
import { ApprovedNominations, PendingNominations } from "./approvals-manager";

export default async function ApprovalsPage() {
  await requireAdmin();

  const [pending, approved] = await Promise.all([
    listPendingNominations(),
    listApprovedNominations(),
  ]);
  const now = new Date().toISOString();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="text-lg font-semibold text-zinc-950">Approvals</h1>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-950">
          Nominations ({pending.length})
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Comics producers want to bring in. Approving one gives the producer a
          one-time signup link, good for 30 days.
        </p>
        <PendingNominations nominations={pending} now={now} />
      </section>

      <section className="mt-10 border-t border-black/10 pt-6">
        <h2 className="text-base font-semibold text-zinc-950">
          Approved, invites sent ({approved.length})
        </h2>
        <ApprovedNominations nominations={approved} now={now} />
      </section>
    </div>
  );
}
