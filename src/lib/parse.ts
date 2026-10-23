export interface DateParts {
  year: number;
  month: number; // 0-11
  day: number;
}

export interface TimeParts {
  hour: number; // 0-23
  minute: number;
}

/**
 * Parses a typed date as MM/DD/YYYY. Also accepts single-digit month/day,
 * "-" or "." separators, and two-digit years (taken as 20YY).
 * Returns null for anything that isn't a real calendar date.
 */
export function parseTypedDate(text: string): DateParts | null {
  const match = /^\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2}|\d{4})\s*$/.exec(text);
  if (!match) return null;
  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  let year = Number(match[3]);
  if (match[3]!.length === 2) year += 2000;
  if (month < 0 || month > 11 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function formatTypedDate({ year, month, day }: DateParts): string {
  return `${String(month + 1).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Parses a typed time. Accepts 12-hour ("3pm", "3:30 p.m.", "12a"),
 * 24-hour ("15:00", "1500", "9"), and the words "noon" and "midnight".
 * A bare number without am/pm is read as 24-hour time.
 */
export function parseTime(text: string): TimeParts | null {
  const t = text.trim().toLowerCase().replace(/\./g, "");
  if (t === "noon") return { hour: 12, minute: 0 };
  if (t === "midnight") return { hour: 0, minute: 0 };

  const match = /^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/.exec(t);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.[0];
  if (minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (hour === 12) hour = 0;
    if (meridiem === "p") hour += 12;
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute };
}

export function formatTime({ hour, minute }: TimeParts): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  // No-break space keeps "3:00 PM" together when text wraps.
  return `${h12}:${String(minute).padStart(2, "0")}\u00a0${hour < 12 ? "AM" : "PM"}`;
}

/** Every 15 minutes from 12:00 AM to 11:45 PM, then 11:59 PM (end-of-day deadlines). */
export const TIME_OPTIONS: readonly TimeParts[] = [
  ...Array.from({ length: 96 }, (_, i) => ({ hour: Math.floor(i / 4), minute: (i % 4) * 15 })),
  { hour: 23, minute: 59 },
];

/** Index of the first option at or after the given time (wrapping to the last). */
export function nearestTimeOption({ hour, minute }: TimeParts): number {
  return Math.min(Math.ceil((hour * 60 + minute) / 15), TIME_OPTIONS.length - 1);
}
