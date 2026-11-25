import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ShowResponsesPage from "@/app/admin/shows/[id]/page";
import { executed, onSql } from "./helpers/fake-db";
import { redirectOf, signInAs } from "./helpers/fake-session";
import type { Role } from "@/lib/roles";

const props = (id: string) =>
  ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }) as never;

const show = {
  id: 7,
  city: "Austin, TX",
  neighborhood: "East",
  show_date: "2026-12-05",
  show_time: "20:00",
  venue: "The Venue",
  capacity: 80,
  is_all_star: false,
  producer_names: ["Pat Producer"],
};

const answer = (name: string, available: boolean) => ({
  user_id: name.length,
  name,
  email: `${name.toLowerCase()}@example.com`,
  home_market: "Austin, TX",
  is_all_star: false,
  has_truck: false,
  available,
  down_to_help: false,
  in_town: false,
  submitted_at: "2026-11-20T18:00:00Z",
});

describe("admin show responses page", () => {
  it.each<Role>(["comic", "producer", "lead_producer", "booker"])(
    "redirects a %s before reading anything",
    async (role) => {
      signInAs(role);
      expect(await redirectOf(() => ShowResponsesPage(props("7")))).toBe("/");
      expect(executed).toHaveLength(0);
    }
  );

  it("404s for a non-numeric or unknown id", async () => {
    signInAs("admin");
    await expect(ShowResponsesPage(props("abc"))).rejects.toThrow("NEXT_NOT_FOUND");
    onSql(() => []);
    await expect(ShowResponsesPage(props("999"))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lists who is in and who is out, counted like the shows table", async () => {
    signInAs("admin");
    onSql((q) => {
      if (q.text.includes("from avails a join shows")) {
        return [answer("Alex", true), answer("Blair", true), answer("Casey", false)];
      }
      if (q.text.includes("count(*)::int as total")) return [{ total: 10 }];
      return [show];
    });
    const html = renderToStaticMarkup(await ShowResponsesPage(props("7")));
    expect(html).toContain("2 in");
    expect(html).toContain("1 out");
    expect(html).toContain("7 haven&#x27;t answered");
    expect(html).toContain("In (2)");
    expect(html).toContain("Out (1)");
    expect(html).toContain("casey@example.com");
    const responsesQuery = executed.find((q) => q.text.includes("from avails a join shows"));
    expect(responsesQuery?.text).toContain("(not s.is_all_star or u.is_all_star)");
    expect(responsesQuery?.values).toEqual([7]);
  });
});
