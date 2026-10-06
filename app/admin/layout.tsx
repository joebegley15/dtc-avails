import { requireAdmin } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
