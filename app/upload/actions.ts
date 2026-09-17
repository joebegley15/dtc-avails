"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_PATH,
  checkPassword,
  getSessionToken,
  isValidSessionToken,
} from "@/lib/auth";
import { sql } from "@/lib/db";
import { parseAndValidate, type ParseResult } from "./csv";

async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!isValidSessionToken(token)) {
    redirect("/upload/login");
  }
}

export type LoginState = { error?: string };

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");

  if (!checkPassword(password)) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, getSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AUTH_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/upload");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete({ name: AUTH_COOKIE_NAME, path: AUTH_COOKIE_PATH });
  redirect("/upload/login");
}

export async function checkCsv(csvText: string): Promise<ParseResult> {
  await requireAuth();
  return parseAndValidate(csvText);
}

export type CommitResult = {
  inserted: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  unmatchedProducers: string[];
  headerError: string | null;
};

export async function commitCsv(csvText: string): Promise<CommitResult> {
  await requireAuth();

  const { rows, headerError, unmatchedProducers } = await parseAndValidate(csvText);

  if (headerError) {
    return {
      inserted: 0,
      skippedDuplicates: 0,
      skippedInvalid: 0,
      unmatchedProducers: [],
      headerError,
    };
  }

  const toInsert = rows.filter(
    (r) => r.errors.length === 0 && !r.duplicateInFile && !r.duplicateInDb
  );
  const skippedDuplicates = rows.filter(
    (r) => r.errors.length === 0 && (r.duplicateInFile || r.duplicateInDb)
  ).length;
  const skippedInvalid = rows.filter((r) => r.errors.length > 0).length;

  if (toInsert.length > 0) {
    await sql.transaction(
      toInsert.map(
        (r) =>
          sql`with new_show as (
                insert into shows (city, neighborhood, show_date, show_time, venue, capacity)
                values (${r.city}, ${r.neighborhood}, ${r.showDate}, ${r.showTime}, ${r.venue}, ${r.capacity})
                returning id
              )
              insert into show_producers (show_id, producer_id)
              select id, ${r.producerId}::integer from new_show where ${r.producerId}::integer is not null`
      )
    );
  }

  revalidatePath("/upload");

  return {
    inserted: toInsert.length,
    skippedDuplicates,
    skippedInvalid,
    unmatchedProducers,
    headerError: null,
  };
}
