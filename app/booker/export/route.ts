import { requireBookerViewer } from "@/lib/auth";
import { bookerShowsCsv } from "@/lib/booker";
import { loadBookerView } from "@/lib/booker-data";

/** The filtered booker show list as a CSV download. Same filters as /booker. */
export async function GET(request: Request) {
  await requireBookerViewer();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { shows } = await loadBookerView(params);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(bookerShowsCsv(shows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="upcoming-shows-${today}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
