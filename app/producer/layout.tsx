import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppHeader } from "@/components/app-header";

export default async function ProducerLayout({
  children,
}: LayoutProps<"/producer">) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "producer" && user.role !== "admin")) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader title="Producer" />
      <main className="flex-1">{children}</main>
    </div>
  );
}
