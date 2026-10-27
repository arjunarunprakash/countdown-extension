import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { toLocalISO } from "../src/lib/dates";
import { buildIcs } from "../src/lib/ics";
import { occurrences, presetRule, topUp, WINDOW, type Series } from "../src/lib/recurrence";
import { instantToWallTime, resolveTimeZone, sameZone, zonedTimeToInstant } from "../src/lib/timezone";
import type { Item } from "../src/lib/types";
import { buildVtimezone } from "../src/lib/vtimezone";

// These tests pass a zone explicitly, so they hold whatever TZ they run in.

describe("zone conversion", () => {
  it("converts wall time to instants across DST and half-hour zones", () => {
    const at = (tz: string, y: number, m: number, d: number, h: number, mi = 0) =>
      zonedTimeToInstant({ year: y, month: m, day: d, hour: h, minute: mi, second: 0 }, tz);
    expect(at("America/New_York", 2026, 10, 30, 9)).toBe(Date.UTC(2026, 9, 30, 13)); // EDT
    expect(at("America/New_York", 2026, 11, 2, 9)).toBe(Date.UTC(2026, 10, 2, 14)); // EST
    expect(at("Asia/Kolkata", 2026, 10, 30, 9, 30)).toBe(Date.UTC(2026, 9, 30, 4));
    expect(at("Not/AZone", 2026, 1, 1, 0)).toBeNull();
  });

  it("round-trips instants to wall time", () => {
    expect(instantToWallTime(Date.UTC(2026, 9, 30, 4), "Asia/Kolkata")).toMatchObject({ day: 30, hour: 9, minute: 30 });
  });

  it("resolves IANA and common Windows zone names", () => {
    expect(resolveTimeZone("Europe/Paris")).toBe("Europe/Paris");
    expect(resolveTimeZone("Pacific Standard Time")).toBe("America/Los_Angeles");
    expect(resolveTimeZone("India Standard Time")).toMatch(/Asia\/(Calcutta|Kolkata)/);
    expect(resolveTimeZone("Mars Standard Time")).toBeNull();
  });
});

const kolkata: Series = {
  id: "ist",
  epoch: 0,
  start: new Date(Date.UTC(2026, 9, 26, 4, 0)).toISOString(), // Mon 26 Oct 09:30 IST
  rule: presetRule("weekly"),
  end: { type: "never" },
  template: { title: "Sync with Bengaluru", type: "starts" },
  nextIndex: 1,
  timeZone: "Asia/Kolkata",
};

describe("same zone", () => {
  const from = new Date(2026, 0, 1);
  it("treats aliases and zones with identical rules as the same", () => {
    expect(sameZone("America/Los_Angeles", "US/Pacific", from)).toBe(true);
    expect(sameZone("Europe/Lisbon", "Atlantic/Madeira", from)).toBe(true);
  });

  it("tells apart zones that only differ for part of the year", () => {
    // Same offset in winter; Phoenix skips daylight saving.
    expect(sameZone("America/Phoenix", "America/Denver", from)).toBe(false);
    // Mexico dropped daylight saving in 2022; Chicago didn't.
    expect(sameZone("America/Mexico_City", "America/Chicago", from)).toBe(false);
  });

  it("looks ahead, so zones that split later aren't treated as one", () => {
    // British Columbia stays on daylight time from November 2026 (in tz data
    // that includes the change); before that it matched Los Angeles.
    const nov = Date.UTC(2026, 10, 16, 12);
    const split = instantToWallTime(nov, "America/Vancouver")!.hour !== instantToWallTime(nov, "America/Los_Angeles")!.hour;
    expect(sameZone("America/Vancouver", "America/Los_Angeles", from)).toBe(!split);
  });
});

describe("series following another zone", () => {
  it("generates every occurrence at 09:30 IST, through other zones' DST changes", () => {
    const wall = [...take(occurrences(new Date(kolkata.start), kolkata.rule, kolkata.timeZone), 30)].map((d) =>
      instantToWallTime(d.getTime(), "Asia/Kolkata"),
    );
    expect(new Set(wall.map((w) => `${w!.hour}:${w!.minute}`))).toEqual(new Set(["9:30"]));
    expect(new Set(wall.map((w) => new Date(Date.UTC(w!.year, w!.month - 1, w!.day)).getUTCDay()))).toEqual(new Set([1]));
  });

  it("tops up with occurrences in the series' zone", () => {
    const first: Item = { id: "f", title: "Sync", type: "starts", dateTime: toLocalISO(new Date(kolkata.start)), createdAt: "x", updatedAt: "x", source: "import", seriesId: "ist" };
    const { added } = topUp(kolkata, [first], Date.UTC(2026, 9, 22));
    expect(added).toHaveLength(WINDOW - 1);
    for (const item of added) expect(new Date(item.dateTime).getUTCHours() * 60 + new Date(item.dateTime).getUTCMinutes()).toBe(4 * 60);
  });

  it("exports with TZID and a VTIMEZONE that independent expansion agrees with", () => {
    const ny: Series = { ...kolkata, id: "ny", start: new Date(Date.UTC(2026, 9, 26, 13)).toISOString(), timeZone: "America/New_York", nextIndex: 1 };
    const head: Item = { id: "h", title: "Standup", type: "starts", dateTime: toLocalISO(new Date(ny.start)), createdAt: "x", updatedAt: "x", source: "import", seriesId: "ny" };
    const ics = buildIcs([{ kind: "series", series: ny, upcoming: [head] }], [head]);

    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261026T090000");

    // Parse with ical.js using only the file's own VTIMEZONE.
    ICAL.TimezoneService.reset();
    const cal = new ICAL.Component(ICAL.parse(ics));
    for (const tz of cal.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(tz);
    const ev = new ICAL.Event(cal.getFirstSubcomponent("vevent")!);
    const iter = ev.iterator();
    const theirs: number[] = [];
    for (let t = iter.next(); t && theirs.length < 60; t = iter.next()) theirs.push(t.toJSDate().getTime());
    const ours = [...take(occurrences(new Date(ny.start), ny.rule, ny.timeZone), 60)].map((d) => d.getTime());
    expect(theirs).toEqual(ours);
    ICAL.TimezoneService.reset();
  });
});

describe("buildVtimezone", () => {
  const offsetsOf = (vtz: ICAL.Component) =>
    [...vtz.getAllSubcomponents("standard"), ...vtz.getAllSubcomponents("daylight")].map((o) => `${o.name}:${o.getFirstPropertyValue("tzoffsetto")}`);

  it("has standard and daylight observances for a DST zone", () => {
    expect(new Set(offsetsOf(buildVtimezone("America/New_York", new Date(Date.UTC(2026, 0, 1)))))).toEqual(
      new Set(["daylight:-04:00", "standard:-05:00"]),
    );
  });

  it("has a single fixed observance for a zone without DST", () => {
    expect(offsetsOf(buildVtimezone("America/Phoenix", new Date(Date.UTC(2026, 0, 1))))).toEqual(["standard:-07:00"]);
    expect(offsetsOf(buildVtimezone("Asia/Kolkata", new Date(Date.UTC(2026, 0, 1))))).toEqual(["standard:+05:30"]);
  });

  it("puts each change at the right minute (US: 2am local, second Sunday of March)", () => {
    const vtz = buildVtimezone("America/New_York", new Date(Date.UTC(2027, 0, 1)), 1);
    const daylight = vtz.getFirstSubcomponent("daylight")!;
    expect(daylight.getFirstPropertyValue("dtstart")!.toString()).toBe("2027-03-14T02:00:00");
  });
});

function* take<T>(it: Iterable<T>, count: number) {
  let i = 0;
  for (const x of it) {
    if (i++ >= count) return;
    yield x;
  }
}
