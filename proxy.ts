import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, isValidSessionToken } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/upload/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!isValidSessionToken(token)) {
    return NextResponse.redirect(new URL("/upload/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*"],
};
