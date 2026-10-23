import { beforeEach, describe, expect, it } from "vitest";
import { groupRows, moveIndex, nextColor, type Category } from "../src/lib/categories";
import { toLocalISO } from "../src/lib/dates";
import { presetRule } from "../src/lib/recurrence";
import { buildRows } from "../src/lib/rows";
import type { StorageBackend } from "../src/lib/storage";
import type { Item } from "../src/lib/types";
import {
  addCategory,
  addItem,
  assignCategory,
  categories,
  ensureOccurrences,
  initStore,
  items,
  makeRepeating,
  moveCategory,
  removeCategory,
  series,
  updateCategory,
} from "../src/state/store";
import { toast } from "../src/state/toast";

const now = new Date(2026, 9, 22, 12);
const t = now.getTime();
const item = (id: string, days: number, extra: Partial<Item> = {}): Item => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return { id, title: id, type: "due", dateTime: toLocalISO(d), createdAt: "x", updatedAt: "x", source: "manual", ...extra };
};
const memory = (): StorageBackend => {
  const data: Record<string, unknown> = {};
  return { get: async () => ({ ...data }), set: async (v) => void Object.assign(data, v), subscribe: () => () => {} };
};

beforeEach(async () => {
  await initStore(memory());
  items.value = [];
  series.value = [];
  categories.value = [];
});

describe("grouping", () => {
  it("lists every category in order (empty ones too), then uncategorized rows, soonest first", () => {
    const cats: Category[] = [
      { id: "math", name: "Math", color: "teal" },
      { id: "cs", name: "CS", color: "violet" },
      { id: "art", name: "Art", color: "pink" },
    ];
    const list = [item("a", 3, { categoryId: "cs" }), item("b", 1, { categoryId: "cs" }), item("c", 2), item("d", 4, { categoryId: "gone" })];
    const groups = groupRows(buildRows(list, t).upcoming, cats);
    expect(groups.map((g) => [g.category?.id ?? null, g.rows.map((r) => (r.kind === "single" ? r.item.id : ""))])).toEqual([
      ["math", []],
      ["cs", ["b", "a"]],
      ["art", []],
      [null, ["c", "d"]], // "gone" is an unknown category
    ]);
  });

  it("picks unused colors first, and moves list entries", () => {
    expect(nextColor([{ id: "x", name: "X", color: "indigo" }])).toBe("violet");
    expect(moveIndex(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveIndex(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });
});

describe("category actions", () => {
  it("adds, renames, recolors, collapses and reorders", () => {
    const a = addCategory("  Math ", "teal");
    const b = addCategory("", "pink");
    expect(categories.value.map((c) => c.name)).toEqual(["Math", "Untitled"]);
    updateCategory(b.id, { name: "Art", color: "amber", collapsed: true });
    expect(categories.value[1]).toMatchObject({ name: "Art", color: "amber", collapsed: true });
    updateCategory(b.id, { name: "   " });
    expect(categories.value[1]!.name).toBe("Art");
    moveCategory(b.id, 0);
    expect(categories.value.map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it("assigns a whole series, including occurrences generated later, with undo", () => {
    const cs = addCategory("CS", "violet");
    addItem(makeRepeating(item("first", 2, { title: "Lab" }), presetRule("weekly"), { type: "never" }));
    ensureOccurrences(t);
    const sid = series.value[0]!.id;

    assignCategory({ kind: "series", id: sid }, cs.id);
    expect(items.value.every((i) => i.categoryId === cs.id)).toBe(true);
    expect(series.value[0]!.categoryId).toBe(cs.id);
    expect(toast.value?.message).toBe("Moved to CS");

    // A newly generated occurrence inherits the category.
    items.value = items.value.filter((i) => i.id !== "first");
    ensureOccurrences(t);
    expect(items.value.every((i) => i.categoryId === cs.id)).toBe(true);

    toast.value!.action!.run();
    expect(series.value[0]!.categoryId).toBeUndefined();
  });

  it("deleting a category uncategorizes its items; undo restores it in place", () => {
    const a = addCategory("A", "teal");
    const b = addCategory("B", "pink");
    addItem(item("x", 1, { categoryId: b.id }));
    removeCategory(b.id);
    expect(categories.value.map((c) => c.id)).toEqual([a.id]);
    expect(items.value[0]!.categoryId).toBeUndefined();
    toast.value!.action!.run();
    expect(categories.value.map((c) => c.id)).toEqual([a.id, b.id]);
    expect(items.value[0]!.categoryId).toBe(b.id);
  });

  it("moves a single item out of its category", () => {
    const a = addCategory("A", "teal");
    addItem(item("x", 1, { categoryId: a.id }));
    assignCategory({ kind: "item", id: "x" }, null);
    expect(items.value[0]!.categoryId).toBeUndefined();
    expect(toast.value?.message).toBe("Removed from category");
  });
});
