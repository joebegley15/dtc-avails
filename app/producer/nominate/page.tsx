import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listMyNominations } from "@/lib/nominations";
import { MyNominations } from "./my-nominations";
import { NominateForm } from "./nominate-form";

export default async function NominatePage() {
  const user = await requireUser();
  if (user.role !== "producer" && user.role !== "admin") {
    redirect("/login");
  }

  // Only ever this producer's own nominations, admins included.
  const nominations = await listMyNominations(user.id);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <h1 className="text-lg font-semibold text-zinc-950">Nominate a comic</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Know a comic who should be on our shows? Send them our way. Once
        they&apos;re approved, you&apos;ll get a link here to DM them.
      </p>

      <NominateForm />

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Your nominations
      </h2>
      <MyNominations nominations={nominations} now={new Date().toISOString()} />
    </div>
  );
}
