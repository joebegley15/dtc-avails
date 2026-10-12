import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/session";
import { roleHomePath } from "@/lib/roles";
import type { Role } from "@/lib/session";

// A page component can't set cookies during render (Next.js only allows that
// from a Server Action or a Route Handler), so this has to be a route
// handler: it sets the session cookie itself, then redirects.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // A plain equality lookup: access_token is unique, and a link is only ever
  // handed to the one person it was made for, so nothing here needs to be
  // constant-time. Both outcomes below redirect either way, so this never
  // reveals whether the token existed.
  const rows = (await sql`
    select id, role, (must_change_password or password_hash is null) as must_change_password
    from users where access_token = ${token}
  `) as { id: number; role: Role; must_change_password: boolean }[];
  const user = rows[0];

  if (!user) {
    return NextResponse.redirect(new URL("/go/invalid", request.url));
  }

  // Anyone who hasn't chosen their own password yet (a link-only comic, or an
  // invited user on the default one) sets up their account first. That also
  // clears the token, so the link is one-time (see changePassword).
  await createSession(user.id);
  const next = user.must_change_password ? "/change-password" : roleHomePath(user.role);
  return NextResponse.redirect(new URL(next, request.url));
}
