import { describe, expect, it } from "vitest";
import { complete, differs, fieldsOf, newItem, removeIds, restore, uncomplete, withFields } from "../src/lib/items";
import type { Item } from "../src/lib/types";

const now = new Date(2026, 9, 21, 22, 30);

function item(id: string, extra: Partial<Item> = {}): Item {
  return {
    id,
    title: id,
    type: "due",
    dateTime: "2026-10-29T15:00:00-07:00",
    createdAt: "2026-10-01T00:00:00-07:00",
    updatedAt: "2026-10-01T00:00:00-07:00",
    source: "manual",
    ...extra,
  };
}

describe("newItem", () => {
  it("defaults to a Due item tomorrow at 9:00 AM with an empty title", () => {
    const it = newItem(now, "x");
    const d = new Date(it.dateTime);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 22, 9, 0]);
    expect(it).toMatchObject({ id: "x", title: "", type: "due", source: "manual" });
  });

  it("rolls over month ends", () => {
    const d = new Date(newItem(new Date(2026, 9, 31, 12), "x").dateTime);
    expect([d.getMonth(), d.getDate()]).toEqual([10, 1]);
  });
});

describe("fields round trip", () => {
  it("preserves a timed item", () => {
    const original = item("a", { notes: "Bring slides" });
    const next = withFields(original, fieldsOf(original), now);
    expect(differs(original, next)).toBe(false);
    expect(next.updatedAt).not.toBe(original.updatedAt);
  });

  it("treats the same instant with a different offset as unchanged", () => {
    const utc = item("a", { dateTime: "2026-10-29T22:00:00Z" });
    const next = withFields(utc, fieldsOf(utc), now);
    expect(differs(utc, next)).toBe(false);
  });

  it("stores a cleared time as all-day at local midnight", () => {
    const f = { ...fieldsOf(item("a")), time: null };
    const next = withFields(item("a"), f, now);
    expect(next.allDay).toBe(true);
    const d = new Date(next.dateTime);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
    expect(fieldsOf(next).time).toBeNull();
  });

  it("drops allDay when a time is set again", () => {
    const allDay = item("a", { allDay: true, dateTime: "2026-10-29T00:00:00-07:00" });
    const next = withFields(allDay, { ...fieldsOf(allDay), time: { hour: 9, minute: 15 } }, now);
    expect(next.allDay).toBeUndefined();
  });

  it("trims title and notes, and removes empty notes", () => {
    const next = withFields(item("a", { notes: "old" }), { ...fieldsOf(item("a")), title: "  Report  ", notes: "   " }, now);
    expect(next.title).toBe("Report");
    expect("notes" in next).toBe(false);
  });
});

describe("remove and restore", () => {
  const list = [item("a"), item("b"), item("c"), item("d")];

  it("removes by id and remembers positions", () => {
    const { next, removed } = removeIds(list, new Set(["b", "d"]));
    expect(next.map((i) => i.id)).toEqual(["a", "c"]);
    expect(removed.map((r) => [r.item.id, r.index])).toEqual([
      ["b", 1],
      ["d", 3],
    ]);
  });

  it("restores items to their original order", () => {
    const { next, removed } = removeIds(list, new Set(["a", "c"]));
    expect(restore(next, removed).map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("restores sensibly after other changes and never duplicates", () => {
    const { next, removed } = removeIds(list, new Set(["b"]));
    const changed = [...next, item("e")];
    expect(restore(changed, removed).map((i) => i.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(restore(restore(changed, removed), removed).map((i) => i.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("complete and uncomplete", () => {
  it("marks the item and returns a completion record", () => {
    const result = complete([item("a"), item("b")], "a", now)!;
    expect(result.next[0]!.completedAt).toBeDefined();
    expect(result.next[1]!.completedAt).toBeUndefined();
    expect(result.record).toMatchObject({ itemId: "a", title: "a", type: "due", dateTime: item("a").dateTime });
  });

  it("ignores missing or already-completed items", () => {
    expect(complete([item("a")], "zzz", now)).toBeNull();
    expect(complete([item("a", { completedAt: "2026-10-20T00:00:00Z" })], "a", now)).toBeNull();
  });

  it("uncomplete removes completedAt entirely", () => {
    const { next } = complete([item("a")], "a", now)!;
    expect("completedAt" in uncomplete(next, "a")[0]!).toBe(false);
  });
});
