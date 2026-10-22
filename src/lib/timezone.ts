// Converting wall-clock times in a named IANA time zone to instants, using
// the browser's own time-zone data (Intl). Calendar files often reference
// zones like "America/New_York" without including a VTIMEZONE definition.

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  if (formatters.has(timeZone)) return formatters.get(timeZone)!;
  try {
    const f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
    return f;
  } catch {
    return null;
  }
}

export const isValidTimeZone = (timeZone: string) => formatterFor(timeZone) !== null;

/** The zone's UTC offset (ms) at a given instant. */
function offsetAt(instant: number, f: Intl.DateTimeFormat): number {
  const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, Number(x.value)]));
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Instant (ms) for a wall-clock time in `timeZone`, or null if the zone is
 * unknown. Two passes settle the offset around DST changes; a time that
 * doesn't exist (skipped by a spring-forward) resolves just after the gap.
 */
export function zonedTimeToInstant(t: WallTime, timeZone: string): number | null {
  const f = formatterFor(timeZone);
  if (!f) return null;
  const guess = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  const first = guess - offsetAt(guess, f);
  const second = guess - offsetAt(first, f);
  return second;
}

/** Wall-clock fields of an instant in `timeZone` (null if the zone is unknown). */
export function instantToWallTime(instant: number, timeZone: string): WallTime | null {
  const f = formatterFor(timeZone);
  if (!f) return null;
  const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, Number(x.value)]));
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute!, second: p.second! };
}

/** The browser's own time zone (IANA name). */
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Windows time-zone names (used by Outlook/Exchange in TZID) for the most
 * common zones, mapped to IANA names per the Unicode CLDR windowsZones table
 * (territory "001" defaults).
 */
const WINDOWS_ZONES: Record<string, string> = {
  "Dateline Standard Time": "Etc/GMT+12",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Alaskan Standard Time": "America/Anchorage",
  "Pacific Standard Time": "America/Los_Angeles",
  "US Mountain Standard Time": "America/Phoenix",
  "Mountain Standard Time": "America/Denver",
  "Central Standard Time": "America/Chicago",
  "Canada Central Standard Time": "America/Regina",
  "Central America Standard Time": "America/Guatemala",
  "Eastern Standard Time": "America/New_York",
  "Atlantic Standard Time": "America/Halifax",
  "Newfoundland Standard Time": "America/St_Johns",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Argentina Standard Time": "America/Buenos_Aires",
  "UTC": "Etc/UTC",
  "GMT Standard Time": "Europe/London",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Romance Standard Time": "Europe/Paris",
  "Central European Standard Time": "Europe/Warsaw",
  "E. Europe Standard Time": "Europe/Chisinau",
  "FLE Standard Time": "Europe/Kiev",
  "GTB Standard Time": "Europe/Bucharest",
  "Israel Standard Time": "Asia/Jerusalem",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Russian Standard Time": "Europe/Moscow",
  "Arabian Standard Time": "Asia/Dubai",
  "Pakistan Standard Time": "Asia/Karachi",
  "India Standard Time": "Asia/Calcutta",
  "Bangladesh Standard Time": "Asia/Dhaka",
  "SE Asia Standard Time": "Asia/Bangkok",
  "China Standard Time": "Asia/Shanghai",
  "Singapore Standard Time": "Asia/Singapore",
  "Taipei Standard Time": "Asia/Taipei",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "AUS Central Standard Time": "Australia/Darwin",
  "E. Australia Standard Time": "Australia/Brisbane",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "New Zealand Standard Time": "Pacific/Auckland",
};

/** An IANA zone for a TZID: the TZID itself if it is one, a mapped Windows name, or null. */
export function resolveTimeZone(tzid: string): string | null {
  if (isValidTimeZone(tzid)) return tzid;
  const mapped = WINDOWS_ZONES[tzid];
  return mapped && isValidTimeZone(mapped) ? mapped : null;
}

/** Whether two IANA names refer to the same zone right now and at the turn of the year (cheap equivalence check). */
export function sameZone(a: string, b: string): boolean {
  if (a === b) return true;
  const year = new Date().getFullYear();
  return [Date.UTC(year, 0, 15), Date.UTC(year, 6, 15)].every((t) => {
    const wa = instantToWallTime(t, a);
    const wb = instantToWallTime(t, b);
    return wa && wb && wa.hour === wb.hour && wa.minute === wb.minute && wa.day === wb.day;
  });
}
