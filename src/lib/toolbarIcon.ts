// What the toolbar icon shows: the Sweep mark, whose wedge is the share of
// time left until the next upcoming item, plus a short badge ("3d", "5h").
// Pure functions so they can be tested; the service worker draws the result.
import type { Item } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The brand mark's sweep when there's nothing to count down (or the live icon is off). */
export const RESTING_SWEEP = 0.75;
/** Smallest visible wedge, so "almost due" never looks empty. */
const MIN_SWEEP = 0.06;
/** The icon redraws when the wedge would move by about this much (1/96 of a turn). */
const SWEEP_STEP = 1 / 96;
/** Chrome runs alarms no sooner than 30 seconds out. */
const MIN_REFRESH = 30_000;
const MAX_REFRESH = 6 * HOUR;

const time = (iso: string) => Date.parse(iso);

/** The next item to count down to: soonest upcoming, not completed. */
export function nextUp(items: readonly Item[], now: number): Item | null {
  let best: Item | null = null;
  for (const item of items) {
    if (item.completedAt || time(item.dateTime) <= now) continue;
    if (!best || time(item.dateTime) < time(best.dateTime)) best = item;
  }
  return best;
}

/**
 * When the countdown to `item` started: the previous occurrence for a
 * repeating item (so a weekly class shows how much of the week is left),
 * otherwise when it was added.
 */
export function countdownStart(item: Item, items: readonly Item[]): number {
  const target = time(item.dateTime);
  let start = time(item.createdAt);
  if (item.seriesId) {
    for (const other of items) {
      if (other.seriesId !== item.seriesId) continue;
      const t = time(other.dateTime);
      if (t < target && (Number.isNaN(start) || t > start)) start = t;
    }
  }
  return start;
}

/** Share of the countdown still to go, 0–1 (shown as at least a sliver). */
export function sweepFraction(start: number, target: number, now: number): number {
  const total = target - start;
  if (!Number.isFinite(total) || total <= 0) return 1;
  const left = (target - now) / total;
  return Math.min(1, Math.max(MIN_SWEEP, left));
}

/** Badge text: whole days, then hours, then minutes ("3d", "5h", "45m"). */
export function badgeText(target: number, now: number): string {
  const ms = target - now;
  if (ms >= DAY) return `${Math.floor(ms / DAY)}d`;
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)}h`;
  return `${Math.max(1, Math.floor(ms / MINUTE))}m`;
}

/**
 * When the icon next needs redrawing: the badge's next change, the next
 * visible step of the wedge, or the item coming due, whichever is first.
 */
export function nextRefresh(start: number, target: number, now: number): number {
  const ms = target - now;
  const unit = ms >= DAY ? DAY : ms >= HOUR ? HOUR : MINUTE;
  // The badge changes when the remaining time drops below its current whole unit.
  const badgeChange = target - Math.floor(ms / unit) * unit;
  const total = target - start;
  const sweepChange = Number.isFinite(total) && total > 0 ? now + total * SWEEP_STEP : Infinity;
  const at = Math.min(badgeChange <= now ? now + unit : badgeChange, sweepChange, target);
  return Math.min(now + MAX_REFRESH, Math.max(now + MIN_REFRESH, at));
}

export interface IconState {
  /** Wedge size, 0–1. */
  sweep: number;
  badge: string;
  /** Hover text for the toolbar button. */
  title: string;
  /** Epoch ms of the next redraw, or null when nothing changes over time. */
  refreshAt: number | null;
}

/** Everything the toolbar icon should show right now. */
export function iconState(items: readonly Item[], now: number, live: boolean): IconState {
  const item = live ? nextUp(items, now) : null;
  if (!item) return { sweep: RESTING_SWEEP, badge: "", title: "Open Countdown", refreshAt: null };
  const target = time(item.dateTime);
  const start = countdownStart(item, items);
  const verb = item.type === "due" ? "due" : "starts";
  const title = `Countdown: ${item.title || "Untitled"} ${verb} in ${badgeLong(target, now)}`;
  return { sweep: sweepFraction(start, target, now), badge: badgeText(target, now), title, refreshAt: nextRefresh(start, target, now) };
}

function badgeLong(target: number, now: number): string {
  const ms = target - now;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (ms >= DAY) return plural(Math.floor(ms / DAY), "day");
  if (ms >= HOUR) return plural(Math.floor(ms / HOUR), "hour");
  return plural(Math.max(1, Math.floor(ms / MINUTE)), "minute");
}
