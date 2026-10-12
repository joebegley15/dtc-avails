import { requireAdmin } from "@/lib/auth";

export default async function SignedInAsAdminPage() {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b-4 border-[#DA1717] px-4 py-4">
        <span className="text-xl font-bold tracking-tight text-[#1F3A5F]">
          Texahoma Avails
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-lg font-semibold text-zinc-950">
          You&apos;re signed in as {user.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          That link belongs to someone else, so it wasn&apos;t opened here: it
          would have signed you out of your admin account. To see what they
          see, open the link in a private window.
        </p>
        <a
          href="/admin/users"
          className="mt-6 text-sm text-zinc-600 underline hover:text-zinc-950"
        >
          Back to users
        </a>
      </main>
    </div>
  );
}
