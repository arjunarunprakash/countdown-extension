import { describe, expect, it } from "vitest";
import {
  formatTime,
  formatTypedDate,
  nearestTimeOption,
  parseTime,
  parseTypedDate,
  TIME_OPTIONS,
} from "../src/lib/parse";

describe("parseTypedDate", () => {
  it.each([
    ["10/29/2026", { year: 2026, month: 9, day: 29 }],
    ["1/5/2027", { year: 2027, month: 0, day: 5 }],
    ["01-05-2027", { year: 2027, month: 0, day: 5 }],
    ["1.5.27", { year: 2027, month: 0, day: 5 }],
    [" 12 / 31 / 2026 ", { year: 2026, month: 11, day: 31 }],
    ["2/29/2028", { year: 2028, month: 1, day: 29 }], // leap year
  ])("%s", (text, expected) => {
    expect(parseTypedDate(text)).toEqual(expected);
  });

  it.each(["", "10/29", "13/01/2026", "00/10/2026", "02/30/2026", "2/29/2027", "4/31/2026", "10/0/2026", "abc", "10/29/202"])(
    "rejects %j",
    (text) => {
      expect(parseTypedDate(text)).toBeNull();
    },
  );

  it("round-trips through formatTypedDate", () => {
    expect(formatTypedDate({ year: 2026, month: 0, day: 5 })).toBe("01/05/2026");
    expect(parseTypedDate(formatTypedDate({ year: 2026, month: 0, day: 5 }))).toEqual({ year: 2026, month: 0, day: 5 });
  });
});

describe("parseTime", () => {
  it.each([
    ["3pm", 15, 0],
    ["3 PM", 15, 0],
    ["3:30pm", 15, 30],
    ["3:30 p.m.", 15, 30],
    ["11a", 11, 0],
    ["12am", 0, 0],
    ["12pm", 12, 0],
    ["12:15\u00a0AM", 0, 15],
    ["15:00", 15, 0],
    ["1500", 15, 0],
    ["0930", 9, 30],
    ["9", 9, 0],
    ["0", 0, 0],
    ["23:59", 23, 59],
    ["noon", 12, 0],
    ["Midnight", 0, 0],
  ])("%s → %d:%d", (text, hour, minute) => {
    expect(parseTime(text)).toEqual({ hour, minute });
  });

  it.each(["", "25", "24:00", "13pm", "0am", "3:60", "3:5", "3pmm", "half past three", "1:2:3"])("rejects %j", (text) => {
    expect(parseTime(text)).toBeNull();
  });
});

describe("formatTime", () => {
  it.each([
    [0, 0, "12:00\u00a0AM"],
    [0, 5, "12:05\u00a0AM"],
    [9, 30, "9:30\u00a0AM"],
    [12, 0, "12:00\u00a0PM"],
    [15, 45, "3:45\u00a0PM"],
    [23, 59, "11:59\u00a0PM"],
  ])("%d:%d → %s", (hour, minute, expected) => {
    expect(formatTime({ hour, minute })).toBe(expected);
  });

  it("is parsed back by parseTime", () => {
    for (const t of TIME_OPTIONS) expect(parseTime(formatTime(t))).toEqual(t);
  });
});

describe("time options", () => {
  it("covers the day in 15-minute steps", () => {
    expect(TIME_OPTIONS).toHaveLength(96);
    expect(TIME_OPTIONS[0]).toEqual({ hour: 0, minute: 0 });
    expect(TIME_OPTIONS.at(-1)).toEqual({ hour: 23, minute: 45 });
  });

  it("finds the first option at or after a time", () => {
    expect(TIME_OPTIONS[nearestTimeOption({ hour: 15, minute: 0 })]).toEqual({ hour: 15, minute: 0 });
    expect(TIME_OPTIONS[nearestTimeOption({ hour: 15, minute: 10 })]).toEqual({ hour: 15, minute: 15 });
    expect(TIME_OPTIONS[nearestTimeOption({ hour: 23, minute: 50 })]).toEqual({ hour: 23, minute: 45 });
  });
});
