import { describe, expect, it } from "vitest";
import { normalizeCalendarUrl, permissionOrigins } from "../src/lib/calendarUrl";
import { toLocalISO } from "../src/lib/dates";
import { dupKey, findDuplicates, indexExisting } from "../src/lib/dedupe";
import { buildIcs } from "../src/lib/ics";
import { ImportError, parseIcs } from "../src/lib/ics-import";
import { occurrences, presetRule, WINDOW, type Series } from "../src/lib/recurrence";
import { sameZone } from "../src/lib/timezone";
import type { Item } from "../src/lib/types";

const now = Date.UTC(2026, 9, 22, 18, 0, 0); // 22 Oct 2026, 18:00 UTC
let n = 0;
const ids = () => `id${++n}`;

const cal = (...lines: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:test", ...lines, "END:VCALENDAR"].join("\r\n");
const event = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"];

const PST_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Pacific Standard Time",
  "BEGIN:STANDARD",
  "DTSTART:16011104T020000",
  "RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11",
  "TZOFFSETFROM:-0700",
  "TZOFFSETTO:-0800",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:16010311T020000",
  "RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3",
  "TZOFFSETFROM:-0800",
  "TZOFFSETTO:-0700",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

const instant = (item: Item) => Date.parse(item.dateTime);

describe("parseIcs: errors", () => {
  it.each(["", "hello", "BEGIN:VCALENDAR\r\nthis is not ical", "<html>Sign in</html>"])("rejects %j", (text) => {
    expect(() => parseIcs(text, now, ids)).toThrow(ImportError);
  });

  it("skips one malformed event but keeps the rest", () => {
    const r = parseIcs(
      cal(...event("UID:bad", "SUMMARY:No start"), ...event("UID:ok", "DTSTART:20261030T150000Z", "SUMMARY:Fine")),
      now,
      ids,
    );
    expect(r.candidates).toHaveLength(1);
  });
});

describe("parseIcs: single events", () => {
  it("imports an upcoming UTC event as a Starts item with its UID and notes", () => {
    const r = parseIcs(
      cal("X-WR-CALNAME:Work", ...event("UID:abc@google.com", "DTSTART:20261030T150000Z", "SUMMARY:Review", "DESCRIPTION:Room 4\\nBring laptop")),
      now,
      ids,
    );
    expect(r.name).toBe("Work");
    const c = r.candidates[0]!;
    expect(c.kind).toBe("item");
    if (c.kind !== "item") return;
    expect(c.item).toMatchObject({ title: "Review", type: "starts", source: "import", uid: "abc@google.com", notes: "Room 4\nBring laptop" });
    expect(instant(c.item)).toBe(Date.UTC(2026, 9, 30, 15));
  });

  it("hides past events and counts them", () => {
    const r = parseIcs(cal(...event("UID:1", "DTSTART:20261001T150000Z", "SUMMARY:Old"), ...event("UID:2", "DTSTART:20261101T150000Z", "SUMMARY:New")), now, ids);
    expect(r.candidates).toHaveLength(1);
    expect(r.pastHidden).toBe(1);
  });

  it("keeps all-day events as all-day, including one that is today", () => {
    const today = new Date(now);
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const r = parseIcs(cal(...event("UID:1", `DTSTART;VALUE=DATE:${ymd}`, "SUMMARY:Today")), now, ids);
    const c = r.candidates[0]!;
    expect(c.kind === "item" && c.item.allDay).toBe(true);
  });

  it("skips cancelled events and completed to-dos; imports to-dos as Due", () => {
    const r = parseIcs(
      cal(
        ...event("UID:1", "STATUS:CANCELLED", "DTSTART:20261101T150000Z", "SUMMARY:Off"),
        "BEGIN:VTODO", "UID:2", "DUE:20261105T170000Z", "SUMMARY:Essay", "END:VTODO",
        "BEGIN:VTODO", "UID:3", "STATUS:COMPLETED", "DUE:20261105T170000Z", "SUMMARY:Done", "END:VTODO",
      ),
      now,
      ids,
    );
    expect(r.candidates).toHaveLength(1);
    const c = r.candidates[0]!;
    expect(c.kind === "item" && c.item).toMatchObject({ title: "Essay", type: "due" });
  });

  it("honours a VTIMEZONE defined in the file (Outlook style)", () => {
    const r = parseIcs(cal(...PST_VTIMEZONE, ...event("UID:1", "DTSTART;TZID=Pacific Standard Time:20261102T090000", "SUMMARY:Standup")), now, ids);
    const c = r.candidates[0]!;
    // 2 Nov is after DST ends (1 Nov): PST = UTC-8.
    expect(c.kind === "item" && instant(c.item)).toBe(Date.UTC(2026, 10, 2, 17));
  });

  it("honours an IANA TZID with no VTIMEZONE (Google style)", () => {
    const r = parseIcs(
      cal(
        ...event("UID:1", "DTSTART;TZID=America/New_York:20261030T090000", "SUMMARY:Before DST ends"),
        ...event("UID:2", "DTSTART;TZID=America/New_York:20261102T090000", "SUMMARY:After DST ends"),
        ...event("UID:3", "DTSTART;TZID=Asia/Kolkata:20261030T093000", "SUMMARY:Half-hour zone"),
      ),
      now,
      ids,
    );
    const times = r.candidates.map((c) => (c.kind === "item" ? instant(c.item) : 0));
    expect(times).toEqual([Date.UTC(2026, 9, 30, 4, 0), Date.UTC(2026, 9, 30, 13), Date.UTC(2026, 10, 2, 14)].sort((a, b) => a - b));
  });

  it("restores Due vs Starts from this app's own export", () => {
    const due: Item = { id: "x", title: "Essay", type: "due", dateTime: toLocalISO(new Date(2026, 10, 5, 17)), createdAt: "x", updatedAt: "x", source: "manual" };
    const r = parseIcs(buildIcs([{ kind: "item", item: due }], [due]), now, ids);
    const c = r.candidates[0]!;
    expect(c.kind === "item" && c.item.type).toBe("due");
    expect(c.kind === "item" && instant(c.item)).toBe(Date.parse(due.dateTime));
  });

  it("sorts candidates soonest first and caps a huge calendar", () => {
    const lines = Array.from({ length: 320 }, (_, i) => event(`UID:${i}`, `DTSTART:2027${String((i % 12) + 1).padStart(2, "0")}${String((i % 28) + 1).padStart(2, "0")}T120000Z`, `SUMMARY:E${i}`)).flat();
    const r = parseIcs(cal(...lines), now, ids);
    expect(r.candidates).toHaveLength(300);
    expect(r.truncated).toBe(20);
    const times = r.candidates.map((c) => (c.kind === "item" ? instant(c.item) : 0));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("parseIcs: repeating events", () => {
  it("maps a weekly rule to a series and lines up occurrence ids with the app's", () => {
    const r = parseIcs(cal(...PST_VTIMEZONE, ...event("UID:w", "DTSTART;TZID=Pacific Standard Time:20261005T100000", "RRULE:FREQ=WEEKLY", "SUMMARY:Planning")), now, ids);
    const c = r.candidates[0]!;
    expect(c.kind).toBe("series");
    if (c.kind !== "series" || !c.series) throw new Error("expected a series");
    expect(c.series.rule).toEqual({ freq: "WEEKLY", interval: 1 });
    expect(c.series.uid).toBe("w");
    expect(c.items).toHaveLength(WINDOW);
    // First upcoming is Mon 26 Oct (5 Oct + 3 weeks), index 3.
    expect(c.items[0]!.id).toBe(`${c.series.id}~0~3`);
    expect(instant(c.items[0]!)).toBe(Date.UTC(2026, 9, 26, 17)); // Mon 26 Oct, 10:00 PDT
    expect(c.series.nextIndex).toBe(3 + WINDOW);
    // The app's generator agrees on every imported occurrence.
    const app = [...takeN(occurrences(new Date(c.series.start), c.series.rule, c.series.timeZone), c.series.nextIndex)]
      .slice(3)
      .map((d) => d.getTime());
    expect(c.items.map(instant)).toEqual(app);
    // Outlook's "Pacific Standard Time" maps to America/Los_Angeles; recorded unless our zone keeps the same clock.
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(c.series.timeZone).toBe(sameZone(local, "America/Los_Angeles") ? undefined : "America/Los_Angeles");
  });

  it("honours EXDATE and a moved occurrence", () => {
    const r = parseIcs(
      cal(
        ...PST_VTIMEZONE,
        ...event("UID:c", "DTSTART;TZID=Pacific Standard Time:20261026T100000", "RRULE:FREQ=WEEKLY;COUNT=5", "EXDATE;TZID=Pacific Standard Time:20261109T100000", "SUMMARY:Weekly"),
        ...event("UID:c", "RECURRENCE-ID;TZID=Pacific Standard Time:20261102T100000", "DTSTART;TZID=Pacific Standard Time:20261103T140000", "SUMMARY:Weekly"),
      ),
      now,
      ids,
    );
    expect(r.candidates).toHaveLength(1);
    const c = r.candidates[0]!;
    if (c.kind !== "series") throw new Error("expected a series");
    expect(c.items.map((i) => new Date(i.dateTime).getUTCDate())).toEqual([26, 3, 16, 23]);
    expect(c.series?.end).toEqual({ type: "count", count: 5 });
  });

  it("imports an unsupported rule as a fixed stack", () => {
    const r = parseIcs(cal(...event("UID:m", "DTSTART:20261013T170000Z", "RRULE:FREQ=MONTHLY;BYDAY=2TU", "SUMMARY:Board meeting")), now, ids);
    const c = r.candidates[0]!;
    if (c.kind !== "series") throw new Error("expected a series");
    expect(c.series).toBeNull();
    expect(c.items).toHaveLength(WINDOW);
    expect(new Set(c.items.map((i) => i.seriesId))).toEqual(new Set([c.seriesId]));
  });

  it("maps weekdays, month-end and UNTIL", () => {
    const rule = (rrule: string, dtstart: string) => {
      const c = parseIcs(cal(...event("UID:r", `DTSTART:${dtstart}`, `RRULE:${rrule}`, "SUMMARY:R")), now, ids).candidates[0]!;
      return c.kind === "series" ? c.series && { rule: c.series.rule, end: c.series.end } : null;
    };
    expect(rule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", "20261026T090000")?.rule).toEqual(presetRule("weekdays"));
    expect(rule("FREQ=MONTHLY;BYMONTHDAY=-1", "20261031T170000")?.rule).toEqual(presetRule("monthly"));
    expect(rule("FREQ=MONTHLY;BYMONTHDAY=-1", "20261130T170000")).toBeNull(); // not representable from a 30th
    expect(rule("FREQ=DAILY;UNTIL=20261231T235959", "20261023T090000")?.end).toEqual({ type: "until", date: "2026-12-31" });
    expect(rule("FREQ=HOURLY", "20261023T090000")).toBeNull();
  });

  it("round-trips a series exported by this app", () => {
    const s: Series = {
      id: "s1",
      epoch: 0,
      start: toLocalISO(new Date(2026, 9, 26, 10)),
      rule: presetRule("weekly"),
      end: { type: "never" },
      template: { title: "Planning", type: "starts" },
      nextIndex: 1,
    };
    const head: Item = { id: "h", title: "Planning", type: "starts", dateTime: s.start, createdAt: "x", updatedAt: "x", source: "manual", seriesId: "s1" };
    const c = parseIcs(buildIcs([{ kind: "series", series: s, upcoming: [head] }], [head]), now, ids).candidates[0]!;
    if (c.kind !== "series" || !c.series) throw new Error("expected a series");
    expect(c.series.rule).toEqual(s.rule);
    expect(c.series.uid).toBe("s1@countdown");
    expect(instant(c.items[0]!)).toBe(Date.parse(s.start));
  });
});

function* takeN<T>(it: Iterable<T>, count: number) {
  let i = 0;
  for (const x of it) {
    if (i++ >= count) return;
    yield x;
  }
}

describe("duplicates", () => {
  const existing: Item = { id: "e1", title: "Team  Review", type: "starts", dateTime: "2026-10-30T15:00:00Z", createdAt: "x", updatedAt: "x", source: "manual" };

  it("matches same title (ignoring case/spacing) and same instant, even with a different offset", () => {
    expect(dupKey("team review", "2026-10-30T08:00:00-07:00")).toBe(dupKey(existing.title, existing.dateTime));
  });

  it("flags candidates matching existing items, by key or UID, and repeats within the file", () => {
    const r = parseIcs(
      cal(
        ...event("UID:1", "DTSTART:20261030T150000Z", "SUMMARY:team review"),
        ...event("UID:2", "DTSTART:20261031T150000Z", "SUMMARY:New thing"),
        ...event("UID:3", "DTSTART:20261031T150000Z", "SUMMARY:New thing"),
        ...event("UID:e1@countdown", "DTSTART:20261201T150000Z", "SUMMARY:Renamed in calendar"),
      ),
      now,
      ids,
    );
    const dupes = findDuplicates(r.candidates, indexExisting([existing], []));
    const titles = r.candidates.filter((c) => c.kind === "item" && dupes.has(c.item.id)).map((c) => (c.kind === "item" ? c.item.title : ""));
    expect(titles).toEqual(["team review", "New thing", "Renamed in calendar"]);
  });
});

describe("calendar links", () => {
  it.each([
    ["webcal://p52-caldav.icloud.com/published/2/abc", "https://p52-caldav.icloud.com/published/2/abc"],
    ["https://calendar.google.com/calendar/ical/x%40group/private-y/basic.ics", "https://calendar.google.com/calendar/ical/x%40group/private-y/basic.ics"],
    ["http://example.com/cal.ics", "https://example.com/cal.ics"],
    ["  outlook.office365.com/owa/calendar/a/b/calendar.ics ", "https://outlook.office365.com/owa/calendar/a/b/calendar.ics"],
  ])("normalizes %s", (input, expected) => {
    const r = normalizeCalendarUrl(input);
    expect("url" in r && r.url.href).toBe(expected);
  });

  it.each(["", "ftp://example.com/x.ics", "not a link", "javascript:alert(1)"])("rejects %j", (input) => {
    expect("error" in normalizeCalendarUrl(input)).toBe(true);
  });

  it("requests the host and its parent domain's subdomains", () => {
    expect(permissionOrigins(new URL("https://p52-caldav.icloud.com/x"))).toEqual(["https://p52-caldav.icloud.com/*", "https://*.icloud.com/*"]);
    expect(permissionOrigins(new URL("https://example.com/x"))).toEqual(["https://example.com/*"]);
  });
});
