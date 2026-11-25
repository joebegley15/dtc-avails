import { describe, expect, it } from "vitest";
import { setOwnHomeMarket, submitAvails } from "@/app/avails/actions";
import AvailsPage from "@/app/avails/page";
import ProducerPage from "@/app/producer/page";
import ProducerLayout from "@/app/producer/layout";
import NominatePage from "@/app/producer/nominate/page";
import { nominateComic } from "@/app/producer/nominate/actions";
import AdminAvailsPage from "@/app/admin/avails/page";
import AdminUsersPage from "@/app/admin/users/page";
import {
  createUser,
  deleteUser,
  setAllStar,
  setHomeMarket,
  setPassLevel,
  updateUser,
} from "@/app/admin/users/actions";
import { createShow, deleteShow, toggleAllStar, updateShow } from "@/app/admin/shows/actions";
import { importUsers } from "@/app/admin/users/import/actions";
import { createInviteLink } from "@/app/admin/users/invite/actions";
import { createUserAsLeadProducer } from "@/app/producer/users/actions";
import { GET as exportCsv } from "@/app/booker/export/route";
import { loadUpcomingBookerShows } from "@/lib/booker-data";
import {
  bookerShowsCsv,
  filterBookerShows,
  parseBookerFilters,
  planRuns,
  type BookerShow,
} from "@/lib/booker";
import { requireBookerViewer } from "@/lib/auth";
import { creatableRoles, roleHomePath } from "@/lib/roles";
import { planUserImport } from "@/lib/user-import";
import { executed, executedMatching, onSql } from "./helpers/fake-db";
import { redirectOf, signInAs } from "./helpers/fake-session";

const showValues = {
  city: "Austin, TX",
  neighborhood: "",
  date: "2026-12-05",
  time: "20:00",
  venue: "Club",
  capacity: "",
  isAllStar: false,
  producerIds: [1],
};
const userForm = () => {
  const data = new FormData();
  data.set("name", "X");
  data.set("email", "x@x.com");
  data.set("password", "secret123");
  data.set("role", "comic");
  data.set("homeMarket", "Austin, TX");
  return data;
};
const noParams = { searchParams: Promise.resolve({}), params: Promise.resolve({}) };

const BLOCKED: [string, string, () => unknown][] = [
  // Submitting availability.
  ["submission", "submitAvails", () => submitAvails([{ showId: 1, available: true, downToHelp: false, inTown: false }], false)],
  ["submission", "setOwnHomeMarket", () => setOwnHomeMarket("Austin, TX")],
  ["submission", "/avails page", () => AvailsPage()],
  // Applicant lists and comic contact info.
  ["applicants", "/producer page", () => ProducerPage(noParams as never)],
  ["applicants", "/producer layout", () => ProducerLayout({ children: null } as never)],
  ["applicants", "/producer/nominate page", () => NominatePage()],
  ["applicants", "nominateComic", () => nominateComic({}, new FormData())],
  ["applicants", "/admin/avails page", () => AdminAvailsPage()],
  ["applicants", "/admin/users page", () => AdminUsersPage(noParams as never)],
  // Editing.
  ["edit", "createShow", () => createShow(showValues)],
  ["edit", "updateShow", () => updateShow(1, showValues)],
  ["edit", "toggleAllStar (show)", () => toggleAllStar(1)],
  ["edit", "deleteShow", () => deleteShow(1)],
  ["edit", "updateUser", () => updateUser(1, { name: "X", email: "", role: "comic", hasTruck: null })],
  ["edit", "setHomeMarket", () => setHomeMarket(1, "Austin, TX")],
  ["edit", "setAllStar (user)", () => setAllStar(1, true)],
  ["edit", "setPassLevel", () => setPassLevel(1, "local")],
  ["edit", "deleteUser", () => deleteUser(1)],
  // Creating users.
  ["user creation", "createUser (admin)", () => createUser({}, userForm())],
  ["user creation", "createUserAsLeadProducer", () => createUserAsLeadProducer({}, userForm())],
  ["user creation", "importUsers", () => importUsers([])],
  ["user creation", "createInviteLink", () => createInviteLink("comic", "X")],
];

describe("Booker is blocked on the server", () => {
  it.each(BLOCKED)("from %s: %s", async (_kind, _name, call) => {
    signInAs("booker");
    const url = await redirectOf(call);
    expect(["/", "/booker"]).toContain(url);
    expect(executed).toEqual([]);
  });

  it("lands on /booker after login", () => {
    expect(roleHomePath("booker")).toBe("/booker");
  });

  it("can't be created by a Lead Producer, only by an admin", () => {
    expect(creatableRoles("lead_producer")).not.toContain("booker");
    expect(creatableRoles("admin")).toContain("booker");
  });

  it("can be added through the admin's bulk user CSV", () => {
    const [plan] = planUserImport(
      [{ name: "Bo Booker", email: "bo@x.com", role: "Booker", home_market: "", is_all_star: "", pass_level: "" }],
      []
    );
    expect(plan.errors).toEqual([]);
    expect(plan.user?.role).toBe("booker");
  });

  it("is added by the admin's single Add user", async () => {
    signInAs("admin");
    const data = userForm();
    data.set("role", "booker");
    data.set("homeMarket", "");
    expect((await createUser({}, data)).success).toBeDefined();
    expect(executedMatching("insert into users")[0].values[3]).toBe("booker");
  });
});

describe("Booker views", () => {
  it("let bookers and admins in, nobody else", async () => {
    signInAs("booker");
    await expect(requireBookerViewer()).resolves.toBeDefined();
    signInAs("admin");
    await expect(requireBookerViewer()).resolves.toBeDefined();
    for (const role of ["comic", "producer", "lead_producer"] as const) {
      signInAs(role);
      expect(await redirectOf(() => requireBookerViewer())).toBe(roleHomePath(role));
    }
  });

  it("never select avails or contact info", async () => {
    signInAs("booker");
    await loadUpcomingBookerShows();
    const [query] = executed;
    expect(query.text).not.toMatch(/email|phone|avails|access_token|password/);
  });

  it("export the filtered list as CSV", async () => {
    signInAs("booker");
    onSql(() => [
      { id: 1, city: "Austin, TX", neighborhood: null, date: "2026-12-05", time: "20:00", venue: "=Club", capacity: 80, producer_names: ["Pat"] },
      { id: 2, city: "Dallas, TX", neighborhood: "Deep Ellum", date: "2026-12-06", time: "21:00", venue: "Hall", capacity: null, producer_names: [] },
    ]);
    const res = await exportCsv(new Request("http://x/booker/export?city=Dallas%2C+TX"));
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    const text = await res.text();
    expect(text).toBe(
      "Date,Time,City,Neighborhood,Venue,Capacity,Producers\r\n2026-12-06,21:00,\"Dallas, TX\",Deep Ellum,Hall,,\r\n"
    );
  });

  it("refuse the CSV export to comics", async () => {
    signInAs("comic");
    expect(await redirectOf(() => exportCsv(new Request("http://x/booker/export")))).toBe("/avails");
  });
});

const show = (id: number, city: string, date: string, time = "20:00"): BookerShow => ({
  id,
  city,
  neighborhood: null,
  date,
  time,
  venue: `Venue ${id}`,
  capacity: null,
  producerNames: [],
});

describe("booker filters", () => {
  const shows = [
    show(1, "Austin, TX", "2026-12-05"),
    show(2, "Dallas, TX", "2026-12-03"),
    show(3, "Austin, TX", "2026-12-01"),
  ];

  it("filter by city and date range, sorted by date", () => {
    const f = parseBookerFilters({ city: "Austin, TX", from: "2026-12-02" }, ["Austin, TX", "Dallas, TX"]);
    expect(filterBookerShows(shows, f).map((s) => s.id)).toEqual([1]);
    const all = parseBookerFilters({ sort: "desc" }, []);
    expect(filterBookerShows(shows, all).map((s) => s.id)).toEqual([1, 2, 3]);
    const asc = parseBookerFilters({}, []);
    expect(filterBookerShows(shows, asc).map((s) => s.id)).toEqual([3, 2, 1]);
  });

  it("ignore unknown cities and bad dates", () => {
    const f = parseBookerFilters({ city: "Nowhere", from: "2026-13-40", market: "Paris, FR" }, ["Austin, TX"]);
    expect(f).toEqual({ city: "", market: "", from: "", to: "", sort: "asc" });
  });

  it("filter by market within 50 miles", () => {
    const f = parseBookerFilters({ market: "Houston, TX" }, []);
    const coords = new Map([
      ["houston, tx", { latitude: 29.76, longitude: -95.37 }],
      ["katy, tx", { latitude: 29.79, longitude: -95.82 }],
      ["austin, tx", { latitude: 30.27, longitude: -97.74 }],
    ]);
    const list = [show(1, "Katy, TX", "2026-12-01"), show(2, "Austin, TX", "2026-12-01"), show(3, "Mystery, TX", "2026-12-01")];
    expect(filterBookerShows(list, f, coords).map((s) => s.id)).toEqual([1]);
  });
});

describe("run planner", () => {
  it("groups by date and city and finds consecutive nights", () => {
    const runs = planRuns([
      show(1, "Austin, TX", "2026-12-01"),
      show(2, "Houston, TX", "2026-12-02"),
      show(3, "Houston, TX", "2026-12-03", "19:00"),
      show(4, "Houston, TX", "2026-12-03", "21:00"),
      show(5, "Dallas, TX", "2026-12-03"),
      show(6, "Tulsa, OK", "2026-12-06"),
    ]);
    expect(runs.map((r) => [r.start, r.end, r.nights])).toEqual([
      ["2026-12-01", "2026-12-03", 3],
      ["2026-12-06", "2026-12-06", 1],
    ]);
    const dec3 = runs[0].days[2];
    expect(dec3.cities.map((c) => [c.city, c.shows.map((s) => s.id), c.consecutive])).toEqual([
      ["Dallas, TX", [5], false],
      ["Houston, TX", [3, 4], true],
    ]);
    expect(runs[0].days[0].cities[0].consecutive).toBe(false);
  });

  it("crosses month boundaries", () => {
    const runs = planRuns([show(1, "Austin, TX", "2026-12-31"), show(2, "Austin, TX", "2027-01-01")]);
    expect(runs).toHaveLength(1);
    expect(runs[0].nights).toBe(2);
  });

  it("neutralizes spreadsheet formulas in the CSV", () => {
    expect(bookerShowsCsv([{ ...show(1, "Austin, TX", "2026-12-01"), venue: "=HYPERLINK()" }])).toContain(
      "'=HYPERLINK()"
    );
  });
});
