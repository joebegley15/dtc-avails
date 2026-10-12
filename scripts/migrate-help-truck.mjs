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

  // down_to_help: per show, saved with each avail. Defaults to false so
  // existing answers read as "not offered".
  // has_truck: per user, null until they answer on /avails.
  await sql.transaction((tx) => [
    tx`
      alter table avails
      add column if not exists down_to_help boolean not null default false
    `,
    tx`alter table users add column if not exists has_truck boolean`,
  ]);

  console.log("avails.down_to_help and users.has_truck are in place.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
