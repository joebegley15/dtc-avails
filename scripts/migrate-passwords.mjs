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

function baseUsername(email) {
  const local = email.split("@")[0].trim().toLowerCase().replace(/\s+/g, "");
  return local || "user";
}

async function main() {
  const databaseUrl = loadDatabaseUrl();
  const sql = neon(databaseUrl);

  // phone_last4 stays in place, but new users no longer supply it, so it can't
  // remain NOT NULL.
  await sql.transaction((tx) => [
    tx`alter table users add column if not exists username text`,
    tx`alter table users add column if not exists password_hash text`,
    tx`create unique index if not exists users_username_key on users (username)`,
    tx`alter table users alter column phone_last4 drop not null`,
  ]);

  const taken = new Set(
    (await sql`select username from users where username is not null`).map(
      (r) => r.username.toLowerCase()
    )
  );
  const pending = await sql`
    select id, email from users where username is null order by id
  `;

  const assignments = [];
  for (const { id, email } of pending) {
    const base = baseUsername(email);
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) {
      candidate = `${base}${n}`;
    }
    taken.add(candidate);
    assignments.push({ id, email, username: candidate });
  }

  if (assignments.length > 0) {
    await sql.transaction((tx) =>
      assignments.map(
        (a) => tx`update users set username = ${a.username} where id = ${a.id}`
      )
    );
  }

  console.log(`Backfilled ${assignments.length} username(s):`);
  for (const a of assignments) {
    console.log(`  ${a.email} -> ${a.username}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
