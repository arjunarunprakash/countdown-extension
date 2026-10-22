import { describe, expect, it } from "vitest";
import { place } from "../src/lib/position";

const viewport = { width: 360, height: 800 };
const anchor = { top: 100, left: 120, width: 140, height: 32 };

describe("place", () => {
  it("goes below the anchor, start-aligned, by default", () => {
    expect(place(anchor, { width: 200, height: 300 }, viewport)).toEqual({ top: 136, left: 120, side: "bottom" });
  });

  it("aligns to the anchor's end or center", () => {
    expect(place(anchor, { width: 100, height: 50 }, viewport, { align: "end" }).left).toBe(160);
    expect(place(anchor, { width: 100, height: 50 }, viewport, { align: "center" }).left).toBe(140);
  });

  it("clamps inside the viewport horizontally", () => {
    expect(place(anchor, { width: 300, height: 50 }, viewport).left).toBe(52); // 360 - 8 - 300
    expect(place({ ...anchor, left: 2, width: 50 }, { width: 100, height: 50 }, viewport, { align: "end" }).left).toBe(8);
  });

  it("flips above when there is no room below but room above", () => {
    const low = { ...anchor, top: 600 };
    expect(place(low, { width: 200, height: 300 }, viewport)).toEqual({ top: 296, left: 120, side: "top" });
  });

  it("caps height on the roomier side when it fits on neither", () => {
    const mid = { ...anchor, top: 300 };
    const result = place(mid, { width: 200, height: 700 }, viewport);
    expect(result.side).toBe("bottom"); // 456px below vs 288 above
    expect(result.maxHeight).toBe(456);
    expect(result.top).toBe(336);
  });
});
