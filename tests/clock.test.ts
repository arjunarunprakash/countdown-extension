import { describe, expect, it } from "vitest";
import { msUntilNextTick } from "../src/state/clock";

describe("msUntilNextTick", () => {
  const base = Date.UTC(2026, 9, 21, 12, 0, 0);

  it("lands just after the next whole second in Seconds mode", () => {
    expect(msUntilNextTick(base + 250, "seconds")).toBe(755);
    expect(msUntilNextTick(base, "seconds")).toBe(1005);
  });

  it("lands just after the next whole minute otherwise", () => {
    for (const unit of ["minutes", "hours", "days"] as const) {
      expect(msUntilNextTick(base + 59_000, unit)).toBe(1_005);
      expect(msUntilNextTick(base + 1_000, unit)).toBe(59_005);
    }
  });
});
