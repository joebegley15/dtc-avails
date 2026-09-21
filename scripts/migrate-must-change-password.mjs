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

  // Existing users get the default (false), so nobody is forced to change a
  // password they already chose.
  await sql`
    alter table users
    add column if not exists must_change_password boolean not null default false
  `;

  const [{ total, flagged }] = await sql`
    select count(*)::int as total,
           count(*) filter (where must_change_password)::int as flagged
    from users
  `;
  console.log(
    `users.must_change_password is in place. ${total} user(s), ${flagged} flagged.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
