import { describe, expect, it } from "vitest";
import { formatItemDate, toLocalISO } from "../src/lib/dates";

describe("formatItemDate", () => {
  it("formats as 'Weekday, D Month YYYY, h:mm AM'", () => {
    expect(formatItemDate(new Date(2026, 9, 29, 15, 0))).toBe("Thursday, 29 October 2026, 3:00\u00a0PM");
    expect(formatItemDate(new Date(2026, 0, 5, 0, 5))).toBe("Monday, 5 January 2026, 12:05\u00a0AM");
  });

  it("omits the time for all-day items", () => {
    expect(formatItemDate(new Date(2026, 9, 29), true)).toBe("Thursday, 29 October 2026");
  });
});

describe("toLocalISO", () => {
  it("round-trips to the same instant", () => {
    const d = new Date(2026, 9, 29, 15, 0, 0);
    expect(Date.parse(toLocalISO(d))).toBe(d.getTime());
  });

  it("keeps local wall-clock time and appends an offset", () => {
    expect(toLocalISO(new Date(2026, 9, 29, 15, 7, 9))).toMatch(/^2026-10-29T15:07:09[+-]\d{2}:\d{2}$/);
  });
});
