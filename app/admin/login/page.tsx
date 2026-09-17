import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { AdminLoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin/shows");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b-4 border-[#DA1717] px-4 py-4">
        <span className="text-xl font-bold tracking-tight text-[#DA1717]">
          DON&apos;T TELL
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <h1 className="text-lg font-semibold text-zinc-950">Admin sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter the admin password to continue.
        </p>
        <AdminLoginForm />
      </main>
    </div>
  );
}
