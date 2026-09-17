import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";

export default async function AvailsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader title="Avails" />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="text-lg font-semibold text-zinc-950">Avails</h1>
        <p className="mt-1 text-sm text-zinc-600">Welcome, {user.name}.</p>
      </main>
    </div>
  );
}
