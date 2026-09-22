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

  // Only a hash of the invite token is stored, never the token itself, so a
  // database read can't be used to sign in as an invited user.
  await sql`
    create table if not exists invites (
      id serial primary key,
      token_hash text not null unique,
      role text not null check (role in ('producer', 'comic')),
      created_by integer not null references users(id),
      created_at timestamptz not null default now(),
      used_at timestamptz,
      used_by integer references users(id)
    )
  `;

  const [{ n }] = await sql`select count(*)::int as n from invites`;
  console.log(`invites table is in place. ${n} row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
