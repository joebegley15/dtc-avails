import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { roleHomePath } from "@/lib/roles";

export default async function Home() {
  if (await isAdminAuthenticated()) {
    redirect("/admin/shows");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  redirect(roleHomePath(user.role));
}
