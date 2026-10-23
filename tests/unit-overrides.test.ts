import { describe, expect, it } from "vitest";
import { cycleItemUnit, unitOverrides } from "../src/state/ui";

describe("per-item units", () => {
  it("cycles one item through the units and clears when back at the header's unit", () => {
    unitOverrides.value = new Map();
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      cycleItemUnit("a", "days");
      seen.push(unitOverrides.value.get("a"));
    }
    expect(seen).toEqual(["hours", "minutes", "seconds", undefined]);
  });

  it("starts from the header's unit and leaves other items alone", () => {
    unitOverrides.value = new Map([["b", "seconds"]]);
    cycleItemUnit("a", "hours");
    expect(unitOverrides.value.get("a")).toBe("minutes");
    expect(unitOverrides.value.get("b")).toBe("seconds");
  });
});
