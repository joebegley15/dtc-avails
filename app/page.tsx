import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { roleHomePath } from "@/lib/roles";

export default async function Home() {
  const user = await requireUser();
  redirect(roleHomePath(user.role));
}
