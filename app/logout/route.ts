import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession } from "@/lib/session";
import { ADMIN_COOKIE_NAME, destroyAdminSession } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const hadAdminCookie = Boolean(cookieStore.get(ADMIN_COOKIE_NAME)?.value);

  await destroySession();
  await destroyAdminSession();

  return NextResponse.redirect(
    new URL(hadAdminCookie ? "/admin/login" : "/login", request.url)
  );
}
