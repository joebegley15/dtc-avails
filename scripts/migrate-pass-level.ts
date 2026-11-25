// Local passes: adds users.pass_level (existing users stay "full") and the
// cities lookup table, seeded with coordinates from the bundled zip data (no
// geocoding API) for every home market, show city, and listed market.
// Safe to run again: it only adds what's missing.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { cityCoordinates } from "../lib/cities";
import { HOME_MARKETS } from "../lib/markets";
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

  await sql`
    alter table users
    add column if not exists pass_level text not null default 'full'
  `;
  await sql.transaction([
    sql`alter table users drop constraint if exists users_pass_level_check`,
    sql`
      alter table users add constraint users_pass_level_check
      check (pass_level in ('full', 'local'))
    `,
  ]);

  await sql`
    create table if not exists cities (
      name text primary key,
      latitude double precision not null check (latitude between -90 and 90),
      longitude double precision not null check (longitude between -180 and 180),
      created_at timestamptz not null default now()
    )
  `;
  await sql`create unique index if not exists cities_lower_name_key on cities (lower(name))`;

  const used = (await sql`
    select distinct btrim(city) as name from shows where btrim(city) <> ''
    union
    select distinct btrim(home_market) from users where btrim(coalesce(home_market, '')) <> ''
  `) as { name: string }[];
  const names = [
    ...new Map(
      [...HOME_MARKETS, ...used.map((r) => r.name)].map((n) => [n.toLowerCase(), n])
    ).values(),
  ];

  const found = names.flatMap((name) => {
    const c = cityCoordinates(name);
    return c ? [{ name, latitude: c.latitude, longitude: c.longitude }] : [];
  });
  const missing = names.filter((n) => !cityCoordinates(n));

  if (found.length > 0) {
    await sql`
      insert into cities (name, latitude, longitude)
      select * from unnest(
        ${found.map((c) => c.name)}::text[],
        ${found.map((c) => c.latitude)}::double precision[],
        ${found.map((c) => c.longitude)}::double precision[]
      )
      on conflict do nothing
    `;
  }

  console.log(`users.pass_level and cities are in place. ${found.length} cities have coordinates.`);
  if (missing.length > 0) {
    console.log(`No coordinates found for: ${missing.join("; ")}. Add them on /admin/cities.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
