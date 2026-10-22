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
  flushWrites,
  initStore,
  items,
  makeRepeating,
  removeSeries,
  saveSeries,
  series,
} from "../src/state/store";
import { toast } from "../src/state/toast";

function memoryBackend(): StorageBackend & {
  data: Record<string, unknown>;
  writes: Record<string, unknown>[];
  remote: (changes: Record<string, unknown>) => void;
} {
  const data: Record<string, unknown> = {};
  const writes: Record<string, unknown>[] = [];
  let listener: (changes: Record<string, unknown>) => void = () => {};
  return {
    data,
    writes,
    get: async () => ({ ...data }),
    set: async (values) => {
      writes.push(values);
      Object.assign(data, values);
    },
    subscribe: (cb) => {
      listener = cb;
      return () => {};
    },
    // Simulates a change arriving from another panel.
    remote: (changes) => listener(changes),
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
    flushWrites();
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
      flushWrites();
      expect(upcomingOf(series.value[0]!.id)).toHaveLength(WINDOW);
      expect(backend.data.series).toEqual(series.value);
      expect(backend.data.items).toEqual(items.value);

      // Even unbatched, the newest write must win in storage.
      addItem(makeRepeating(first({ id: "second" }), presetRule("daily"), { type: "never" }));
      flushWrites();
      expect(backend.data.series).toEqual(series.value);
      expect(backend.data.items).toEqual(items.value);
    } finally {
      stop();
    }
  });

  it("numbers occurrences from a {n} template and re-numbers on rename", () => {
    const hw = first({ title: "Chapter 1 Homework" });
    addItem(makeRepeating(hw, presetRule("weekly"), { type: "count", count: 4 }, { template: "Chapter {n} Homework", numberFrom: 1 }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    expect(upcomingOf(id).map((i) => i.title)).toEqual([
      "Chapter 1 Homework",
      "Chapter 2 Homework",
      "Chapter 3 Homework",
      "Chapter 4 Homework",
    ]);

    saveSeries(id, { title: "Ch. {n} problems", type: "due", numberFrom: 3 }, now);
    expect(upcomingOf(id).map((i) => i.title)).toEqual(["Ch. 3 problems", "Ch. 4 problems", "Ch. 5 problems", "Ch. 6 problems"]);

    saveSeries(id, { title: "Problems", type: "due" }, now);
    expect(new Set(upcomingOf(id).map((i) => i.title))).toEqual(new Set(["Problems"]));
    expect(series.value[0]!.numberFrom).toBeUndefined();
  });

  it("keeps numbering when the rule restarts from a later occurrence", () => {
    addItem(makeRepeating(first({ title: "Lab 1" }), presetRule("weekly"), { type: "never" }, { template: "Lab {n}", numberFrom: 1 }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    const third = upcomingOf(id).find((i) => i.title === "Lab 3")!;
    // Restart from Lab 3 as occurrence 0, numbered from 3.
    changeSeriesRule(id, third, presetRule("biweekly"), { type: "count", count: 3 }, now, { template: "Lab {n}", numberFrom: 3 });
    ensureOccurrences(t);
    const titles = upcomingOf(id)
      .filter((i) => Date.parse(i.dateTime) >= Date.parse(third.dateTime))
      .map((i) => i.title);
    expect(titles).toEqual(["Lab 3", "Lab 4", "Lab 5"]);
  });

  it("creates a custom-dates series that generates exactly those days", () => {
    const rule = { freq: "DATES" as const, interval: 1, dates: ["2026-10-26", "2026-10-29", "2026-11-04"] };
    addItem(makeRepeating(first({ title: "Quiz 1" }), rule, { type: "never" }, { template: "Quiz {n}" }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    expect(upcomingOf(id).map((i) => [i.title, new Date(i.dateTime).getDate()])).toEqual([
      ["Quiz 1", 26],
      ["Quiz 2", 29],
      ["Quiz 3", 4],
    ]);
  });

  it("writes an action and the top-up it triggers as one storage write", async () => {
    const stop = effect(() => ensureOccurrences(t));
    try {
      flushWrites();
      backend.writes.length = 0;
      batch(() => addItem(makeRepeating(first(), presetRule("weekly"), { type: "never" })));
      await Promise.resolve();
      expect(backend.writes).toHaveLength(1);
      expect(Object.keys(backend.writes[0]!).sort()).toEqual(["items", "series"]);
      expect((backend.writes[0]!.items as Item[]).length).toBe(WINDOW);
    } finally {
      stop();
    }
  });

  it("doesn't write back when another panel's change arrives", async () => {
    const stop = effect(() => ensureOccurrences(t));
    try {
      flushWrites();
      backend.writes.length = 0;
      // Another panel created a series; its occurrences haven't arrived here yet.
      const s = { id: "remote", epoch: 0, start: first().dateTime, rule: presetRule("weekly"), end: { type: "never" }, template: { title: "Rent", type: "due" }, nextIndex: 1 };
      backend.remote({ series: [s] });
      await Promise.resolve();
      expect(backend.writes).toEqual([]);
      expect(series.value.map((x) => x.id)).toEqual(["remote"]);
    } finally {
      stop();
    }
  });

  it("keeps an occurrence renamed on its own through series renames and rule changes", () => {
    addItem(makeRepeating(first({ title: "Chapter 1 Homework" }), presetRule("weekly"), { type: "count", count: 4 }, { template: "Chapter {n} Homework", numberFrom: 1 }));
    ensureOccurrences(t);
    const id = series.value[0]!.id;
    const third = upcomingOf(id)[2]!;
    items.value = items.value.map((i) => (i.id === third.id ? { ...i, title: "Chapter 3 (part 2) Homework", customTitle: true } : i));

    saveSeries(id, { title: "Ch. {n}", type: "due", numberFrom: 1 }, now);
    expect(upcomingOf(id).map((i) => i.title)).toEqual(["Ch. 1", "Ch. 2", "Chapter 3 (part 2) Homework", "Ch. 4"]);

    const renamed = upcomingOf(id)[2]!;
    changeSeriesRule(id, renamed, presetRule("biweekly"), { type: "count", count: 2 }, now, { template: "Ch. {n}", numberFrom: 3 });
    ensureOccurrences(t);
    expect(upcomingOf(id).filter((i) => Date.parse(i.dateTime) >= Date.parse(renamed.dateTime)).map((i) => i.title)).toEqual([
      "Chapter 3 (part 2) Homework",
      "Ch. 4",
    ]);
  });
});

