import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageBackend } from "../src/lib/storage";
import type { Item } from "../src/lib/types";
import {
  commitImport,
  discardImport,
  importDraft,
  importFile,
  importStatus,
  importUrl,
  selectableImportKeys,
} from "../src/state/importer";
import { enterSelection, exitSelection, selected } from "../src/state/selection";
import { initStore, items, series } from "../src/state/store";
import { toast } from "../src/state/toast";

const memory = (): StorageBackend => {
  const data: Record<string, unknown> = {};
  return { get: async () => ({ ...data }), set: async (v) => void Object.assign(data, v), subscribe: () => () => {} };
};

// Far enough ahead that the events are always upcoming.
const ics = (...events: string[][]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:t", "X-WR-CALNAME:Course", ...events.flat(), "END:VCALENDAR"].join("\r\n");
const ev = (uid: string, start: string, title: string, extra: string[] = []) => [
  "BEGIN:VEVENT",
  `UID:${uid}`,
  `DTSTART:${start}`,
  `SUMMARY:${title}`,
  ...extra,
  "END:VEVENT",
];
const file = (text: string, name = "course.ics") =>
  new File([text], name, { type: name.endsWith(".ics") ? "text/calendar" : "text/plain" });

const existing: Item = {
  id: "e1",
  title: "Midterm",
  type: "due",
  dateTime: "2030-03-04T17:00:00Z",
  createdAt: "x",
  updatedAt: "x",
  source: "manual",
};

beforeEach(async () => {
  await initStore(memory());
  items.value = [existing];
  series.value = [];
  enterSelection("import");
});

afterEach(() => {
  exitSelection();
  vi.unstubAllGlobals();
});

describe("importing a file", () => {
  it("previews upcoming events, pre-selects new ones and leaves duplicates unchecked", async () => {
    await importFile(
      file(
        ics(
          ev("a", "20300304T170000Z", "midterm"), // same as existing
          ev("b", "20300310T170000Z", "Final"),
          ev("c", "20200101T170000Z", "Old"),
          ev("d", "20300101T090000Z", "Lecture", ["RRULE:FREQ=WEEKLY;COUNT=3"]),
        ),
      ),
    );
    const d = importDraft.value!;
    expect(d.source).toBe("Course");
    expect(d.pastHidden).toBe(1);
    expect(d.candidates).toHaveLength(3);
    expect(d.duplicates.size).toBe(1);
    expect(selectableImportKeys.value).toHaveLength(2);
    expect([...selected.value].sort()).toEqual([...selectableImportKeys.value].sort());
  });

  it("commits the selection with one undo", async () => {
    await importFile(file(ics(ev("b", "20300310T170000Z", "Final"), ev("d", "20300101T090000Z", "Lecture", ["RRULE:FREQ=WEEKLY;COUNT=3"]))));
    commitImport();
    expect(items.value.map((i) => i.title).sort()).toEqual(["Final", "Lecture", "Lecture", "Lecture", "Midterm"]);
    expect(series.value).toHaveLength(1);
    expect(toast.value?.message).toBe("Added 2 items");
    toast.value!.action!.run();
    expect(items.value.map((i) => i.title)).toEqual(["Midterm"]);
    expect(series.value).toEqual([]);
  });

  it("can import everything into a category", async () => {
    await importFile(file(ics(ev("b", "20300310T170000Z", "Final"), ev("d", "20300101T090000Z", "Lecture", ["RRULE:FREQ=WEEKLY;COUNT=3"]))));
    commitImport("course");
    expect(items.value.filter((i) => i.title !== "Midterm").every((i) => i.categoryId === "course")).toBe(true);
    expect(series.value[0]!.categoryId).toBe("course");
  });

  it("only commits what is still selected", async () => {
    await importFile(file(ics(ev("b", "20300310T170000Z", "Final"), ev("x", "20300311T170000Z", "Quiz"))));
    const quiz = importDraft.value!.candidates.find((c) => c.kind === "item" && c.item.title === "Quiz")!;
    selected.value = new Set([...selected.value].filter((k) => k !== (quiz.kind === "item" ? quiz.item.id : "")));
    commitImport();
    expect(items.value.map((i) => i.title).sort()).toEqual(["Final", "Midterm"]);
  });

  it.each([
    [file("hello", "notes.txt"), "notes.txt isn't a calendar file. Choose an .ics file."],
    [file("BEGIN:VCALENDAR\r\nnot really"), "This file isn't a valid calendar (.ics)."],
    [file(ics(ev("c", "20200101T170000Z", "Old"))), "No upcoming events in Course (1 past event hidden)."],
  ])("explains a problem file", async (f, message) => {
    await importFile(f);
    expect(importStatus.value).toEqual({ kind: "error", message });
    expect(importDraft.value).toBeNull();
  });

  it("discards the preview when leaving import mode", async () => {
    await importFile(file(ics(ev("b", "20300310T170000Z", "Final"))));
    exitSelection();
    expect(importDraft.value).toBeNull();
    discardImport();
  });
});

describe("importing a link", () => {
  const reply = (body: string, init: ResponseInit = {}) => vi.fn(async () => new Response(body, init));

  it("fetches a webcal link over https and previews it", async () => {
    const fetch = reply(ics(ev("b", "20300310T170000Z", "Final")));
    vi.stubGlobal("fetch", fetch);
    await importUrl("webcal://calendar.example.com/feed.ics");
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe("https://calendar.example.com/feed.ics");
    expect(importDraft.value?.candidates).toHaveLength(1);
  });

  it("asks for host permission first and stops if it's refused", async () => {
    const request = vi.fn(async () => false);
    vi.stubGlobal("chrome", { permissions: { request } });
    const fetch = reply("");
    vi.stubGlobal("fetch", fetch);
    await importUrl("https://p52-caldav.icloud.com/published/2/abc");
    expect(request).toHaveBeenCalledWith({ origins: ["https://p52-caldav.icloud.com/*", "https://*.icloud.com/*"] });
    expect(fetch).not.toHaveBeenCalled();
    expect(importStatus.value).toMatchObject({ kind: "error", message: expect.stringContaining("needs permission") });
  });

  it.each([
    [() => reply("", { status: 404 }), "The calendar server replied 404. Make sure it's a public or secret iCal link."],
    [() => reply("<html>Sign in</html>"), "That link didn't return a calendar. Use the iCal (.ics) address, not the web page link."],
    [() => vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))), "Couldn't reach calendar.example.com. Check the link and your connection."],
  ])("explains a failed fetch", async (make, message) => {
    vi.stubGlobal("fetch", make());
    await importUrl("https://calendar.example.com/feed.ics");
    expect(importStatus.value).toEqual({ kind: "error", message });
  });

  it("caps the download at 10 MB even without a Content-Length", async () => {
    const chunk = new Uint8Array(1024 * 1024).fill(65);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        sent++;
        c.enqueue(chunk);
        if (sent > 20) c.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    await importUrl("https://calendar.example.com/huge.ics");
    expect(importStatus.value).toEqual({ kind: "error", message: "That calendar is too large to import (over 10 MB)." });
    expect(sent).toBeLessThan(15); // stopped reading, didn't download all of it
  });

  it("explains a download that breaks part-way", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode("BEGIN:VCALENDAR"));
        c.error(new TypeError("network error"));
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body)));
    await importUrl("https://calendar.example.com/feed.ics");
    expect(importStatus.value).toEqual({ kind: "error", message: "Couldn't download the calendar from calendar.example.com." });
  });

  it("rejects links that aren't https or webcal", async () => {
    await importUrl("ftp://example.com/x.ics");
    expect(importStatus.value).toEqual({ kind: "error", message: "Use an https:// or webcal:// calendar link." });
  });
});
