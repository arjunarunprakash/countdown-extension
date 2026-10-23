import { batch, computed, effect, signal } from "@preact/signals";
import { MAX_CALENDAR_BYTES, normalizeCalendarUrl, permissionOrigins } from "../lib/calendarUrl";
import { findDuplicates, indexExisting } from "../lib/dedupe";
import { ImportError, parseIcs, type Candidate } from "../lib/ics-import";
import type { Series } from "../lib/recurrence";
import type { Item } from "../lib/types";
import { selected, selectionMode, seriesKey } from "./selection";
import { addImported, items, series } from "./store";

// Import flow: a file or calendar link is parsed into a draft whose
// candidates are previewed in the list (selection mode "import"). Nothing is
// stored until commitImport().

export interface ImportDraft {
  /** Calendar name, file name or host: shown in the sheet. */
  source: string;
  candidates: Candidate[];
  /** Candidate keys (see candidateKey) that are already in the list. */
  duplicates: Set<string>;
  pastHidden: number;
  truncated: number;
}

export type ImportStatus = { kind: "idle" } | { kind: "loading"; label: string } | { kind: "error"; message: string };

export const importDraft = signal<ImportDraft | null>(null);
export const importStatus = signal<ImportStatus>({ kind: "idle" });

/** Selection key for a candidate: its item id, or series:<id> for a stack. */
export const candidateKey = (c: Candidate) => (c.kind === "item" ? c.item.id : seriesKey(c.seriesId));
const duplicateId = (c: Candidate) => (c.kind === "item" ? c.item.id : c.seriesId);

/** Lookup used by rows to render previews. */
export const draftIndex = computed(() => {
  const d = importDraft.value;
  const itemIds = new Set<string>();
  const seriesIds = new Set<string>();
  const seriesById = new Map<string, Series>();
  const items: Item[] = [];
  if (d) {
    for (const c of d.candidates) {
      if (c.kind === "item") {
        itemIds.add(c.item.id);
        items.push(c.item);
      } else {
        seriesIds.add(c.seriesId);
        if (c.series) seriesById.set(c.seriesId, c.series);
        items.push(...c.items);
      }
    }
  }
  return { itemIds, seriesIds, seriesById, items, duplicates: d?.duplicates ?? new Set<string>() };
});

/** Keys that can be selected while previewing (duplicates can't). */
export const selectableImportKeys = computed(() => {
  const d = importDraft.value;
  return d ? d.candidates.filter((c) => !d.duplicates.has(duplicateId(c))).map(candidateKey) : [];
});

export function discardImport() {
  batch(() => {
    importDraft.value = null;
    importStatus.value = { kind: "idle" };
  });
}

// Leaving import mode (Cancel, Escape, toggling the button) discards the draft.
effect(() => {
  if (selectionMode.value !== "import" && (importDraft.peek() || importStatus.peek().kind !== "idle")) discardImport();
});

function load(text: string, label: string) {
  let parsed;
  try {
    parsed = parseIcs(text);
  } catch (error) {
    importStatus.value = {
      kind: "error",
      message: error instanceof ImportError ? error.message : "Something went wrong reading that calendar.",
    };
    return;
  }
  if (parsed.candidates.length === 0) {
    importStatus.value = {
      kind: "error",
      message:
        parsed.pastHidden > 0
          ? `No upcoming events in ${parsed.name ?? "this calendar"} (${parsed.pastHidden} past ${parsed.pastHidden === 1 ? "event" : "events"} hidden).`
          : `No events found in ${parsed.name ?? "this calendar"}.`,
    };
    return;
  }
  const dupIds = findDuplicates(parsed.candidates, indexExisting(items.value, series.value));
  batch(() => {
    importDraft.value = {
      source: parsed.name ?? label,
      candidates: parsed.candidates,
      duplicates: dupIds,
      pastHidden: parsed.pastHidden,
      truncated: parsed.truncated,
    };
    importStatus.value = { kind: "idle" };
    // New events start checked; duplicates start unchecked.
    selected.value = new Set(parsed.candidates.filter((c) => !dupIds.has(duplicateId(c))).map(candidateKey));
  });
}

const looksLikeCalendarFile = (file: File) =>
  /\.(ics|ical|ifb|icalendar)$/i.test(file.name) || file.type === "text/calendar";

export async function importFile(file: File) {
  if (!looksLikeCalendarFile(file)) {
    importStatus.value = { kind: "error", message: `${file.name} isn't a calendar file. Choose an .ics file.` };
    return;
  }
  if (file.size > MAX_CALENDAR_BYTES) {
    importStatus.value = { kind: "error", message: "That calendar is too large to import (over 10 MB)." };
    return;
  }
  importStatus.value = { kind: "loading", label: `Reading ${file.name}…` };
  try {
    load(await file.text(), file.name);
  } catch {
    importStatus.value = { kind: "error", message: `Couldn't read ${file.name}.` };
  }
}

const FETCH_TIMEOUT_MS = 20_000;

/**
 * Fetches a calendar link. Must be called directly from a user action (click
 * or submit): Chrome only shows the host-permission prompt during one, so the
 * request starts synchronously before anything is awaited.
 */
export function importUrl(input: string): Promise<void> {
  const normalized = normalizeCalendarUrl(input);
  if ("error" in normalized) {
    importStatus.value = { kind: "error", message: normalized.error };
    return Promise.resolve();
  }
  const { url } = normalized;
  const permission: Promise<boolean> =
    typeof chrome !== "undefined" && chrome.permissions?.request
      ? chrome.permissions.request({ origins: permissionOrigins(url) })
      : Promise.resolve(true); // Local preview outside the extension.
  importStatus.value = { kind: "loading", label: `Connecting to ${url.hostname}…` };
  return fetchCalendar(url, permission);
}

async function fetchCalendar(url: URL, permission: Promise<boolean>) {
  try {
    if (!(await permission)) {
      importStatus.value = { kind: "error", message: `Countdown needs permission to read ${url.hostname}. Try again and choose Allow.` };
      return;
    }
  } catch {
    importStatus.value = { kind: "error", message: "Couldn't ask for permission to read that link." };
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store", redirect: "follow" });
  } catch (error) {
    clearTimeout(timer);
    importStatus.value = {
      kind: "error",
      message:
        controller.signal.aborted
          ? `${url.hostname} took too long to respond.`
          : `Couldn't reach ${url.hostname}. Check the link and your connection.`,
    };
    return;
  }
  clearTimeout(timer);

  if (!response.ok) {
    const hint = response.status === 401 || response.status === 403 || response.status === 404
      ? " Make sure it's a public or secret iCal link."
      : "";
    importStatus.value = { kind: "error", message: `The calendar server replied ${response.status}.${hint}` };
    return;
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_CALENDAR_BYTES) {
    importStatus.value = { kind: "error", message: "That calendar is too large to import (over 10 MB)." };
    return;
  }
  importStatus.value = { kind: "loading", label: "Reading calendar…" };
  const text = await response.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    importStatus.value = {
      kind: "error",
      message: "That link didn't return a calendar. Use the iCal (.ics) address, not the web page link.",
    };
    return;
  }
  load(text, url.hostname);
}

/** Adds the selected, non-duplicate candidates to the list, optionally into a category. */
export function commitImport(categoryId: string | null = null) {
  const d = importDraft.value;
  if (!d) return;
  const keys = selected.value;
  const newItems: Item[] = [];
  const newSeries: Series[] = [];
  let count = 0;
  for (const c of d.candidates) {
    if (!keys.has(candidateKey(c)) || d.duplicates.has(duplicateId(c))) continue;
    count++;
    if (c.kind === "item") newItems.push(c.item);
    else {
      newItems.push(...c.items);
      if (c.series) newSeries.push(c.series);
    }
  }
  const inCategory = <T extends { categoryId?: string }>(x: T): T => (categoryId ? { ...x, categoryId } : x);
  addImported(newItems.map(inCategory), newSeries.map(inCategory), count);
}
