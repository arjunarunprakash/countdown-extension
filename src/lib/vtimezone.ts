import ICAL from "ical.js";
import { instantToWallTime } from "./timezone";

// Builds an RFC 5545 VTIMEZONE for an IANA zone from the browser's time-zone
// data, so exported events can carry TZID=<IANA name> and stay valid
// (RFC 5545 §3.2.19 requires a VTIMEZONE for every TZID used).
//
// Offset changes are found by sampling every two weeks and then narrowing
// each change down to the minute. Each change becomes its own STANDARD or
// DAYLIGHT observance.

const HOUR = 3_600_000;
const STEP = 14 * 24 * HOUR;

/** UTC offset of `timeZone` at an instant, in minutes. */
function offsetMinutes(instant: number, timeZone: string): number {
  const w = instantToWallTime(instant, timeZone)!;
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000);
}

const utcOffset = (min: number) => ICAL.UtcOffset.fromSeconds(min * 60);

/** Local wall time (in the offset before the change) at which a change happens. */
function onsetWall(instant: number, fromOffset: number): ICAL.Time {
  const d = new Date(instant + fromOffset * 60_000);
  return ICAL.Time.fromData({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: 0,
  });
}

export function buildVtimezone(timeZone: string, from: Date, years = 10): ICAL.Component {
  const start = Date.UTC(from.getUTCFullYear(), 0, 1);
  const end = Date.UTC(from.getUTCFullYear() + years, 0, 1);

  const changes: { at: number; from: number; to: number }[] = [];
  let prev = offsetMinutes(start, timeZone);
  for (let t = start + STEP; t <= end; t += STEP) {
    const cur = offsetMinutes(t, timeZone);
    if (cur !== prev) {
      // Narrow to the minute of the change.
      let lo = t - STEP;
      let hi = t;
      while (hi - lo > 60_000) {
        const mid = lo + Math.floor((hi - lo) / 2 / 60_000) * 60_000;
        if (offsetMinutes(mid, timeZone) === prev) lo = mid;
        else hi = mid;
      }
      changes.push({ at: hi, from: prev, to: cur });
      prev = cur;
    }
  }

  const vtz = new ICAL.Component("vtimezone");
  vtz.updatePropertyWithValue("tzid", timeZone);

  if (changes.length === 0) {
    const std = new ICAL.Component("standard");
    std.updatePropertyWithValue("dtstart", ICAL.Time.fromData({ year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 }));
    std.updatePropertyWithValue("tzoffsetfrom", utcOffset(prev));
    std.updatePropertyWithValue("tzoffsetto", utcOffset(prev));
    vtz.addSubcomponent(std);
    return vtz;
  }

  // One observance per change, each with its own DTSTART. This is the most
  // widely understood form: ical.js, for one, ignores RDATE-based onsets.
  // The smaller offset is standard time; the larger is daylight time.
  const minOffset = Math.min(...changes.map((c) => c.to));
  for (const c of changes) {
    const obs = new ICAL.Component(c.to === minOffset ? "standard" : "daylight");
    obs.updatePropertyWithValue("dtstart", onsetWall(c.at, c.from));
    obs.updatePropertyWithValue("tzoffsetfrom", utcOffset(c.from));
    obs.updatePropertyWithValue("tzoffsetto", utcOffset(c.to));
    vtz.addSubcomponent(obs);
  }
  return vtz;
}
