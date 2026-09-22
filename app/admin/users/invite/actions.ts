"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  createInvite,
  revokeInvite,
  type InviteRole,
} from "@/lib/invites";

const ROLES: InviteRole[] = ["producer", "comic"];

export type CreateInviteResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

export async function createInviteLink(
  role: string,
  name: string
): Promise<CreateInviteResult> {
  const admin = await requireAdmin();

  if (typeof role !== "string" || !ROLES.includes(role as InviteRole)) {
    return { ok: false, error: "Invalid role." };
  }
  const trimmedName = typeof name === "string" ? name.trim() : "";
  if (!trimmedName) {
    return { ok: false, error: "Their name is required." };
  }

  const token = await createInvite(role as InviteRole, trimmedName, admin.id);
  revalidatePath("/admin/users/invite");
  return { ok: true, token };
}

export type RevokeInviteResult = { ok: boolean; error?: string };

export async function revokeInviteLink(id: number): Promise<RevokeInviteResult> {
  await requireAdmin();

  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Invalid invite." };
  }

  const removed = await revokeInvite(id);
  if (!removed) {
    return { ok: false, error: "That link was already used or no longer exists." };
  }

  revalidatePath("/admin/users/invite");
  return { ok: true };
}
