import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { importShows, validateShows } from "@/app/admin/bulk-upload/actions";
import { isRejectedStatus, normalizeShowHeader, parseShowCsv } from "@/lib/show-csv";
import { executed, executedMatching, onSql } from "./helpers/fake-db";
import { redirectOf, signInAs } from "./helpers/fake-session";

function fixture(name: string) {
  const parsed = parseShowCsv(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.rows;
}

beforeEach(() => {
  signInAs("admin");
  onSql((q) => {
    if (q.text.startsWith("select id, name from users")) return [{ id: 7, name: "Tom Truman" }];
    if (q.text.includes("insert into show_producers")) return [{ show_id: 1 }];
    return [];
  });
});

/** Venues of the shows the import inserted. */
function insertedVenues(): unknown[] {
  return executedMatching("insert into shows").map((q) => q.values[4]);
}

describe("Show Status column", () => {
  it("matches the header case-insensitively, ignoring whitespace", () => {
    expect(normalizeShowHeader(" SHOW status ")).toBe("show_status");
    expect(normalizeShowHeader("Show Status")).toBe("show_status");
  });

  it("treats only Rejected (any case, trimmed) as rejected", () => {
    expect(isRejectedStatus("Rejected")).toBe(true);
    expect(isRejectedStatus("  rejected  ")).toBe(true);
    expect(isRejectedStatus("REJECTED")).toBe(true);
    expect(isRejectedStatus("Approved")).toBe(false);
    expect(isRejectedStatus("")).toBe(false);
    expect(isRejectedStatus(undefined)).toBe(false);
    expect(isRejectedStatus("not rejected")).toBe(false);
  });

  it("previews Rejected and rejected rows as skipped, others as ready", async () => {
    const result = await validateShows(fixture("shows-with-status.csv"));
    if ("error" in result) throw new Error(result.error);
    expect(result.rows.map((r) => [r.raw.venue, r.rejected, r.show !== null])).toEqual([
      ["Rejected Room", true, false],
      ["Lowercase Lounge", true, false],
      ["Approved Hall", false, true],
      ["Blank Status Bar", false, true],
    ]);
    // Rejected rows aren't validated, so they never show errors.
    expect(result.rows[0].errors).toEqual([]);
  });

  it("imports only non-rejected rows and reports the rejected count", async () => {
    const url = await redirectOf(() => importShows(fixture("shows-with-status.csv")));
    expect(insertedVenues()).toEqual(["Approved Hall", "Blank Status Bar"]);
    expect(url).toBe("/admin/shows?imported=2&skipped=0&errors=0&rejected=2");
    // Show Status is never written anywhere.
    expect(executed.some((q) => /status/i.test(q.text))).toBe(false);
    expect(executed.some((q) => q.values.includes("Approved"))).toBe(false);
  });

  it("imports a file without the column exactly as before", async () => {
    const rows = fixture("shows-no-status.csv");
    expect(rows.every((r) => r.show_status === "")).toBe(true);
    const url = await redirectOf(() => importShows(rows));
    expect(insertedVenues()).toEqual(["Rejected Room", "Lowercase Lounge"]);
    expect(url).toBe("/admin/shows?imported=2&skipped=0&errors=0&rejected=0");
  });

  it("counts a rejected row as rejected even when its other cells are invalid", async () => {
    const rows = fixture("shows-with-status.csv");
    rows[0].showtime = "not a date";
    const url = await redirectOf(() => importShows(rows));
    expect(url).toContain("errors=0&rejected=2");
  });
});
