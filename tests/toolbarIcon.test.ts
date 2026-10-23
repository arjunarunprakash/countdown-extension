import { describe, expect, it } from "vitest";
import { badgeText, countdownStart, iconState, nextRefresh, nextUp, RESTING_SWEEP, sweepFraction } from "../src/lib/toolbarIcon";
import type { Item } from "../src/lib/types";

const H = 3_600_000;
const D = 24 * H;
const now = Date.UTC(2026, 9, 22, 12);
const iso = (t: number) => new Date(t).toISOString();
const item = (id: string, at: number, extra: Partial<Item> = {}): Item => ({
  id, title: id, type: "due", dateTime: iso(at), createdAt: iso(now - D), updatedAt: iso(now), source: "manual", ...extra,
});

describe("toolbar icon", () => {
  it("counts down to the soonest upcoming item, skipping past and completed ones", () => {
    const items = [item("late", now + 5 * D), item("done", now + D, { completedAt: iso(now) }), item("past", now - H), item("soon", now + 2 * D)];
    expect(nextUp(items, now)?.id).toBe("soon");
    expect(nextUp([item("past", now - H)], now)).toBeNull();
  });

  it("sweeps the share of time left since the item was added", () => {
    // Added a day ago, due in a day: half left.
    expect(sweepFraction(now - D, now + D, now)).toBeCloseTo(0.5);
    // Never empty, never more than full.
    expect(sweepFraction(now - 99 * D, now + 60_000, now)).toBe(0.06);
    expect(sweepFraction(now + H, now + D, now)).toBe(1);
    expect(sweepFraction(Number.NaN, now + D, now)).toBe(1);
  });

  it("measures a repeating item from its previous occurrence", () => {
    const week = 7 * D;
    const items = [
      item("w1", now - 2 * D, { seriesId: "s", completedAt: iso(now) }),
      item("w2", now - 2 * D + week, { seriesId: "s", createdAt: iso(now - 30 * D) }),
    ];
    expect(countdownStart(items[1]!, items)).toBe(now - 2 * D);
    expect(iconState(items, now, true).sweep).toBeCloseTo(5 / 7);
  });

  it("badges whole days, then hours, then minutes", () => {
    expect(badgeText(now + 3 * D + 5 * H, now)).toBe("3d");
    expect(badgeText(now + 5 * H + 59 * 60_000, now)).toBe("5h");
    expect(badgeText(now + 45 * 60_000 + 30_000, now)).toBe("45m");
    expect(badgeText(now + 10_000, now)).toBe("1m");
  });

  it("redraws when the badge or the sweep next changes, within 30 s – 6 h", () => {
    // Due in 2 days 3 hours, added long ago: the badge flips to "1d" in 3 hours, before the wedge moves visibly.
    expect(nextRefresh(now - 365 * D, now + 2 * D + 3 * H, now)).toBe(now + 3 * H);
    // Added an hour ago, due in 3 days: the wedge moves a step (1/96 of 3 d + 1 h) first.
    expect(nextRefresh(now - H, now + 3 * D, now)).toBeCloseTo(now + (3 * D + H) / 96, -1);
    expect(nextRefresh(now - 365 * D, now + 20_000, now)).toBe(now + 30_000);
    expect(nextRefresh(now - 365 * D, now + 400 * D, now)).toBe(now + 6 * H);
  });

  it("rests at the brand sweep with no badge when off or when nothing is coming up", () => {
    const items = [item("soon", now + 2 * D)];
    expect(iconState(items, now, false)).toEqual({ sweep: RESTING_SWEEP, badge: "", title: "Open Countdown", refreshAt: null });
    expect(iconState([], now, true).badge).toBe("");
    expect(iconState(items, now, true)).toMatchObject({ badge: "2d", title: "Countdown: soon due in 2 days" });
    expect(iconState([item("talk", now + 5 * H, { type: "starts" })], now, true).title).toBe("Countdown: talk starts in 5 hours");
  });
});
