import { computed, signal } from "@preact/signals";
import type { ExportEntry } from "../lib/ics";
import type { Sections } from "../lib/rows";
import { series } from "./store";
import { editing } from "./ui";

// Selection mode is shared by Export (Phase 4) and Import (Phase 5).
// Keys are item ids, or "series:<id>" for a whole repeating stack.

export type SelectionMode = "export" | "import";

export const selectionMode = signal<SelectionMode | null>(null);
export const selected = signal<ReadonlySet<string>>(new Set());

export const seriesKey = (id: string) => `series:${id}`;
const SERIES_PREFIX = "series:";

export function enterSelection(mode: SelectionMode) {
  editing.value = null;
  selected.value = new Set();
  selectionMode.value = mode;
}

export function exitSelection() {
  selectionMode.value = null;
  selected.value = new Set();
}

export function toggleSelected(key: string, on = !selected.value.has(key)) {
  const next = new Set(selected.value);
  if (on) next.add(key);
  else next.delete(key);
  selected.value = next;
}

export function setSelected(keys: Iterable<string>) {
  selected.value = new Set(keys);
}

/** Keys that can be selected: upcoming rows (stacks as one) and overdue items. Completed items are not. */
export function selectableKeys(sections: Sections): string[] {
  const keys = sections.upcoming.map((row) => (row.kind === "single" ? row.item.id : seriesKey(row.seriesId)));
  return [...keys, ...sections.overdue.map((i) => i.id)];
}

/** The selection as export entries, in list order; stale keys are dropped. */
export function selectionEntries(sections: Sections, keys: ReadonlySet<string>): ExportEntry[] {
  const entries: ExportEntry[] = [];
  for (const row of sections.upcoming) {
    if (row.kind === "single") {
      if (keys.has(row.item.id)) entries.push({ kind: "item", item: row.item });
      continue;
    }
    if (!keys.has(seriesKey(row.seriesId))) continue;
    const s = series.value.find((x) => x.id === row.seriesId);
    // A stack without a stored rule (shouldn't happen) exports its occurrences one by one.
    if (s) entries.push({ kind: "series", series: s, upcoming: row.items });
    else entries.push(...row.items.map((item) => ({ kind: "item" as const, item })));
  }
  for (const item of sections.overdue) if (keys.has(item.id)) entries.push({ kind: "item", item });
  return entries;
}

/** Splits selected keys into item ids and series ids. */
export function splitKeys(keys: Iterable<string>): { itemIds: string[]; seriesIds: string[] } {
  const itemIds: string[] = [];
  const seriesIds: string[] = [];
  for (const k of keys) (k.startsWith(SERIES_PREFIX) ? seriesIds.push(k.slice(SERIES_PREFIX.length)) : itemIds.push(k));
  return { itemIds, seriesIds };
}

export const isSelecting = computed(() => selectionMode.value !== null);
