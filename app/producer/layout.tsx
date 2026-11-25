import { requireProducer } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

export default async function ProducerLayout({
  children,
}: LayoutProps<"/producer">) {
  const user = await requireProducer();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
