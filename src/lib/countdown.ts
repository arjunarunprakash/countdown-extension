import type { Unit } from "./types";

export const UNITS: readonly Unit[] = ["days", "hours", "minutes", "seconds"];

const UNIT_MS: Record<Unit, number> = {
  days: 86_400_000,
  hours: 3_600_000,
  minutes: 60_000,
  seconds: 1_000,
};

export const UNIT_LABEL: Record<Unit, string> = {
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",
};

export function nextUnit(unit: Unit): Unit {
  return UNITS[(UNITS.indexOf(unit) + 1) % UNITS.length]!;
}

/** Whole units remaining (rounded down), or null once the moment has passed. */
export function unitsRemaining(target: number, now: number, unit: Unit): number | null {
  const ms = target - now;
  if (ms <= 0) return null;
  return Math.floor(ms / UNIT_MS[unit]);
}

const grouped = new Intl.NumberFormat("en-US");

/**
 * Fits a count into the countdown box:
 *   0        → "<1"   (less than one whole unit left)
 *   1–9,999  → "1,240"
 *   ≥10,000  → "12.4K", "2.6M", "1.1B" (one decimal, trailing .0 dropped)
 */
export function abbreviate(value: number): string {
  if (value < 1) return "<1";
  if (value < 10_000) return grouped.format(value);
  const steps: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of steps) {
    if (value >= size) {
      // Round down so the box never overstates the time left.
      const scaled = Math.floor((value / size) * 10) / 10;
      // 999,999 would floor to "999.9K"; that still fits, so no promotion needed.
      return `${scaled.toFixed(1).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return grouped.format(value);
}

/** Full remaining time for tooltips and screen readers: "2 days, 4 hours, 12 minutes". */
export function describeRemaining(target: number, now: number): string {
  let ms = target - now;
  if (ms <= 0) return "Passed";
  const parts: string[] = [];
  for (const unit of UNITS) {
    const n = Math.floor(ms / UNIT_MS[unit]);
    ms -= n * UNIT_MS[unit];
    if (n > 0) parts.push(`${grouped.format(n)} ${n === 1 ? unit.slice(0, -1) : unit}`);
    // Seconds only matter in the last hour; otherwise they're noise.
    if (unit === "minutes" && parts.length > 0 && target - now >= UNIT_MS.hours) break;
  }
  return parts.length ? parts.join(", ") : "Less than a second";
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/** Short relative label for secondary text: "in 4 days", "in 3 hours", "in 1 day". */
export function relativeLabel(target: number, now: number): string {
  const ms = target - now;
  const abs = Math.abs(ms);
  const sign = Math.sign(ms) || 1;
  if (abs >= UNIT_MS.days) return relative.format(sign * Math.floor(abs / UNIT_MS.days), "day");
  if (abs >= UNIT_MS.hours) return relative.format(sign * Math.floor(abs / UNIT_MS.hours), "hour");
  return relative.format(sign * Math.max(1, Math.floor(abs / UNIT_MS.minutes)), "minute");
}
