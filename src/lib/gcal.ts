import { occurrenceIndex, recurFor, type ExportEntry } from "./ics";

// Google Calendar's "create event" link. Times are sent as local wall-clock
// time plus ctz (the user's time zone), which keeps repeating events at the
// same local time across daylight-saving changes.

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const local = (d: Date) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

export const GCAL_IMPORT_URL = "https://calendar.google.com/calendar/r/settings/export";

export function googleCalendarUrl(entry: ExportEntry, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const item = entry.kind === "item" ? entry.item : entry.upcoming[0]!;
  const when = new Date(item.dateTime);
  const allDay = entry.kind === "item" ? item.allDay : entry.series.allDay;

  // All-day: end date is exclusive. Timed: a point in time (start = end).
  const dates = allDay
    ? `${ymd(when)}/${ymd(new Date(when.getFullYear(), when.getMonth(), when.getDate() + 1))}`
    : `${local(when)}/${local(when)}`;

  const params = new URLSearchParams({ action: "TEMPLATE", text: item.title, dates, ctz: timeZone });
  if (item.notes) params.set("details", item.notes);
  if (entry.kind === "series") {
    params.set("recur", `RRULE:${recurFor(entry.series, occurrenceIndex(entry.series, item), allDay).toString()}`);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
