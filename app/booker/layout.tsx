import { requireBookerViewer } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export default async function BookerLayout({ children }: LayoutProps<"/booker">) {
  const user = await requireBookerViewer();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
