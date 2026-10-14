// Rewrites shows.city into "City, ST" form with formatCity. Dry run unless
// passed --apply.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { formatCity } from "../lib/markets";

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
  const apply = process.argv.includes("--apply");
  const sql = neon(loadDatabaseUrl());

  const shows = (await sql`select id, city from shows order by id`) as {
    id: number;
    city: string;
  }[];
  const allCities = shows.map((s) => s.city);

  const changes = shows
    .map((s) => ({ id: s.id, from: s.city, to: formatCity(s.city, allCities) }))
    .filter((c) => c.to !== c.from);

  for (const c of changes) {
    console.log(`#${c.id}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  }
  const stateless = [
    ...new Set(shows.map((s) => formatCity(s.city, allCities))),
  ].filter((city) => !city.includes(","));
  if (stateless.length > 0) {
    console.log(`\nNo state known for: ${stateless.join("; ")}`);
  }

  if (!apply) {
    console.log(`\n${changes.length} of ${shows.length} shows would change. Run with --apply to save.`);
    return;
  }

  if (changes.length > 0) {
    await sql.transaction((tx) =>
      changes.map((c) => tx`update shows set city = ${c.to} where id = ${c.id}`)
    );
  }
  console.log(`\nUpdated ${changes.length} of ${shows.length} shows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
