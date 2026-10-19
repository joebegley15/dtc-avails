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

  // nominations: a producer suggests a comic by name and Instagram handle.
  // Not a user row: there's no account until the comic signs up through the
  // invite link an admin approves.
  //
  // signed_up_user_id is deferrable so the signup can claim the nomination
  // and create the user in one statement, in either order.
  //
  // signup_attempts: per-IP log for rate limiting public signup forms.
  await sql.transaction((tx) => [
    tx`
      create table if not exists nominations (
        id serial primary key,
        comic_name text not null,
        instagram_handle text,
        note text,
        nominated_by integer not null references users(id),
        status text not null default 'pending'
          check (status in ('pending', 'approved', 'rejected', 'signed_up')),
        invite_token text unique,
        token_expires_at timestamptz,
        created_at timestamptz not null default now(),
        reviewed_at timestamptz,
        signed_up_user_id integer references users(id)
          deferrable initially deferred
      )
    `,
    // One live nomination per handle; a rejected one can be nominated again.
    tx`
      create unique index if not exists nominations_live_handle_key
      on nominations (instagram_handle)
      where status in ('pending', 'approved', 'signed_up')
    `,
    tx`
      create index if not exists nominations_nominated_by_idx
      on nominations (nominated_by)
    `,
    tx`
      create table if not exists signup_attempts (
        id serial primary key,
        ip text not null,
        attempted_at timestamptz not null default now()
      )
    `,
    tx`
      create index if not exists signup_attempts_ip_time_idx
      on signup_attempts (ip, attempted_at)
    `,
  ]);

  console.log("nominations and signup_attempts are in place.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
