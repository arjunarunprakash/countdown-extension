import type { Candidate } from "./ics-import";
import type { Series } from "./recurrence";
import type { Item } from "./types";

// Duplicate detection for imports. A candidate is "Already added" when an
// existing item has the same title and date-time (title compared ignoring
// case and extra spaces), or the same iCalendar UID — which also catches
// re-importing a file this app exported.

const normalizeTitle = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

export const dupKey = (title: string, dateTime: string) => `${normalizeTitle(title)}|${Date.parse(dateTime)}`;

export interface Existing {
  keys: Set<string>;
  uids: Set<string>;
}

export function indexExisting(items: readonly Item[], series: readonly Series[]): Existing {
  const keys = new Set<string>();
  const uids = new Set<string>();
  for (const i of items) {
    keys.add(dupKey(i.title, i.dateTime));
    if (i.uid) uids.add(i.uid);
    uids.add(`${i.id}@countdown`);
  }
  for (const s of series) {
    if (s.uid) uids.add(s.uid);
    uids.add(`${s.id}@countdown`);
  }
  return { keys, uids };
}

/** First item of a candidate (the single item, or a series' next occurrence). */
export const headOf = (c: Candidate): Item => (c.kind === "item" ? c.item : c.items[0]!);

const uidOf = (c: Candidate) => (c.kind === "item" ? c.item.uid : (c.series?.uid ?? c.uid));

/**
 * Keys (candidate item id or series id) of candidates that are duplicates of
 * existing items, or of an earlier candidate in the same file.
 */
export function findDuplicates(candidates: readonly Candidate[], existing: Existing): Set<string> {
  const dupes = new Set<string>();
  const seen = new Set<string>();
  for (const c of candidates) {
    const head = headOf(c);
    const key = dupKey(head.title, head.dateTime);
    const uid = uidOf(c);
    const id = c.kind === "item" ? c.item.id : c.seriesId;
    if (existing.keys.has(key) || (uid && existing.uids.has(uid)) || seen.has(key)) dupes.add(id);
    seen.add(key);
  }
  return dupes;
}
