import { describe, expect, it } from "vitest";
import { importShows, validateShows } from "@/app/admin/bulk-upload/actions";
import BulkUploadPage from "@/app/admin/bulk-upload/page";
import { importUsers, validateUsers } from "@/app/admin/users/import/actions";
import ImportUsersPage from "@/app/admin/users/import/page";
import { createLinkUsers, validateNames } from "@/app/admin/users/bulk-links/actions";
import BulkLinksPage from "@/app/admin/users/bulk-links/page";
import { updateUser } from "@/app/admin/users/actions";
import { createUserAsLeadProducer } from "@/app/producer/users/actions";
import { requireProducer } from "@/lib/auth";
import { creatableRoles } from "@/lib/roles";
import { executed, executedMatching, onSql } from "./helpers/fake-db";
import { RedirectError, redirectOf, signInAs } from "./helpers/fake-session";

const showRow = {
  show_title: "Austin, TX",
  showtime: "12/05/26 7:30 PM",
  producers: "Tom Truman",
  venue: "Somewhere",
  capacity: "",
  all_star: "",
  show_status: "",
};
const userRow = { name: "New Comic", email: "new@example.com", role: "comic", home_market: "", is_all_star: "", pass_level: "" };
const linkRow = { name: "Link Comic", home_market: "", all_star: "" };

// Every server entry point that uploads CSVs or creates users in bulk, for
// shows and for users: the server actions and their pages.
const BULK_ENDPOINTS: [string, () => unknown][] = [
  ["validateShows (show CSV preview)", () => validateShows([showRow])],
  ["importShows (show CSV import)", () => importShows([showRow])],
  ["validateUsers (user CSV preview)", () => validateUsers([userRow])],
  ["importUsers (user CSV import)", () => importUsers([userRow])],
  ["validateNames (bulk links preview)", () => validateNames([linkRow])],
  ["createLinkUsers (bulk links create)", () => createLinkUsers([linkRow])],
  ["/admin/bulk-upload page", () => BulkUploadPage()],
  ["/admin/users/import page", () => ImportUsersPage()],
  ["/admin/users/bulk-links page", () => BulkLinksPage()],
];

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const newComic = {
  name: "Ann Comic",
  email: "ann@example.com",
  password: "secret123",
  role: "comic",
  homeMarket: "Austin, TX",
};

describe("Lead Producer and bulk uploads", () => {
  it.each(BULK_ENDPOINTS)("rejects a Lead Producer from %s on the server", async (_name, call) => {
    signInAs("lead_producer");
    // requireAdmin sends non-admins to "/", which forwards them home.
    expect(await redirectOf(call)).toBe("/");
    // Turned away before touching the database.
    expect(executed).toEqual([]);
  });

  it.each(BULK_ENDPOINTS)("still lets an admin reach %s", async (_name, call) => {
    signInAs("admin");
    onSql(() => []);
    try {
      await call();
    } catch (err) {
      // An admin may be redirected on success (importShows), never turned away.
      if (!(err instanceof RedirectError)) throw err;
      expect(err.url.startsWith("/admin/")).toBe(true);
    }
  });
});

describe("Lead Producer role", () => {
  it("has the producer dashboard", async () => {
    signInAs("lead_producer");
    await expect(requireProducer()).resolves.toMatchObject({ role: "lead_producer" });
  });

  it("can only create comics and regular producers", () => {
    expect(creatableRoles("lead_producer")).toEqual(["comic", "producer"]);
    expect(creatableRoles("producer")).toEqual([]);
  });

  it("creates a comic through the shared flow and records created_by", async () => {
    signInAs("lead_producer", { id: 77 });
    const result = await createUserAsLeadProducer({}, form({ ...newComic, passLevel: "local" }));
    expect(result.success).toMatch(/Added Ann Comic/);
    const [insert] = executedMatching("insert into users");
    // name, email, hash, role, home_market, is_all_star, pass_level, created_by
    expect(insert.values[3]).toBe("comic");
    expect(insert.values[4]).toBe("Austin, TX");
    expect(insert.values[5]).toBe(false);
    expect(insert.values[6]).toBe("local");
    expect(insert.values[7]).toBe(77);
  });

  it("creates a regular producer", async () => {
    signInAs("lead_producer");
    const result = await createUserAsLeadProducer(
      {},
      form({ ...newComic, role: "producer", homeMarket: "" })
    );
    expect(result.success).toBeDefined();
    expect(executedMatching("insert into users")[0].values[3]).toBe("producer");
  });

  it.each(["admin", "booker", "lead_producer"])("refuses to create a %s", async (role) => {
    signInAs("lead_producer");
    const result = await createUserAsLeadProducer({}, form({ ...newComic, role }));
    expect(result.error).toBeDefined();
    expect(executedMatching("insert into users")).toEqual([]);
  });

  it("requires a home market for comics", async () => {
    signInAs("lead_producer");
    const result = await createUserAsLeadProducer({}, form({ ...newComic, homeMarket: "" }));
    expect(result.error).toBe("Comics need a home market.");
    expect(executed).toEqual([]);
  });

  it("can't grant all-star", async () => {
    signInAs("lead_producer");
    await createUserAsLeadProducer({}, form({ ...newComic, isAllStar: "on" }));
    expect(executedMatching("insert into users")[0].values[5]).toBe(false);
  });

  it("is refused to regular producers, comics and bookers", async () => {
    for (const role of ["producer", "comic", "booker"] as const) {
      signInAs(role);
      await redirectOf(() => createUserAsLeadProducer({}, form(newComic)));
    }
    expect(executed).toEqual([]);
  });

  it("lets the admin promote a producer to Lead Producer and back", async () => {
    signInAs("admin");
    onSql((q) => (q.text.startsWith("select role, email") ? [{ role: "producer", email: "p@x.com" }] : []));
    await expect(
      updateUser(5, { name: "Pat", email: "p@x.com", role: "lead_producer", hasTruck: null })
    ).resolves.toEqual({ ok: true });
    expect(executedMatching("update users set")[0].values).toContain("lead_producer");

    onSql((q) => (q.text.startsWith("select role, email") ? [{ role: "lead_producer", email: "p@x.com" }] : []));
    await updateUser(5, { name: "Pat", email: "p@x.com", role: "producer", hasTruck: null });
    expect(executedMatching("update users set")[1].values).toContain("producer");
  });

  it("never lets the admin edit make someone an admin", async () => {
    signInAs("admin");
    onSql((q) => (q.text.startsWith("select role, email") ? [{ role: "producer", email: "p@x.com" }] : []));
    const result = await updateUser(5, { name: "Pat", email: "p@x.com", role: "admin", hasTruck: null });
    expect(result.ok).toBe(false);
  });
});
