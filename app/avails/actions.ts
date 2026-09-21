"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function submitAvailability(
  showId: number,
  available: boolean
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "comic") {
    redirect("/login?next=/avails");
  }

  await sql`
    insert into avails (user_id, show_id, available, submitted_at)
    values (${user.id}, ${showId}, ${available}, now())
    on conflict (user_id, show_id)
    do update set available = excluded.available, submitted_at = excluded.submitted_at
  `;

  revalidatePath("/avails");
}
