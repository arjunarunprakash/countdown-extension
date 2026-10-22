import { formatItemDate } from "./dates";
import type { DateParts } from "./parse";

/** 42 days (6 weeks, Sunday first) covering the given month. */
export function monthGrid(year: number, month: number): DateParts[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  });
}

export function sameDay(a: DateParts, b: DateParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function addDays(p: DateParts, days: number): DateParts {
  const d = new Date(p.year, p.month, p.day + days);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/** Same day-of-month in another month, clamped (Jan 31 + 1 month → Feb 28/29). */
export function addMonths(p: DateParts, months: number): DateParts {
  const target = new Date(p.year, p.month + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return { year: target.getFullYear(), month: target.getMonth(), day: Math.min(p.day, last) };
}

export function toDateParts(d: Date): DateParts {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const shortParts = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export const formatMonthYear = (p: DateParts) => monthYear.format(new Date(p.year, p.month, 1));
/** "Thursday, 29 October 2026" for screen-reader labels. */
export const formatFullDay = (p: DateParts) => formatItemDate(new Date(p.year, p.month, p.day), true);

/** "Thu, 29 Oct 2026" for the date button. */
export function formatShortDay(p: DateParts): string {
  const parts = Object.fromEntries(
    shortParts.formatToParts(new Date(p.year, p.month, p.day)).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "2026-10-29" for a day. */
export const toYmd = (p: DateParts) => `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`;

/** Day for "2026-10-29". */
export function fromYmd(s: string): DateParts {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return { year: y, month: m - 1, day: d };
}

/** The first day on or after `p` whose weekday (0 = Sunday) is in `weekdays`. */
export function nextMatchingDay(p: DateParts, weekdays: readonly number[]): DateParts {
  if (weekdays.length === 0) return p;
  for (let i = 0; i < 7; i++) {
    const d = addDays(p, i);
    if (weekdays.includes(new Date(d.year, d.month, d.day).getDay())) return d;
  }
  return p;
}

/** Every day from a to b inclusive, in either order. */
export function daysBetween(a: DateParts, b: DateParts): DateParts[] {
  const [from, to] = toYmd(a) <= toYmd(b) ? [a, b] : [b, a];
  const out: DateParts[] = [];
  for (let d = from; toYmd(d) <= toYmd(to) && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}
