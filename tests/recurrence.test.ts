import { describe, expect, it } from "vitest";
import {
  describeEnd,
  describeRule,
  hasEnded,
  occurrenceAt,
  occurrences,
  presetOf,
  presetRule,
  topUp,
  WINDOW,
  type RepeatRule,
  type Series,
} from "../src/lib/recurrence";
import type { Item } from "../src/lib/types";
import { toLocalISO } from "../src/lib/dates";

const take = (start: Date, rule: RepeatRule, n: number) => {
  const out: string[] = [];
  for (const d of occurrences(start, rule)) {
    out.push(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
    if (out.length === n) break;
  }
  return out;
};

describe("occurrences", () => {
  it("daily keeps wall-clock time", () => {
    expect(take(new Date(2026, 9, 30, 9, 30), presetRule("daily"), 4)).toEqual([
      "2026-10-30 9:30",
      "2026-10-31 9:30",
      "2026-11-1 9:30",
      "2026-11-2 9:30",
    ]);
  });

  it("weekly and every 2 weeks", () => {
    expect(take(new Date(2026, 9, 29, 15), presetRule("weekly"), 3)).toEqual(["2026-10-29 15:00", "2026-11-5 15:00", "2026-11-12 15:00"]);
    expect(take(new Date(2026, 9, 29, 15), presetRule("biweekly"), 3)).toEqual(["2026-10-29 15:00", "2026-11-12 15:00", "2026-11-26 15:00"]);
  });

  it("every weekday skips weekends", () => {
    // Thu 29 Oct 2026
    expect(take(new Date(2026, 9, 29, 9), presetRule("weekdays"), 5)).toEqual([
      "2026-10-29 9:00",
      "2026-10-30 9:00",
      "2026-11-2 9:00",
      "2026-11-3 9:00",
      "2026-11-4 9:00",
    ]);
  });

  it("every weekday keeps a weekend start as the first occurrence", () => {
    expect(take(new Date(2026, 9, 31, 9), presetRule("weekdays"), 2)).toEqual(["2026-10-31 9:00", "2026-11-2 9:00"]);
  });

  it("monthly on the 31st falls back to the last day of shorter months", () => {
    expect(take(new Date(2026, 0, 31, 17), presetRule("monthly"), 4)).toEqual([
      "2026-1-31 17:00",
      "2026-2-28 17:00",
      "2026-3-31 17:00",
      "2026-4-30 17:00",
    ]);
  });

  it("annually on 29 February uses 28 February in common years", () => {
    expect(take(new Date(2028, 1, 29, 12), presetRule("yearly"), 3)).toEqual(["2028-2-29 12:00", "2029-2-28 12:00", "2030-2-28 12:00"]);
  });

  it("keeps 9:00 across a daylight-saving change", () => {
    // US DST ends 1 Nov 2026; the wall-clock time should not drift.
    const hours = take(new Date(2026, 9, 30, 9), presetRule("daily"), 5).map((s) => s.split(" ")[1]);
    expect(new Set(hours)).toEqual(new Set(["9:00"]));
  });
});

describe("presets", () => {
  it("round-trip through presetOf", () => {
    for (const p of ["daily", "weekdays", "weekly", "biweekly", "monthly", "yearly"] as const) {
      expect(presetOf(presetRule(p))).toBe(p);
    }
    expect(presetOf(null)).toBe("none");
    expect(presetOf({ freq: "DAILY", interval: 3 })).toBe("custom");
    expect(presetOf({ freq: "WEEKLY", interval: 1, weekdays: [1, 3, 5] })).toBe("weeklyOn");
    expect(presetOf({ freq: "WEEKLY", interval: 2, weekdays: [1, 3] })).toBe("custom");
  });

  it("describes rules from the start date", () => {
    const thu = new Date(2026, 9, 29);
    expect(describeRule(presetRule("weekly"), thu)).toBe("Weekly on Thursday");
    expect(describeRule(presetRule("biweekly"), thu)).toBe("Every 2 weeks on Thursday");
    expect(describeRule(presetRule("monthly"), thu)).toBe("Monthly on day 29 (or last day)");
    expect(describeRule(presetRule("monthly"), new Date(2026, 9, 5))).toBe("Monthly on day 5");
    expect(describeRule(presetRule("yearly"), thu)).toBe("Annually on 29 October");
    expect(describeRule(presetRule("weekdays"), thu)).toBe("Every weekday");
    expect(describeRule({ freq: "DAILY", interval: 3 }, thu)).toBe("Every 3 days");
  });

  it("describes ends", () => {
    expect(describeEnd({ type: "never" })).toBe("");
    expect(describeEnd({ type: "count", count: 10 })).toBe("10 times");
    expect(describeEnd({ type: "until", date: "2026-12-31" })).toBe("until 31 December");
  });
});

function series(extra: Partial<Series> = {}): Series {
  return {
    id: "s",
    epoch: 0,
    start: toLocalISO(new Date(2026, 9, 26, 10)), // Mon 26 Oct
    rule: presetRule("weekly"),
    end: { type: "never" },
    template: { title: "Planning", type: "starts" },
    nextIndex: 1,
    ...extra,
  };
}

const first: Item = {
  id: "first",
  title: "Planning",
  type: "starts",
  dateTime: toLocalISO(new Date(2026, 9, 26, 10)),
  createdAt: "x",
  updatedAt: "x",
  source: "manual",
  seriesId: "s",
};

describe("ends", () => {
  it("stops after a count", () => {
    const s = series({ end: { type: "count", count: 3 } });
    expect(occurrenceAt(s, 2)).not.toBeNull();
    expect(occurrenceAt(s, 3)).toBeNull();
  });

  it("stops after an until date (inclusive)", () => {
    const s = series({ end: { type: "until", date: "2026-11-09" } });
    expect(occurrenceAt(s, 2)?.getDate()).toBe(9);
    expect(occurrenceAt(s, 3)).toBeNull();
  });

  it("reports when a series has generated everything", () => {
    expect(hasEnded(series({ end: { type: "count", count: 2 }, nextIndex: 2 }))).toBe(true);
    expect(hasEnded(series({ nextIndex: 50 }))).toBe(false);
  });
});

describe("topUp", () => {
  const now = new Date(2026, 9, 21, 12).getTime();

  it("fills the window with upcoming occurrences after the existing first one", () => {
    const { added, series: s } = topUp(series(), [first], now);
    expect(added).toHaveLength(WINDOW - 1);
    expect(added[0]).toMatchObject({ id: "s~0~1", title: "Planning", type: "starts", seriesId: "s" });
    expect(new Date(added[0]!.dateTime).getDate()).toBe(2); // Mon 2 Nov
    expect(s.nextIndex).toBe(WINDOW);
  });

  it("is idempotent once the window is full", () => {
    const one = topUp(series(), [first], now);
    const two = topUp(one.series, [first, ...one.added], now);
    expect(two.added).toEqual([]);
    expect(two.series).toBe(one.series);
  });

  it("adds one more after an occurrence is completed", () => {
    const one = topUp(series(), [first], now);
    const done = [{ ...first, completedAt: "y" }, ...one.added];
    const two = topUp(one.series, done, now);
    expect(two.added).toHaveLength(1);
    expect(two.added[0]!.id).toBe(`s~0~${WINDOW}`);
  });

  it("skips occurrences that are already in the past instead of creating overdue ones", () => {
    const later = new Date(2026, 11, 1, 12).getTime(); // five weeks on
    const { added } = topUp(series(), [first], later);
    expect(added.every((i) => Date.parse(i.dateTime) > later)).toBe(true);
    expect(added).toHaveLength(WINDOW);
  });

  it("respects the end and reports it", () => {
    const { added, ended } = topUp(series({ end: { type: "count", count: 3 } }), [first], now);
    expect(added).toHaveLength(2);
    expect(ended).toBe(true);
  });

  it("does not regenerate an occurrence the user removed", () => {
    const one = topUp(series(), [first], now);
    const withoutSecond = [first, ...one.added.slice(1)];
    const two = topUp(one.series, withoutSecond, now);
    expect(two.added.map((i) => i.id)).not.toContain(one.added[0]!.id);
  });

  it("copies all-day and notes from the series", () => {
    const { added } = topUp(series({ allDay: true, template: { title: "Rent", type: "due", notes: "Transfer" } }), [first], now);
    expect(added[0]).toMatchObject({ allDay: true, notes: "Transfer", type: "due" });
  });
});
