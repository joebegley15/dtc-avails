import { requireUserMustChangePassword } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  await requireUserMustChangePassword();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-baseline justify-between border-b-4 border-[#DA1717] px-4 py-4">
        <span className="text-xl font-bold tracking-tight text-[#1F3A5F]">
          Texahoma Avails
        </span>
        <a
          href="/logout"
          className="text-sm text-zinc-500 underline hover:text-zinc-950"
        >
          Sign out
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-lg font-semibold text-zinc-950">
          Choose your password
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          You&apos;re signed in with a temporary password. Choose your own to
          continue: at least 8 characters, and not the default one.
        </p>
        <ChangePasswordForm />
      </main>
    </div>
  );
}
