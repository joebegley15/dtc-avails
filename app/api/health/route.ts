import { neon } from "@neondatabase/serverless";

export async function GET() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`select count(*) from users`;
  return Response.json({ ok: true, users: rows[0].count });
}