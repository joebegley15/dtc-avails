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

  // Booker: reads show data to plan runs. Same constraint as
  // migrate:lead-producer, so the two can run in either order.
  await sql.transaction([
    sql`alter table users drop constraint if exists users_role_check`,
    sql`
      alter table users add constraint users_role_check
      check (role in ('admin', 'lead_producer', 'producer', 'booker', 'comic'))
    `,
  ]);

  console.log("users.role allows booker.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
