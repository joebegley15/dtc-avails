"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { buildLink, generateToken } from "@/lib/tokens";
import {
  LINK_CSV_FIELDS,
  planLinkUsers,
  type ExistingLinkUser,
  type LinkCsvRow,
  type LinkRowPlan,
} from "@/lib/link-users";

export type ValidateNamesResult = { rows: LinkRowPlan[] } | { error: string };

const MAX_ROWS = 1000;

// Rows come from the browser: coerce every field to a string.
function coerceRow(value: unknown): LinkCsvRow {
  const source =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const row = {} as LinkCsvRow;
  for (const field of LINK_CSV_FIELDS) {
    const v = source[field];
    row[field] = typeof v === "string" ? v : "";
  }
  return row;
}

async function planRows(
  input: unknown
): Promise<
  { plans: LinkRowPlan[]; existingUsers: ExistingLinkUser[] } | { error: string }
> {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "The file has no data rows." };
  }
  if (input.length > MAX_ROWS) {
    return { error: `Too many rows (${input.length}). The limit is ${MAX_ROWS}.` };
  }

  const existingUsers = (await sql`
    select id, name, role, access_token from users
  `) as ExistingLinkUser[];

  return { plans: planLinkUsers(input.map(coerceRow), existingUsers), existingUsers };
}

/** Validates only. Saves nothing. */
export async function validateNames(rows: LinkCsvRow[]): Promise<ValidateNamesResult> {
  await requireAdmin();

  const result = await planRows(rows);
  return "error" in result ? result : { rows: result.plans };
}

export type LinkResultRow = { name: string; link: string };

export type CreateLinkUsersResult =
  | { created: number; existing: number; skipped: number; links: LinkResultRow[] }
  | { error: string };

type InsertedRow = { id: number; name: string; access_token: string };

/**
 * Validates again on the server, then creates a link for every valid row: a
 * fresh comic account for a new name, and a token backfill for an existing
 * comic who was matched by name but somehow doesn't have one yet (created
 * some other way, never linked before). An existing comic who already has a
 * token is left alone entirely; their current link is just reported back.
 */
export async function createLinkUsers(
  rows: LinkCsvRow[]
): Promise<CreateLinkUsersResult> {
  await requireAdmin();

  const result = await planRows(rows);
  if ("error" in result) return result;
  const { plans, existingUsers } = result;
  const existingById = new Map(existingUsers.map((u) => [u.id, u]));

  const toAdd = plans.flatMap((p) => (p.action === "add" && p.user ? [p.user] : []));
  const existingIds = plans.flatMap((p) =>
    p.action === "existing" && p.existingId !== null ? [p.existingId] : []
  );

  if (toAdd.length === 0 && existingIds.length === 0) {
    return { error: "There are no valid names to create links for." };
  }

  const newTokens = toAdd.map(() => generateToken());
  const insertQueries = toAdd.map(
    (user, i) => sql`
      insert into users
        (name, role, home_market, is_all_star, access_token, token_created_at, email, password_hash, must_change_password)
      values
        (${user.name}, 'comic', ${user.homeMarket}, ${user.allStar}, ${newTokens[i]}, now(), null, null, false)
      returning id, name, access_token
    `
  );

  const needsBackfill = existingIds.filter((id) => !existingById.get(id)?.access_token);
  const backfillTokens = needsBackfill.map(() => generateToken());
  const backfillQueries = needsBackfill.map(
    (id, i) => sql`
      update users
      set access_token = ${backfillTokens[i]}, token_created_at = now(), must_change_password = false
      where id = ${id} and access_token is null
      returning id, name, access_token
    `
  );

  let results: InsertedRow[][] = [];
  if (insertQueries.length > 0 || backfillQueries.length > 0) {
    try {
      results = (await sql.transaction([
        ...insertQueries,
        ...backfillQueries,
      ])) as unknown as InsertedRow[][];
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "23505") {
        return { error: "A token collided while creating links. Try again." };
      }
      throw err;
    }
  }

  const insertResults = results.slice(0, insertQueries.length);
  const backfillResults = results.slice(insertQueries.length);

  const createdLinks: LinkResultRow[] = insertResults.flatMap((rs) =>
    rs.length > 0 ? [{ name: rs[0].name, link: buildLink(rs[0].access_token) }] : []
  );
  const backfilledTokenById = new Map(
    backfillResults.flatMap((rs) =>
      rs.length > 0 ? [[rs[0].id, rs[0].access_token] as const] : []
    )
  );

  const existingLinks: LinkResultRow[] = existingIds.flatMap((id) => {
    const user = existingById.get(id);
    const token = backfilledTokenById.get(id) ?? user?.access_token ?? null;
    return user && token ? [{ name: user.name, link: buildLink(token) }] : [];
  });

  const created = createdLinks.length;
  const existing = existingLinks.length;

  revalidatePath("/admin/users");
  revalidatePath("/admin/users/bulk-links");

  return {
    created,
    existing,
    skipped: plans.length - created - existing,
    links: [...createdLinks, ...existingLinks],
  };
}
