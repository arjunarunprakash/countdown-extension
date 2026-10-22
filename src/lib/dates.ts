// Display format is fixed regardless of browser locale:
//   Thursday, 29 October 2026, 3:00 PM
const datePart = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timePart = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatItemDate(date: Date, allDay = false): string {
  const parts = Object.fromEntries(
    datePart.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const day = `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
  return allDay ? day : `${day}, ${timePart.format(date)}`;
}

/** Local wall-clock time as ISO 8601 with the current UTC offset. */
export function toLocalISO(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

const shortDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const shortDateYear = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Compact form for dense lists: "Mon 26 Oct, 10:00 AM" (year shown only if not this year). */
export function formatShortDateTime(date: Date, allDay = false, now = new Date()): string {
  const fmt = date.getFullYear() === now.getFullYear() ? shortDate : shortDateYear;
  const day = fmt.format(date).replace(",", "");
  return allDay ? day : `${day}, ${timePart.format(date)}`;
}
