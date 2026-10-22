import { describe, expect, it } from "vitest";
import { abbreviate, describeRemaining, nextUnit, unitsRemaining } from "../src/lib/countdown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("unitsRemaining", () => {
  const now = Date.UTC(2026, 9, 21, 12);

  it("rounds down to whole units", () => {
    expect(unitsRemaining(now + 2.9 * DAY, now, "days")).toBe(2);
    expect(unitsRemaining(now + 2.9 * DAY, now, "hours")).toBe(69);
    expect(unitsRemaining(now + 90 * MIN, now, "minutes")).toBe(90);
    expect(unitsRemaining(now + 1_500, now, "seconds")).toBe(1);
  });

  it("returns 0 when less than one unit is left", () => {
    expect(unitsRemaining(now + 3 * HOUR, now, "days")).toBe(0);
  });

  it("returns null at and after the target", () => {
    expect(unitsRemaining(now, now, "seconds")).toBeNull();
    expect(unitsRemaining(now - 1, now, "days")).toBeNull();
  });
});

describe("abbreviate", () => {
  it.each([
    [0, "<1"],
    [1, "1"],
    [999, "999"],
    [1_240, "1,240"],
    [9_999, "9,999"],
    [10_000, "10K"],
    [12_449, "12.4K"],
    [999_999, "999.9K"],
    [2_592_000, "2.5M"],
    [2_650_000, "2.6M"],
    [1_100_000_000, "1.1B"],
  ])("%d → %s", (value, expected) => {
    expect(abbreviate(value)).toBe(expected);
  });

  it("never rounds up", () => {
    expect(abbreviate(19_999)).toBe("19.9K");
  });
});

describe("describeRemaining", () => {
  const now = 0;

  it("lists days, hours and minutes, omitting zero parts", () => {
    expect(describeRemaining(2 * DAY + 4 * HOUR + 12 * MIN + 30_000, now)).toBe("2 days, 4 hours, 12 minutes");
    expect(describeRemaining(DAY + 5 * MIN, now)).toBe("1 day, 5 minutes");
  });

  it("adds seconds only in the final hour", () => {
    expect(describeRemaining(12 * MIN + 5_000, now)).toBe("12 minutes, 5 seconds");
    expect(describeRemaining(1_000, now)).toBe("1 second");
  });

  it("handles sub-second and past targets", () => {
    expect(describeRemaining(500, now)).toBe("Less than a second");
    expect(describeRemaining(-1, now)).toBe("Passed");
  });
});

describe("nextUnit", () => {
  it("cycles Days → Hours → Minutes → Seconds → Days", () => {
    expect(nextUnit("days")).toBe("hours");
    expect(nextUnit("hours")).toBe("minutes");
    expect(nextUnit("minutes")).toBe("seconds");
    expect(nextUnit("seconds")).toBe("days");
  });
});
