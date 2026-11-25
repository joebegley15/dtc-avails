"use server";

import { revalidatePath } from "next/cache";
import { requireLeadProducer } from "@/lib/auth";
import { createSingleUser, type CreateUserState } from "@/lib/user-create";

/**
 * A Lead Producer creates one comic or one regular producer, through the same
 * flow as the admin's "Add user". createSingleUser refuses any other role.
 */
export async function createUserAsLeadProducer(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  const leadProducer = await requireLeadProducer();

  const result = await createSingleUser(leadProducer, formData);
  if (result.success) {
    revalidatePath("/producer/users");
    revalidatePath("/admin/users");
  }
  return result;
}
