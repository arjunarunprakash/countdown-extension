import { describe, expect, it } from "vitest";
import { addDays, addMonths, formatShortDay, monthGrid, nextMatchingDay, sameDay } from "../src/lib/calendar";

describe("monthGrid", () => {
  it("returns six Sunday-first weeks containing the month", () => {
    const grid = monthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ year: 2026, month: 8, day: 27 });
    expect(grid[4]).toEqual({ year: 2026, month: 9, day: 1 });
    expect(grid.at(-1)).toEqual({ year: 2026, month: 10, day: 7 });
    for (let i = 0; i < 42; i += 7) {
      const { year, month, day } = grid[i]!;
      expect(new Date(year, month, day).getDay()).toBe(0);
    }
  });

  it("handles a month that starts on Sunday", () => {
    expect(monthGrid(2026, 1)[0]).toEqual({ year: 2026, month: 1, day: 1 });
  });

  it("crosses year boundaries", () => {
    const grid = monthGrid(2026, 11);
    expect(grid.at(-1)!.year).toBe(2027);
  });
});

describe("date arithmetic", () => {
  it("adds days across months and years", () => {
    expect(addDays({ year: 2026, month: 11, day: 30 }, 3)).toEqual({ year: 2027, month: 0, day: 2 });
    expect(addDays({ year: 2026, month: 2, day: 1 }, -1)).toEqual({ year: 2026, month: 1, day: 28 });
  });

  it("clamps the day when adding months", () => {
    expect(addMonths({ year: 2026, month: 0, day: 31 }, 1)).toEqual({ year: 2026, month: 1, day: 28 });
    expect(addMonths({ year: 2028, month: 0, day: 31 }, 1)).toEqual({ year: 2028, month: 1, day: 29 });
    expect(addMonths({ year: 2026, month: 11, day: 15 }, 1)).toEqual({ year: 2027, month: 0, day: 15 });
    expect(addMonths({ year: 2026, month: 2, day: 15 }, -12)).toEqual({ year: 2025, month: 2, day: 15 });
  });

  it("compares days", () => {
    expect(sameDay({ year: 2026, month: 9, day: 29 }, { year: 2026, month: 9, day: 29 })).toBe(true);
    expect(sameDay({ year: 2026, month: 9, day: 29 }, { year: 2026, month: 10, day: 29 })).toBe(false);
  });
});

describe("formatShortDay", () => {
  it("formats as 'Thu, 29 Oct 2026'", () => {
    expect(formatShortDay({ year: 2026, month: 9, day: 29 })).toBe("Thu, 29 Oct 2026");
  });
});

describe("nextMatchingDay", () => {
  it("returns the day itself when it matches, else the next chosen weekday", () => {
    const thu = { year: 2026, month: 9, day: 29 }; // Thursday
    expect(nextMatchingDay(thu, [4])).toEqual(thu);
    expect(nextMatchingDay(thu, [1, 3])).toEqual({ year: 2026, month: 10, day: 2 }); // next Monday
    expect(nextMatchingDay(thu, [5])).toEqual({ year: 2026, month: 9, day: 30 });
    expect(nextMatchingDay(thu, [])).toEqual(thu);
  });
});
