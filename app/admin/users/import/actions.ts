"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { DEFAULT_PASSWORD, requireAdmin } from "@/lib/auth";
import {
  planUserImport,
  USER_CSV_FIELDS,
  type ExistingUser,
  type PlannedUser,
  type UserCsvRow,
  type UserRowPlan,
} from "@/lib/user-import";

export type ValidateUsersResult = { rows: UserRowPlan[] } | { error: string };

export type ImportedUser = { name: string; email: string; username: string };

export type ImportUsersResult =
  | {
      added: number;
      updated: number;
      skipped: number;
      newUsers: ImportedUser[];
    }
  | { error: string };

const MAX_ROWS = 1000;

// Rows come from the browser: coerce every field to a string.
function coerceRow(value: unknown): UserCsvRow {
  const source =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const row = {} as UserCsvRow;
  for (const field of USER_CSV_FIELDS) {
    const v = source[field];
    row[field] = typeof v === "string" ? v : "";
  }
  return row;
}

async function planRows(
  input: unknown
): Promise<{ plans: UserRowPlan[] } | { error: string }> {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "The file has no data rows." };
  }
  if (input.length > MAX_ROWS) {
    return { error: `Too many rows (${input.length}). The limit is ${MAX_ROWS}.` };
  }

  const existing = (await sql`
    select id, email, role, username from users
  `) as ExistingUser[];
  const taken = new Set(
    existing.flatMap((u) => (u.username ? [u.username.toLowerCase()] : []))
  );

  return { plans: planUserImport(input.map(coerceRow), existing, taken) };
}

/** Validates only. Saves nothing. */
export async function validateUsers(
  rows: UserCsvRow[]
): Promise<ValidateUsersResult> {
  await requireAdmin();

  const result = await planRows(rows);
  return "error" in result ? result : { rows: result.plans };
}

/**
 * Validates again on the server, then in one transaction updates existing
 * users (name, home market, all-star only) and inserts new ones with the
 * default password and must_change_password = true. Existing users'
 * passwords, usernames, and roles are never touched.
 */
export async function importUsers(
  rows: UserCsvRow[]
): Promise<ImportUsersResult> {
  await requireAdmin();

  const result = await planRows(rows);
  if ("error" in result) return result;
  const { plans } = result;

  const toAdd = plans.flatMap((p) => (p.action === "add" && p.user ? [p.user] : []));
  const toUpdate = plans.flatMap((p) =>
    p.action === "update" && p.user && p.existingId !== null
      ? [{ id: p.existingId, user: p.user }]
      : []
  );
  if (toAdd.length === 0 && toUpdate.length === 0) {
    return { error: "There are no valid rows to import." };
  }

  // One shared hash: every new user starts with the same default password.
  const defaultHash = toAdd.length > 0 ? await bcrypt.hash(DEFAULT_PASSWORD, 10) : "";

  const updateQuery = ({ id, user }: { id: number; user: PlannedUser }) => sql`
    update users set
      name = ${user.name},
      home_market = coalesce(${user.homeMarket}::text, home_market),
      is_all_star = coalesce(${user.isAllStar}::boolean, is_all_star)
    where id = ${id} and role <> 'admin'
    returning id
  `;
  const insertQuery = (user: PlannedUser) => sql`
    insert into users
      (name, email, username, password_hash, role, home_market, is_all_star, must_change_password)
    values
      (${user.name}, ${user.email}, ${user.username}, ${defaultHash}, ${user.role},
       ${user.homeMarket}, ${user.isAllStar ?? false}, true)
    on conflict (email) do nothing
    returning id
  `;

  let results: unknown[][];
  try {
    results = (await sql.transaction([
      ...toUpdate.map(updateQuery),
      ...toAdd.map(insertQuery),
    ])) as unknown as unknown[][];
  } catch (err) {
    // A username or email taken by someone else since validation.
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return {
        error:
          "A username or email was taken while importing. Nothing was imported. Check the file and try again.",
      };
    }
    throw err;
  }

  const updateResults = results.slice(0, toUpdate.length);
  const addResults = results.slice(toUpdate.length);
  const updated = updateResults.filter((r) => r.length > 0).length;
  const newUsers = toAdd.flatMap((user, i) =>
    addResults[i].length > 0
      ? [{ name: user.name, email: user.email, username: user.username }]
      : []
  );

  revalidatePath("/admin/users");
  return {
    added: newUsers.length,
    updated,
    skipped: plans.length - newUsers.length - updated,
    newUsers,
  };
}
