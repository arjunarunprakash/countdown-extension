import { describe, expect, it } from "vitest";
import { buildRows } from "../src/lib/rows";
import type { Item } from "../src/lib/types";

const now = Date.parse("2026-10-21T12:00:00Z");

function item(id: string, dateTime: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    title: id,
    type: "due",
    dateTime,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    source: "manual",
    ...extra,
  };
}

describe("buildRows", () => {
  it("sorts upcoming items soonest first and past items most recent first", () => {
    const { upcoming, overdue: past } = buildRows(
      [
        item("later", "2026-11-01T00:00:00Z"),
        item("old", "2026-10-01T00:00:00Z"),
        item("soon", "2026-10-22T00:00:00Z"),
        item("recent", "2026-10-20T00:00:00Z"),
      ],
      now,
    );
    expect(upcoming.map((r) => (r.kind === "single" ? r.item.id : r.seriesId))).toEqual(["soon", "later"]);
    expect(past.map((i) => i.id)).toEqual(["recent", "old"]);
  });

  it("collapses a series into one stack headed by its next occurrence", () => {
    const { upcoming, overdue: past } = buildRows(
      [
        item("s3", "2026-11-04T10:00:00Z", { seriesId: "s" }),
        item("s1", "2026-10-14T10:00:00Z", { seriesId: "s" }),
        item("s2", "2026-10-28T10:00:00Z", { seriesId: "s" }),
        item("solo", "2026-10-30T00:00:00Z"),
      ],
      now,
    );
    expect(upcoming).toHaveLength(2);
    const stack = upcoming[0]!;
    expect(stack.kind).toBe("stack");
    if (stack.kind === "stack") expect(stack.items.map((i) => i.id)).toEqual(["s2", "s3"]);
    // The passed occurrence leaves the stack for the Past section.
    expect(past.map((i) => i.id)).toEqual(["s1"]);
  });

  it("renders a series with one upcoming occurrence as a single tile", () => {
    const { upcoming } = buildRows([item("s1", "2026-10-28T10:00:00Z", { seriesId: "s" })], now);
    expect(upcoming[0]!.kind).toBe("single");
  });

  it("puts completed items only in the completed section, newest first", () => {
    const { upcoming, overdue, completed } = buildRows(
      [
        item("done-future", "2026-11-01T00:00:00Z", { completedAt: "2026-10-20T00:00:00Z" }),
        item("done-past", "2026-10-01T00:00:00Z", { completedAt: "2026-09-30T00:00:00Z" }),
      ],
      now,
    );
    expect(upcoming).toEqual([]);
    expect(overdue).toEqual([]);
    expect(completed.map((i) => i.id)).toEqual(["done-future", "done-past"]);
  });

  it("treats an item due exactly now as past", () => {
    const { upcoming, overdue: past } = buildRows([item("now", "2026-10-21T12:00:00Z")], now);
    expect(upcoming).toEqual([]);
    expect(past).toHaveLength(1);
  });
});
