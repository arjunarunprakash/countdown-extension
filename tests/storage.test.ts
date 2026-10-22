import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, isItem, isSeries, loadState, parsePrefs, SCHEMA_VERSION, type StorageBackend } from "../src/lib/storage";

function memoryBackend(initial: Record<string, unknown> = {}): StorageBackend & { data: Record<string, unknown> } {
  const data = { ...initial };
  return {
    data,
    get: async () => ({ ...data }),
    set: async (values) => void Object.assign(data, values),
    subscribe: () => () => {},
  };
}

const valid = {
  id: "a",
  title: "Report",
  type: "due",
  dateTime: "2026-10-29T15:00:00-07:00",
  createdAt: "2026-10-01T00:00:00-07:00",
  updatedAt: "2026-10-01T00:00:00-07:00",
  source: "manual",
};

describe("loadState", () => {
  it("returns defaults on first run and stamps the schema version", async () => {
    const backend = memoryBackend();
    const state = await loadState(backend);
    expect(state).toEqual({ items: [], completions: [], series: [], prefs: DEFAULT_PREFS });
    expect(backend.data.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("keeps valid records and drops malformed ones", async () => {
    const backend = memoryBackend({
      schemaVersion: SCHEMA_VERSION,
      items: [valid, { ...valid, id: 7 }, { ...valid, type: "soon" }, { ...valid, dateTime: "not a date" }, null, "x"],
      completions: [
        { id: "c", itemId: "a", title: "Report", type: "due", dateTime: valid.dateTime, completedAt: valid.dateTime },
        { id: "broken" },
      ],
    });
    const state = await loadState(backend);
    expect(state.items.map((i) => i.id)).toEqual(["a"]);
    expect(state.completions.map((c) => c.id)).toEqual(["c"]);
  });

  it("survives non-array values", async () => {
    const state = await loadState(memoryBackend({ items: { a: 1 }, completions: "nope", prefs: 42 }));
    expect(state).toEqual({ items: [], completions: [], series: [], prefs: DEFAULT_PREFS });
  });
});

describe("isSeries", () => {
  const series = {
    id: "s",
    epoch: 0,
    start: valid.dateTime,
    rule: { freq: "WEEKLY", interval: 1, weekdays: [1, 2, 3, 4, 5] },
    end: { type: "never" },
    template: { title: "Standup", type: "starts" },
    nextIndex: 3,
  };

  it("accepts a valid series and each end type", () => {
    expect(isSeries(series)).toBe(true);
    expect(isSeries({ ...series, end: { type: "count", count: 5 } })).toBe(true);
    expect(isSeries({ ...series, end: { type: "until", date: "2027-01-31" } })).toBe(true);
  });

  it("rejects malformed rules, ends and templates", () => {
    expect(isSeries({ ...series, rule: { freq: "HOURLY", interval: 1 } })).toBe(false);
    expect(isSeries({ ...series, rule: { freq: "DAILY", interval: 0 } })).toBe(false);
    expect(isSeries({ ...series, rule: { freq: "WEEKLY", interval: 1, weekdays: [7] } })).toBe(false);
    expect(isSeries({ ...series, end: { type: "count", count: -1 } })).toBe(false);
    expect(isSeries({ ...series, end: { type: "until", date: "31/01/2027" } })).toBe(false);
    expect(isSeries({ ...series, template: null })).toBe(false);
    expect(isSeries({ ...series, nextIndex: 1.5 })).toBe(false);
  });
});

describe("isItem", () => {
  it("accepts optional fields of the right type only", () => {
    expect(isItem({ ...valid, notes: "n", allDay: true, seriesId: "s", uid: "u" })).toBe(true);
    expect(isItem({ ...valid, allDay: "yes" })).toBe(false);
    expect(isItem({ ...valid, notes: 3 })).toBe(false);
    expect(isItem({ ...valid, completedAt: "never" })).toBe(false);
  });
});

describe("parsePrefs", () => {
  it("falls back per field", () => {
    expect(parsePrefs({ unit: "hours", theme: "sepia", completedCollapsed: "no" })).toEqual({
      ...DEFAULT_PREFS,
      unit: "hours",
    });
    expect(parsePrefs({ unit: "weeks", theme: "dark" })).toMatchObject({ unit: "days", theme: "dark" });
  });

  it("migrates the old single Past section's collapsed state to Overdue", () => {
    expect(parsePrefs({ pastCollapsed: true }).overdueCollapsed).toBe(true);
    expect(parsePrefs({ pastCollapsed: true, overdueCollapsed: false }).overdueCollapsed).toBe(false);
  });
});
