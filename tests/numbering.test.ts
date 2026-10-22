import { describe, expect, it } from "vitest";
import { toLocalISO } from "../src/lib/dates";
import { hasNumberToken, insertToken, renderTitle } from "../src/lib/numbering";
import { describeRule, occurrences, occurrenceTitle, presetOf, presetRule, topUp, type Series } from "../src/lib/recurrence";
import { isSeries } from "../src/lib/storage";
import type { Item } from "../src/lib/types";

describe("numbered titles", () => {
  it("renders the token by position and start number", () => {
    expect(renderTitle("Chapter {n} Homework", 0)).toBe("Chapter 1 Homework");
    expect(renderTitle("Chapter {n} Homework", 3)).toBe("Chapter 4 Homework");
    expect(renderTitle("Week {N}: quiz {n}", 1, 5)).toBe("Week 6: quiz 6");
    expect(renderTitle("No token", 2)).toBe("No token");
    expect(hasNumberToken("Lab {n}")).toBe(true);
    expect(hasNumberToken("Lab n")).toBe(false);
  });

  it("inserts at the caret, or replaces a selected number and starts from it", () => {
    expect(insertToken("Chapter  Homework", 8, 8)).toEqual({ title: "Chapter {n} Homework", caret: 11 });
    expect(insertToken("Chapter 5 Homework", 8, 9)).toEqual({ title: "Chapter {n} Homework", caret: 11, from: 5 });
    expect(insertToken("Chapter one", 8, 11)).toEqual({ title: "Chapter {n}", caret: 11 });
  });
});

const series = (extra: Partial<Series> = {}): Series => ({
  id: "s",
  epoch: 0,
  start: toLocalISO(new Date(2026, 9, 26, 17)),
  rule: presetRule("weekly"),
  end: { type: "count", count: 4 },
  template: { title: "Chapter {n} Homework", type: "due" },
  nextIndex: 1,
  numberFrom: 1,
  ...extra,
});

describe("custom dates", () => {
  const rule = { freq: "DATES" as const, interval: 1, dates: ["2026-11-20", "2026-10-26", "2026-11-03"] };

  it("yields each chosen day in order at the series time", () => {
    const dates = [...occurrences(new Date(2026, 9, 26, 17), rule)].map((d) => [d.getMonth() + 1, d.getDate(), d.getHours()]);
    expect(dates).toEqual([
      [10, 26, 17],
      [11, 3, 17],
      [11, 20, 17],
    ]);
  });

  it("is described and recognised as its own preset", () => {
    expect(describeRule(rule, new Date())).toBe("On 3 custom dates");
    expect(presetOf(rule)).toBe("dates");
  });

  it("validates in storage", () => {
    expect(isSeries(series({ rule }))).toBe(true);
    expect(isSeries(series({ rule: { freq: "DATES", interval: 1, dates: [] } }))).toBe(false);
    expect(isSeries(series({ rule: { freq: "DATES", interval: 1, dates: ["26/10/2026"] } }))).toBe(false);
    expect(isSeries(series({ rule: { freq: "WEEKLY", interval: 1, dates: ["2026-10-26"] } }))).toBe(false);
  });
});

describe("numbered series", () => {
  const first: Item = {
    id: "first",
    title: "Chapter 1 Homework",
    type: "due",
    dateTime: series().start,
    createdAt: "x",
    updatedAt: "x",
    source: "manual",
    seriesId: "s",
  };

  it("generates numbered occurrences up to the end", () => {
    const { added } = topUp(series(), [first], new Date(2026, 9, 20).getTime());
    expect(added.map((i) => i.title)).toEqual(["Chapter 2 Homework", "Chapter 3 Homework", "Chapter 4 Homework"]);
  });

  it("numbers custom dates too, from a chosen start", () => {
    const s = series({
      rule: { freq: "DATES", interval: 1, dates: ["2026-10-26", "2026-11-03", "2026-11-20"] },
      end: { type: "never" },
      numberFrom: 5,
    });
    const { added } = topUp(s, [{ ...first, title: "Chapter 5 Homework" }], new Date(2026, 9, 20).getTime());
    expect(added.map((i) => i.title)).toEqual(["Chapter 6 Homework", "Chapter 7 Homework"]);
  });

  it("leaves titles alone when the series doesn't number", () => {
    expect(occurrenceTitle(series({ numberFrom: undefined, template: { title: "Rent {n}", type: "due" } }), 3)).toBe("Rent {n}");
  });
});
