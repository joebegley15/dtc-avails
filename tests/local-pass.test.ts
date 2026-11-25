import { describe, expect, it } from "vitest";
import { loadVisibleShows } from "@/lib/avails";
import { setOwnHomeMarket, submitAvails } from "@/app/avails/actions";
import { validateShows } from "@/app/admin/bulk-upload/actions";
import { setPassLevel } from "@/app/admin/users/actions";
import {
  haversineMiles,
  LOCAL_PASS_RADIUS_MILES,
  parsePassLevel,
  passAllowsShow,
} from "@/lib/pass-level";
import { normalizeUserHeader, planUserImport, type UserCsvRow } from "@/lib/user-import";
import { validateNewUser } from "@/lib/user-create";
import { executedMatching, onSql } from "./helpers/fake-db";
import { signInAs } from "./helpers/fake-session";

// Austin, and points due north of it: one degree of latitude is
// 3958.8 * pi / 180 = 69.093 miles.
const AUSTIN = { latitude: 30.2672, longitude: -97.7431 };
const north = (miles: number) => ({
  latitude: AUSTIN.latitude + miles / ((3958.8 * Math.PI) / 180),
  longitude: AUSTIN.longitude,
});
const AT_30_MILES = north(30);
const AT_70_MILES = north(70);

// Shows in three cities: 30 miles from Austin, 70 miles, and one with no
// coordinates in the cities table.
const SHOWS = [
  { id: 1, city: "Thirty Town, TX" },
  { id: 2, city: "Seventy Town, TX" },
  { id: 3, city: "Unknown Town, TX" },
].map((s) => ({
  ...s,
  neighborhood: null,
  show_date: "2026-12-10",
  show_time: "20:00",
  is_all_star: false,
  locked: false,
  available: null,
  down_to_help: false,
  in_town: false,
}));

const CITY_ROWS = [
  { key: "austin, tx", ...AUSTIN },
  { key: "thirty town, tx", ...AT_30_MILES },
  { key: "seventy town, tx", ...AT_70_MILES },
];

function fakeDb(homeMarket: string | null = "Austin, TX") {
  onSql((q) => {
    if (q.text.startsWith("select s.id, s.city")) return SHOWS;
    if (q.text.startsWith("select home_market from users")) return [{ home_market: homeMarket }];
    if (q.text.startsWith("select home_market, has_truck"))
      return [{ home_market: homeMarket, has_truck: false, last_submitted_at: null }];
    if (q.text.includes("from cities")) {
      const keys = q.values[0] as string[];
      return CITY_ROWS.filter((c) => keys.includes(c.key));
    }
    return [];
  });
}

describe("haversine distance check", () => {
  it("measures the test points at 30 and 70 miles", () => {
    expect(haversineMiles(AUSTIN, AT_30_MILES)).toBeCloseTo(30, 1);
    expect(haversineMiles(AUSTIN, AT_70_MILES)).toBeCloseTo(70, 1);
  });

  it("uses one 50-mile constant", () => {
    expect(LOCAL_PASS_RADIUS_MILES).toBe(50);
  });

  it("allows a show 30 miles away, not 70, and not an unknown city", () => {
    expect(passAllowsShow("local", AUSTIN, AT_30_MILES)).toBe(true);
    expect(passAllowsShow("local", AUSTIN, AT_70_MILES)).toBe(false);
    expect(passAllowsShow("local", AUSTIN, undefined)).toBe(false);
    expect(passAllowsShow("local", undefined, AT_30_MILES)).toBe(false);
  });

  it("lets a full pass see all three", () => {
    expect(passAllowsShow("full", AUSTIN, AT_30_MILES)).toBe(true);
    expect(passAllowsShow("full", AUSTIN, AT_70_MILES)).toBe(true);
    expect(passAllowsShow("full", AUSTIN, undefined)).toBe(true);
  });
});

describe("what a locally passed comic sees", () => {
  it("only sees the show 30 miles away", async () => {
    fakeDb();
    const user = signInAs("comic", { passLevel: "local" });
    expect((await loadVisibleShows(user)).map((s) => s.id)).toEqual([1]);
  });

  it("sees nothing without a home market", async () => {
    fakeDb(null);
    const user = signInAs("comic", { passLevel: "local" });
    expect(await loadVisibleShows(user)).toEqual([]);
  });

  it("is unchanged for a fully passed comic: every show", async () => {
    fakeDb();
    const user = signInAs("comic", { passLevel: "full" });
    expect((await loadVisibleShows(user)).map((s) => s.id)).toEqual([1, 2, 3]);
    expect(executedMatching("from cities")).toEqual([]);
  });
});

describe("saving a local comic's avails (server-side)", () => {
  it("saves only the 30-mile show, even if the browser sends all three", async () => {
    fakeDb();
    signInAs("comic", { passLevel: "local" });
    const result = await submitAvails(
      SHOWS.map((s) => ({ showId: s.id, available: true, downToHelp: false, inTown: false })),
      false
    );
    expect(result).toEqual({ ok: true, saved: 1 });
    const saved = executedMatching("insert into avails").map((q) => q.values[1]);
    expect(saved).toEqual([1]);
  });

  it("can't move their own home market to reach other shows", async () => {
    fakeDb();
    signInAs("comic", { passLevel: "local" });
    const result = await setOwnHomeMarket("Dallas, TX");
    expect(result.ok).toBe(false);
    expect(executedMatching("update users set home_market")).toEqual([]);
  });
});

describe("admin bulk show import", () => {
  it("warns about show cities missing coordinates", async () => {
    signInAs("admin");
    onSql((q) => (q.text.startsWith("select id, name from users") ? [{ id: 7, name: "Tom Truman" }] : []));
    const row = (city: string, venue: string) => ({
      show_title: city,
      showtime: "12/05/26 7:30 PM",
      producers: "Tom Truman",
      venue,
      capacity: "",
      all_star: "",
      show_status: "",
    });
    const result = await validateShows([
      row("Zzyzxburg, TX", "A"),
      // Not in the table yet, but the bundled zip data knows it.
      row("Houston, TX", "B"),
    ]);
    if ("error" in result) throw new Error(result.error);
    expect(result.citiesMissingCoords).toEqual(["Zzyzxburg, TX"]);
  });
});

describe("setting the pass level", () => {
  it("lets the admin set a comic to local", async () => {
    signInAs("admin");
    onSql((q) => (q.text.startsWith("update users set pass_level") ? [{ id: 9 }] : []));
    await expect(setPassLevel(9, "local")).resolves.toEqual({ ok: true });
  });

  it("parses the Pass Level cell", () => {
    expect(parsePassLevel(" Local ")).toBe("local");
    expect(parsePassLevel("FULL")).toBe("full");
    expect(parsePassLevel("")).toBeNull();
    expect(parsePassLevel("partial")).toBe("bad");
    expect(normalizeUserHeader(" Pass Level ")).toBe("pass_level");
  });

  it("accepts an optional Pass Level column in the user import", () => {
    const row = (email: string, pass_level: string, role = "comic"): UserCsvRow => ({
      name: email.split("@")[0],
      email,
      role,
      home_market: "Austin, TX",
      is_all_star: "",
      pass_level,
    });
    const plans = planUserImport(
      [row("a@x.com", "local"), row("b@x.com", ""), row("c@x.com", "nope"), row("d@x.com", "local", "producer")],
      []
    );
    expect(plans.map((p) => (p.user ? p.user.passLevel : p.errors[0]))).toEqual([
      "local",
      null, // blank: new comics start full
      "Bad pass level: nope (use full or local)",
      "Only comics have a pass level",
    ]);
  });

  it("lets a Lead Producer pick the level for a new comic", () => {
    const data = new FormData();
    for (const [k, v] of Object.entries({
      name: "Lo Cal",
      email: "lo@x.com",
      password: "secret123",
      role: "comic",
      homeMarket: "Austin, TX",
      passLevel: "local",
    }))
      data.set(k, v);
    const result = validateNewUser("lead_producer", data);
    expect("fields" in result && result.fields.passLevel).toBe("local");
  });
});
