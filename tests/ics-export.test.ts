import ICAL from "ical.js";
import { describe, expect, it } from "vitest";
import { toLocalISO } from "../src/lib/dates";
import { googleCalendarUrl } from "../src/lib/gcal";
import { buildIcs, exportFileName, PRODID, type ExportEntry } from "../src/lib/ics";
import { presetRule, type Series } from "../src/lib/recurrence";
import type { Item } from "../src/lib/types";

const now = new Date(Date.UTC(2026, 9, 22, 18, 0, 0));

function item(extra: Partial<Item> = {}): Item {
  return {
    id: "a1",
    title: "Submit report",
    type: "due",
    dateTime: toLocalISO(new Date(2026, 9, 29, 15, 0)),
    createdAt: "x",
    updatedAt: "x",
    source: "manual",
    ...extra,
  };
}

function series(extra: Partial<Series> = {}): Series {
  return {
    id: "s1",
    epoch: 0,
    start: toLocalISO(new Date(2026, 9, 26, 10, 0)),
    rule: presetRule("weekly"),
    end: { type: "never" },
    template: { title: "Planning", type: "starts" },
    nextIndex: 6,
    ...extra,
  };
}

/** Occurrence items 0..n-1 of a series, as the app would have generated them. */
function occurrencesOf(s: Series, dates: Date[]): Item[] {
  return dates.map((d, i) => item({ id: i === 0 ? "anchor" : `${s.id}~${s.epoch}~${i}`, title: "Planning", type: "starts", dateTime: toLocalISO(d), seriesId: s.id }));
}

const parse = (ics: string) => new ICAL.Component(ICAL.parse(ics));
const events = (ics: string) => parse(ics).getAllSubcomponents("vevent");

describe("buildIcs: file format", () => {
  const ics = buildIcs([{ kind: "item", item: item({ title: "A deliberately long title — with accents éàü and an emoji 🎉, to force line folding past 75 octets" }) }], [], now);

  it("is a VCALENDAR with the required properties", () => {
    const cal = parse(ics);
    expect(cal.name).toBe("vcalendar");
    expect(cal.getFirstPropertyValue("version")).toBe("2.0");
    expect(cal.getFirstPropertyValue("prodid")).toBe(PRODID);
    const ev = events(ics)[0]!;
    for (const prop of ["uid", "dtstamp", "dtstart", "summary"]) expect(ev.hasProperty(prop)).toBe(true);
  });

  it("ends every line, including the last, with CRLF", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("folds lines at 75 octets", () => {
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("round-trips text with special characters", () => {
    const tricky = item({ title: "Q4; report, v2", notes: "Line one\nLine two; with, punctuation" });
    const ev = events(buildIcs([{ kind: "item", item: tricky }], [], now))[0]!;
    expect(ev.getFirstPropertyValue("summary")).toBe("Q4; report, v2");
    expect(ev.getFirstPropertyValue("description")).toBe("Line one\nLine two; with, punctuation");
  });
});

describe("buildIcs: items", () => {
  it("writes timed items in UTC with no end time", () => {
    const it1 = item();
    const ev = events(buildIcs([{ kind: "item", item: it1 }], [], now))[0]!;
    const start = ev.getFirstPropertyValue("dtstart") as ICAL.Time;
    expect(start.zone?.tzid).toBe("UTC");
    expect(start.toJSDate().getTime()).toBe(Date.parse(it1.dateTime));
    expect(ev.hasProperty("dtend")).toBe(false);
    expect(ev.getFirstPropertyValue("x-countdown-type")).toBe("due");
  });

  it("writes all-day items as DATE values", () => {
    const allDay = item({ allDay: true, dateTime: toLocalISO(new Date(2026, 9, 29)) });
    const ics = buildIcs([{ kind: "item", item: allDay }], [], now);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261029");
  });

  it("keeps an imported UID and generates a stable one otherwise", () => {
    expect(events(buildIcs([{ kind: "item", item: item({ uid: "abc@google.com" }) }], [], now))[0]!.getFirstPropertyValue("uid")).toBe("abc@google.com");
    expect(events(buildIcs([{ kind: "item", item: item() }], [], now))[0]!.getFirstPropertyValue("uid")).toBe("a1@countdown");
  });
});

describe("buildIcs: series", () => {
  const weekly = [0, 1, 2, 3, 4, 5].map((k) => new Date(2026, 9, 26 + 7 * k, 10));

  it("exports one floating-time VEVENT with an RRULE", () => {
    const s = series();
    const occ = occurrencesOf(s, weekly);
    const ics = buildIcs([{ kind: "series", series: s, upcoming: occ }], occ, now);
    const evs = events(ics);
    expect(evs).toHaveLength(1);
    expect(ics).toContain("DTSTART:20261026T100000\r\n"); // floating: no Z, no TZID
    expect(evs[0]!.getFirstPropertyValue("rrule")!.toString()).toBe("FREQ=WEEKLY");
    expect(evs[0]!.getFirstPropertyValue("uid")).toBe("s1@countdown");
  });

  it("starts at the next upcoming occurrence and reduces COUNT accordingly", () => {
    const s = series({ end: { type: "count", count: 6 } });
    const occ = occurrencesOf(s, weekly);
    const ics = buildIcs([{ kind: "series", series: s, upcoming: occ.slice(2) }], occ, now);
    expect(ics).toContain("DTSTART:20261109T100000");
    expect(events(ics)[0]!.getFirstPropertyValue("rrule")!.toString()).toBe("FREQ=WEEKLY;COUNT=4");
  });

  it("adds EXDATE for occurrences the user removed", () => {
    const s = series();
    const occ = occurrencesOf(s, weekly);
    const withoutThird = occ.filter((_, i) => i !== 2);
    const ics = buildIcs([{ kind: "series", series: s, upcoming: withoutThird }], withoutThird, now);
    expect(ics).toContain("EXDATE:20261109T100000");
    expect(ics.match(/EXDATE/g)).toHaveLength(1);
  });

  it("encodes weekday, interval, until and month-end rules", () => {
    const at = (rule: Series["rule"], start: Date, end: Series["end"] = { type: "never" }) => {
      const s = series({ rule, start: toLocalISO(start), end });
      const occ = occurrencesOf(s, [start]);
      return events(buildIcs([{ kind: "series", series: s, upcoming: occ }], occ, now))[0]!.getFirstPropertyValue("rrule")!.toString();
    };
    expect(at(presetRule("weekdays"), new Date(2026, 9, 26, 9))).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(at(presetRule("biweekly"), new Date(2026, 9, 26, 9))).toBe("FREQ=WEEKLY;INTERVAL=2");
    expect(at(presetRule("monthly"), new Date(2026, 0, 31, 17))).toBe("FREQ=MONTHLY;BYMONTHDAY=-1");
    expect(at(presetRule("monthly"), new Date(2026, 0, 30, 17))).toBe("FREQ=MONTHLY;BYMONTHDAY=30");
    expect(at(presetRule("monthly"), new Date(2026, 0, 15, 17))).toBe("FREQ=MONTHLY");
    expect(at(presetRule("yearly"), new Date(2028, 1, 29, 12))).toBe("FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1");
    expect(at(presetRule("daily"), new Date(2026, 9, 26, 9), { type: "until", date: "2026-12-31" })).toBe("FREQ=DAILY;UNTIL=20261231T235959");
  });

  // Expand exported rules with an independent RFC 5545 engine (ical.js)
  // and compare with the app's own generator.
  const expandEvent = (ev: ICAL.Component, n: number) => {
    const iter = new ICAL.Event(ev).iterator();
    const got: string[] = [];
    for (let t = iter.next(); t && got.length < n; t = iter.next()) got.push(`${t.year}-${t.month}-${t.day}`);
    return got;
  };
  const exportFresh = (s: Series, from: Date) => {
    const occ = occurrencesOf(s, [from]);
    return events(buildIcs([{ kind: "series", series: s, upcoming: occ }], occ, now));
  };

  it("monthly on the 31st expands to the same dates as the app", () => {
    const start = new Date(2026, 0, 31, 17);
    const [ev] = exportFresh(series({ rule: presetRule("monthly"), start: toLocalISO(start), nextIndex: 1 }), start);
    expect(expandEvent(ev!, 4)).toEqual(["2026-1-31", "2026-2-28", "2026-3-31", "2026-4-30"]);
  });

  it("annually on 29 February expands to the last day of February", () => {
    const start = new Date(2028, 1, 29, 12);
    const [ev] = exportFresh(series({ rule: presetRule("yearly"), start: toLocalISO(start), nextIndex: 1 }), start);
    expect(expandEvent(ev!, 3)).toEqual(["2028-2-29", "2029-2-28", "2030-2-28"]);
  });

  it("a 30th-of-month series starting at a clamped 28 Feb exports that day separately", () => {
    const s = series({ rule: presetRule("monthly"), start: toLocalISO(new Date(2026, 0, 30, 9)), nextIndex: 3 });
    const feb = item({ id: "s1~0~1", seriesId: "s1", dateTime: toLocalISO(new Date(2026, 1, 28, 9)) });
    const mar = item({ id: "s1~0~2", seriesId: "s1", dateTime: toLocalISO(new Date(2026, 2, 30, 9)) });
    const evs = events(buildIcs([{ kind: "series", series: s, upcoming: [feb, mar] }], [feb, mar], now));

    expect(evs).toHaveLength(2);
    const [repeating, single] = evs as [ICAL.Component, ICAL.Component];
    expect(expandEvent(repeating, 3)).toEqual(["2026-3-30", "2026-4-30", "2026-5-30"]);
    expect(single.hasProperty("rrule")).toBe(false);
    expect((single.getFirstPropertyValue("dtstart") as ICAL.Time).toJSDate().getTime()).toBe(Date.parse(feb.dateTime));
  });

  it("a moved occurrence becomes an EXDATE plus its own event", () => {
    const s = series({ nextIndex: 3 });
    const dates = [0, 1, 2].map((k) => new Date(2026, 9, 26 + 7 * k, 10));
    const occ = occurrencesOf(s, dates);
    occ[1] = { ...occ[1]!, dateTime: toLocalISO(new Date(2026, 10, 3, 14)) }; // moved Mon 10:00 → Tue 14:00
    const evs = events(buildIcs([{ kind: "series", series: s, upcoming: occ }], occ, now));

    expect(evs).toHaveLength(2);
    expect(expandEvent(evs[0]!, 3)).toEqual(["2026-10-26", "2026-11-9", "2026-11-16"]);
    expect((evs[1]!.getFirstPropertyValue("dtstart") as ICAL.Time).toJSDate().getTime()).toBe(Date.parse(occ[1]!.dateTime));
    expect(evs[1]!.getFirstPropertyValue("uid")).toBe("s1-1@countdown");
  });
});

describe("exportFileName", () => {
  it("uses a slug of the title for a single entry", () => {
    expect(exportFileName([{ kind: "item", item: item({ title: "Réunion: Q4 plan!" }) }], now)).toBe("reunion-q4-plan.ics");
  });

  it("uses a dated name for several entries", () => {
    const e: ExportEntry = { kind: "item", item: item() };
    expect(exportFileName([e, e], new Date(2026, 9, 22))).toBe("countdown-2026-10-22.ics");
  });
});

describe("googleCalendarUrl", () => {
  it("prefills a timed item as local time with the user's zone", () => {
    const url = new URL(googleCalendarUrl({ kind: "item", item: item({ notes: "Bring slides" }) }, "America/Vancouver"));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "TEMPLATE",
      text: "Submit report",
      dates: "20261029T150000/20261029T150000",
      ctz: "America/Vancouver",
      details: "Bring slides",
    });
  });

  it("uses an exclusive end date for all-day items", () => {
    const url = new URL(googleCalendarUrl({ kind: "item", item: item({ allDay: true, dateTime: toLocalISO(new Date(2026, 9, 31)) }) }, "UTC"));
    expect(url.searchParams.get("dates")).toBe("20261031/20261101");
  });

  it("adds the RRULE for a series", () => {
    const s = series({ end: { type: "count", count: 10 } });
    const occ = occurrencesOf(s, [new Date(2026, 9, 26, 10)]);
    const url = new URL(googleCalendarUrl({ kind: "series", series: s, upcoming: occ }, "UTC"));
    expect(url.searchParams.get("recur")).toBe("RRULE:FREQ=WEEKLY;COUNT=10");
  });
});
