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

  await sql`alter table users add column if not exists access_token text unique`;
  await sql`alter table users add column if not exists token_created_at timestamptz`;

  // A unique index already permits multiple nulls in Postgres (null is never
  // equal to null), so dropping NOT NULL is the only change email needs.
  await sql`alter table users alter column email drop not null`;
  await sql`alter table users alter column password_hash drop not null`;

  const [{ n }] = await sql`select count(*)::int as n from users`;
  const [{ withToken }] =
    await sql`select count(*)::int as "withToken" from users where access_token is not null`;
  console.log(
    `users.access_token / token_created_at are in place, and email / password_hash are nullable. ${n} user(s), ${withToken} with a link already.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
