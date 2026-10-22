import { beforeEach, describe, expect, it } from "vitest";
import { toLocalISO } from "../src/lib/dates";
import { presetRule, WINDOW } from "../src/lib/recurrence";
import { buildRows } from "../src/lib/rows";
import type { StorageBackend } from "../src/lib/storage";
import type { Item } from "../src/lib/types";
import { selectableKeys, selectionEntries, seriesKey, splitKeys } from "../src/state/selection";
import { addItem, ensureOccurrences, initStore, items, makeRepeating, removeMany, series } from "../src/state/store";
import { toast } from "../src/state/toast";

const now = new Date(2026, 9, 22, 12);
const t = now.getTime();

function item(id: string, daysFromNow: number, extra: Partial<Item> = {}): Item {
  const d = new Date(now);
  d.setDate(d.getDate() + daysFromNow);
  return { id, title: id, type: "due", dateTime: toLocalISO(d), createdAt: "x", updatedAt: "x", source: "manual", ...extra };
}

const memory = (): StorageBackend => {
  const data: Record<string, unknown> = {};
  return { get: async () => ({ ...data }), set: async (v) => void Object.assign(data, v), subscribe: () => () => {} };
};

beforeEach(async () => {
  await initStore(memory());
  items.value = [];
  series.value = [];
  addItem(item("soon", 1));
  addItem(item("late", -1));
  addItem(item("done", 2, { completedAt: "2026-10-21T00:00:00Z" }));
  addItem(makeRepeating(item("weekly", 3, { title: "Planning" }), presetRule("weekly"), { type: "never" }));
  ensureOccurrences(t);
});

describe("selection", () => {
  it("offers upcoming rows (a stack as one key) and overdue items, not completed ones", () => {
    const sections = buildRows(items.value, t);
    const sid = series.value[0]!.id;
    expect(selectableKeys(sections)).toEqual(["soon", seriesKey(sid), "late"]);
  });

  it("turns keys into export entries in list order and ignores stale keys", () => {
    const sections = buildRows(items.value, t);
    const sid = series.value[0]!.id;
    const entries = selectionEntries(sections, new Set(["late", seriesKey(sid), "gone", "done"]));
    expect(entries.map((e) => e.kind)).toEqual(["series", "item"]);
    const first = entries[0]!;
    if (first.kind === "series") expect(first.upcoming).toHaveLength(WINDOW);
  });

  it("splits keys into item and series ids", () => {
    expect(splitKeys(["a", "series:s1", "b"])).toEqual({ itemIds: ["a", "b"], seriesIds: ["s1"] });
  });
});

describe("removeMany", () => {
  it("removes items and whole series together with one undo", () => {
    const sid = series.value[0]!.id;
    const before = items.value.length;
    removeMany(["soon"], [sid], now);

    expect(items.value.map((i) => i.id).sort()).toEqual(["done", "late"]);
    expect(series.value).toEqual([]);
    expect(toast.value?.message).toBe("2 items removed");

    toast.value!.action!.run();
    expect(items.value).toHaveLength(before);
    expect(series.value.map((s) => s.id)).toEqual([sid]);
  });

  it("names a lone series removal", () => {
    removeMany([], [series.value[0]!.id], now);
    expect(toast.value?.message).toBe("Repeating item removed");
  });
});
