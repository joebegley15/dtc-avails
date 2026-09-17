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
  const databaseUrl = loadDatabaseUrl();
  const sql = neon(databaseUrl);

  const [, copied] = await sql.transaction((tx) => [
    tx`
      create table if not exists show_producers (
        show_id integer not null references shows(id) on delete cascade,
        producer_id integer not null references users(id) on delete cascade,
        primary key (show_id, producer_id)
      )
    `,
    tx`
      insert into show_producers (show_id, producer_id)
      select id, producer_id from shows where producer_id is not null
      on conflict (show_id, producer_id) do nothing
      returning show_id
    `,
  ]);

  console.log(`Copied ${copied.length} row(s) into show_producers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
