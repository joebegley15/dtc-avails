import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { roleHomePath } from "@/lib/roles";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  redirect(roleHomePath(user.role));
}
