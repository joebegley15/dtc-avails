import { searchCities } from "@/lib/cities";

/**
 * GET /api/cities?q=aus -> ["Austin, TX", ...]: suggestions for the home
 * market box. Public, since signup pages use it before there's a session;
 * it only returns place names.
 */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 60) ?? "";
  return Response.json(searchCities(q), {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
