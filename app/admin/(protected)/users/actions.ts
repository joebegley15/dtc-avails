"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { Role } from "@/lib/session";

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export type AddUserState = { error?: string; success?: string };

const ROLES: Role[] = ["producer", "comic"];

export async function createUser(
  _prevState: AddUserState,
  formData: FormData
): Promise<AddUserState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phoneLast4 = String(formData.get("phoneLast4") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  const homeMarket = String(formData.get("homeMarket") ?? "").trim();
  const isAllStar = formData.get("isAllStar") === "on";

  if (!name || !email || !phoneLast4 || !role) {
    return { error: "Name, email, phone code, and role are required." };
  }
  if (!/^\d{4}$/.test(phoneLast4)) {
    return { error: "Phone code must be exactly 4 digits." };
  }
  if (!ROLES.includes(role)) {
    return { error: "Invalid role." };
  }

  try {
    await sql`
      insert into users (name, email, phone_last4, role, home_market, is_all_star)
      values (${name}, ${email}, ${phoneLast4}, ${role}, ${homeMarket || null}, ${isAllStar})
    `;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return { error: "That email is already in use." };
    }
    throw err;
  }

  revalidatePath("/admin/users");
  return { success: `Added ${name}.` };
}
