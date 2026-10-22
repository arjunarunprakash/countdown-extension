import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, isItem, loadState, parsePrefs, SCHEMA_VERSION, type StorageBackend } from "../src/lib/storage";

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
    expect(state).toEqual({ items: [], completions: [], prefs: DEFAULT_PREFS });
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
    expect(state).toEqual({ items: [], completions: [], prefs: DEFAULT_PREFS });
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
