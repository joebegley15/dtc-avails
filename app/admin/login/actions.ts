"use server";

import { redirect } from "next/navigation";
import { checkAdminPassword, createAdminSession } from "@/lib/admin-auth";

export type AdminLoginState = { error?: string };

export async function adminLogin(
  _prevState: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const password = String(formData.get("password") ?? "");

  if (!checkAdminPassword(password)) {
    return { error: "Incorrect password." };
  }

  await createAdminSession();
  redirect("/admin/shows");
}
