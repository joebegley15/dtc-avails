"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  approveNominations,
  regenerateNominationLink,
  rejectNomination,
} from "@/lib/nominations";

export type ApprovalResult = { ok: boolean; error?: string };

const MAX_BULK = 200;

function isId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id > 0;
}

function refresh() {
  revalidatePath("/admin/approvals");
  revalidatePath("/producer/nominate");
}

export async function approve(ids: number[]): Promise<ApprovalResult> {
  await requireAdmin();

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK || !ids.every(isId)) {
    return { ok: false, error: "Pick at least one nomination." };
  }

  const approved = await approveNominations([...new Set(ids)]);
  refresh();
  return approved > 0
    ? { ok: true }
    : { ok: false, error: "Those were already reviewed." };
}

export async function reject(id: number): Promise<ApprovalResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, error: "Invalid nomination." };
  const rejected = await rejectNomination(id);
  refresh();
  return rejected ? { ok: true } : { ok: false, error: "That was already reviewed." };
}

export async function newLink(id: number): Promise<ApprovalResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, error: "Invalid nomination." };
  const replaced = await regenerateNominationLink(id);
  refresh();
  return replaced
    ? { ok: true }
    : { ok: false, error: "That link was already used." };
}
