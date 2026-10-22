import { batch, effect } from "@preact/signals";
import { beforeEach, describe, expect, it } from "vitest";
import { toLocalISO } from "../src/lib/dates";
import { presetRule, WINDOW } from "../src/lib/recurrence";
import type { StorageBackend } from "../src/lib/storage";
import type { Item } from "../src/lib/types";
import {
  addItem,
  changeSeriesRule,
  ensureOccurrences,
  initStore,
  items,
  makeRepeating,
  removeSeries,
  saveSeries,
  series,
} from "../src/state/store";
import { toast } from "../src/state/toast";

function memoryBackend(): StorageBackend & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = {};
  return {
    data,
    get: async () => ({ ...data }),
    set: async (values) => void Object.assign(data, values),
    subscribe: () => () => {},
  };
}

const now = new Date(2026, 9, 21, 12);
const t = now.getTime();

function first(extra: Partial<Item> = {}): Item {
  return {
    id: "first",
    title: "Rent",
    type: "due",
    dateTime: toLocalISO(new Date(2026, 9, 26, 9)),
    createdAt: "x",
    updatedAt: "x",
    source: "manual",
    ...extra,
  };
}

const upcomingOf = (id: string) =>
  items.value.filter((i) => i.seriesId === id && !i.completedAt && Date.parse(i.dateTime) > t);

let backend: ReturnType<typeof memoryBackend>;

beforeEach(async () => {
  backend = memoryBackend();
  await initStore(backend);
  items.value = [];
  series.value = [];
});

describe("repeating items in the store", () => {
  it("makeRepeating + ensureOccurrences fills the window and persists", () => {
    addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" }));
    ensureOccurrences(t);
    const s = series.value[0]!;
    expect(upcomingOf(s.id)).toHaveLength(WINDOW);
    expect((backend.data.items as Item[]).length).toBe(WINDOW);
    expect(backend.data.series).toEqual(series.value);
  });

  it("changing the rule keeps the anchor and regenerates the rest", () => {
    addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    const anchor = items.value.find((i) => i.id === "first")!;

    changeSeriesRule(id, anchor, presetRule("daily"), { type: "count", count: 3 }, now);
    ensureOccurrences(t);

    const dates = upcomingOf(id).map((i) => new Date(i.dateTime).getDate());
    expect(dates).toEqual([26, 27, 28]);
    expect(series.value[0]!.epoch).toBe(1);
  });

  it("choosing 'Does not repeat' leaves the anchor as a one-off item", () => {
    addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    changeSeriesRule(id, items.value.find((i) => i.id === "first")!, null, { type: "never" }, now);
    ensureOccurrences(t);

    expect(series.value).toEqual([]);
    expect(items.value).toHaveLength(1);
    expect(items.value[0]!.seriesId).toBeUndefined();
  });

  it("removeSeries stops generation; undo restores items and series", () => {
    addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;

    removeSeries(id, now);
    ensureOccurrences(t);
    expect(items.value).toEqual([]);
    expect(series.value).toEqual([]);

    toast.value!.action!.run();
    expect(upcomingOf(id)).toHaveLength(WINDOW);
    expect(series.value.map((s) => s.id)).toEqual([id]);
  });

  it("saveSeries renames upcoming occurrences and the template, not completed ones", () => {
    addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    items.value = items.value.map((i) => (i.id === "first" ? { ...i, completedAt: "2026-10-20T00:00:00Z" } : i));

    saveSeries(id, { title: "Rent payment", type: "due" }, now);

    expect(items.value.find((i) => i.id === "first")!.title).toBe("Rent");
    expect(upcomingOf(id).every((i) => i.title === "Rent payment")).toBe(true);
    expect(series.value[0]!.template.title).toBe("Rent payment");
  });

  it("generates a replacement when an occurrence is completed", () => {
    addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    items.value = items.value.map((i) => (i.id === "first" ? { ...i, completedAt: "2026-10-21T12:00:00Z" } : i));
    ensureOccurrences(t);
    expect(upcomingOf(id)).toHaveLength(WINDOW);
  });

  it("storage matches memory when top-up runs as an effect (regression)", () => {
    const stop = effect(() => ensureOccurrences(t));
    try {
      batch(() => addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" })));
      expect(upcomingOf(series.value[0]!.id)).toHaveLength(WINDOW);
      expect(backend.data.series).toEqual(series.value);
      expect(backend.data.items).toEqual(items.value);

      // Even unbatched, the newest write must win in storage.
      addItem(makeRepeating(first({ id: "second" }), presetRule("daily"), { type: "never" }));
      expect(backend.data.series).toEqual(series.value);
      expect(backend.data.items).toEqual(items.value);
    } finally {
      stop();
    }
  });
});
