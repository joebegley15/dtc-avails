import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  const envPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    ".env.local"
  );
  const contents = readFileSync(envPath, "utf8");

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }

  throw new Error("DATABASE_URL not found in .env.local");
}

async function main() {
  const sql = neon(loadDatabaseUrl());

  // Nullable first, then backfilled, then locked to NOT NULL: safe whether
  // the table is empty (the common case) or already has pending invites from
  // before names existed.
  await sql`alter table invites add column if not exists name text`;
  await sql`update invites set name = 'Unnamed' where name is null`;
  await sql`alter table invites alter column name set not null`;

  const [{ n }] = await sql`select count(*)::int as n from invites`;
  console.log(`invites.name is in place. ${n} row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
