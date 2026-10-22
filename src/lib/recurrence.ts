import { toLocalISO } from "./dates";
import { daysInMonth } from "./parse";
import type { Item, ItemType } from "./types";

// Repeat rules are a subset of iCalendar RRULE (FREQ, INTERVAL, BYDAY,
// UNTIL, COUNT) so imported and exported series map onto them directly.

export type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RepeatRule {
  freq: Freq;
  interval: number;
  /** WEEKLY only: weekdays to repeat on, 0 = Sunday. */
  weekdays?: number[];
}

export type RepeatEnd =
  | { type: "never" }
  /** Last allowed day, local YYYY-MM-DD (inclusive). */
  | { type: "until"; date: string }
  /** Total occurrences, counting the first. */
  | { type: "count"; count: number };

export interface Series {
  id: string;
  /** Bumped when the rule changes, so regenerated occurrences get fresh ids. */
  epoch: number;
  /** Occurrence 0; later occurrences keep its wall-clock time. */
  start: string;
  allDay?: boolean;
  rule: RepeatRule;
  end: RepeatEnd;
  /** Fields copied onto newly generated occurrences. */
  template: { title: string; type: ItemType; notes?: string };
  /** Index of the next occurrence to generate. */
  nextIndex: number;
}

/** Occurrences kept generated ahead of now for each open-ended series. */
export const WINDOW = 6;

// ── Presets offered in the editor ─────────────────────────────

export type RepeatPreset = "none" | "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly" | "custom";

const WEEKDAYS = [1, 2, 3, 4, 5];

export function presetRule(preset: Exclude<RepeatPreset, "none" | "custom">): RepeatRule {
  switch (preset) {
    case "daily":
      return { freq: "DAILY", interval: 1 };
    case "weekdays":
      return { freq: "WEEKLY", interval: 1, weekdays: WEEKDAYS };
    case "weekly":
      return { freq: "WEEKLY", interval: 1 };
    case "biweekly":
      return { freq: "WEEKLY", interval: 2 };
    case "monthly":
      return { freq: "MONTHLY", interval: 1 };
    case "yearly":
      return { freq: "YEARLY", interval: 1 };
  }
}

export function presetOf(rule: RepeatRule | null): RepeatPreset {
  if (!rule) return "none";
  const { freq, interval, weekdays } = rule;
  if (weekdays?.length) {
    return freq === "WEEKLY" && interval === 1 && weekdays.join() === WEEKDAYS.join() ? "weekdays" : "custom";
  }
  if (interval === 1) return ({ DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" } as const)[freq];
  if (freq === "WEEKLY" && interval === 2) return "biweekly";
  return "custom";
}

const weekdayName = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const shortWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

/** Human label for a rule, phrased from its start date: "Weekly on Thursday". */
export function describeRule(rule: RepeatRule, start: Date): string {
  const n = rule.interval;
  switch (rule.freq) {
    case "DAILY":
      return n === 1 ? "Daily" : `Every ${n} days`;
    case "WEEKLY": {
      if (presetOf(rule) === "weekdays") return "Every weekday";
      const days = rule.weekdays?.length
        ? rule.weekdays.map((d) => shortWeekday.format(new Date(2026, 1, 1 + d))).join(", ")
        : weekdayName.format(start);
      return `${n === 1 ? "Weekly" : `Every ${n} weeks`} on ${days}`;
    }
    case "MONTHLY": {
      const day = start.getDate();
      const suffix = day > 28 ? ` (or last day)` : "";
      return `${n === 1 ? "Monthly" : `Every ${n} months`} on day ${day}${suffix}`;
    }
    case "YEARLY":
      return `${n === 1 ? "Annually" : `Every ${n} years`} on ${dayMonth.format(start)}`;
  }
}

/** Short end description for stack tiles: "until 31 Dec", "10 times". */
export function describeEnd(end: RepeatEnd): string {
  if (end.type === "until") {
    const [y, m, d] = end.date.split("-").map(Number) as [number, number, number];
    return `until ${dayMonth.format(new Date(y, m - 1, d))}`;
  }
  if (end.type === "count") return `${end.count} times`;
  return "";
}

// ── Occurrence generation ─────────────────────────────────────

/** Same day-of-month in a month `months` away, clamped to that month's last day. */
function clampedMonth(y: number, m: number, d: number, months: number, h: number, mi: number): Date {
  const first = new Date(y, m + months, 1);
  const day = Math.min(d, daysInMonth(first.getFullYear(), first.getMonth()));
  return new Date(first.getFullYear(), first.getMonth(), day, h, mi);
}

/**
 * Yields occurrence dates in order, starting with `start` itself.
 * Wall-clock time is preserved across DST changes. Monthly/yearly dates
 * past the end of a shorter month land on its last day.
 */
export function* occurrences(start: Date, rule: RepeatRule): Generator<Date> {
  const [y, m, d, h, mi] = [start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()];
  const n = Math.max(1, Math.floor(rule.interval));
  yield new Date(start);

  if (rule.freq === "WEEKLY" && rule.weekdays?.length) {
    const days = new Set(rule.weekdays);
    const weekStart = d - start.getDay(); // Sunday of the start week
    for (let offset = 1; offset < 366 * 50; offset++) {
      const date = new Date(y, m, d + offset, h, mi);
      const week = Math.floor((d + offset - weekStart) / 7);
      if (week % n === 0 && days.has(date.getDay())) yield date;
    }
    return;
  }

  for (let k = 1; k < 100_000; k++) {
    switch (rule.freq) {
      case "DAILY":
        yield new Date(y, m, d + k * n, h, mi);
        break;
      case "WEEKLY":
        yield new Date(y, m, d + 7 * k * n, h, mi);
        break;
      case "MONTHLY":
        yield clampedMonth(y, m, d, k * n, h, mi);
        break;
      case "YEARLY":
        yield clampedMonth(y, m, d, 12 * k * n, h, mi);
        break;
    }
  }
}

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function withinEnd(date: Date, index: number, end: RepeatEnd): boolean {
  if (end.type === "count") return index < end.count;
  if (end.type === "until") return ymd(date) <= end.date;
  return true;
}

/** The occurrence at `index`, or null if the series has ended before it. */
export function occurrenceAt(series: Series, index: number): Date | null {
  let i = 0;
  for (const date of occurrences(new Date(series.start), series.rule)) {
    if (!withinEnd(date, i, series.end)) return null;
    if (i === index) return date;
    i++;
  }
  return null;
}

export const occurrenceId = (series: Series, index: number) => `${series.id}~${series.epoch}~${index}`;

/**
 * Generates occurrences until the series has WINDOW upcoming, uncompleted
 * occurrences or ends. Occurrences that would already be in the past are
 * skipped, so a panel left closed for a month doesn't flood Overdue.
 * Ids are deterministic, so two panels topping up at once agree.
 */
export function topUp(
  series: Series,
  items: readonly Item[],
  now: number,
): { series: Series; added: Item[]; ended: boolean } {
  let upcoming = items.filter(
    (i) => i.seriesId === series.id && !i.completedAt && Date.parse(i.dateTime) > now,
  ).length;
  const existing = new Set(items.map((i) => i.id));
  const added: Item[] = [];
  let next = series.nextIndex;
  let ended = false;

  // Walk the generator once instead of calling occurrenceAt per index.
  let i = 0;
  const gen = occurrences(new Date(series.start), series.rule);
  for (const date of gen) {
    if (upcoming >= WINDOW && i >= next) break;
    if (!withinEnd(date, i, series.end)) {
      ended = true;
      break;
    }
    if (i >= next) {
      next = i + 1;
      if (date.getTime() > now) {
        const id = occurrenceId(series, i);
        if (!existing.has(id)) {
          const stamp = toLocalISO(new Date(now));
          const item: Item = {
            id,
            title: series.template.title,
            type: series.template.type,
            dateTime: toLocalISO(date),
            createdAt: stamp,
            updatedAt: stamp,
            source: "manual",
            seriesId: series.id,
          };
          if (series.allDay) item.allDay = true;
          if (series.template.notes) item.notes = series.template.notes;
          added.push(item);
        }
        upcoming++;
      }
    }
    i++;
    if (i > 100_000) break;
  }

  return { series: next === series.nextIndex ? series : { ...series, nextIndex: next }, added, ended };
}

/** True once a series has generated its last occurrence. */
export function hasEnded(series: Series): boolean {
  return occurrenceAt(series, series.nextIndex) === null;
}
