import { batch, signal } from "@preact/signals";
import { toLocalISO } from "../lib/dates";
import * as ops from "../lib/items";
import { topUp, type RepeatEnd, type RepeatRule, type Series } from "../lib/recurrence";
import {
  DEFAULT_PREFS,
  defaultBackend,
  loadState,
  parseCompletions,
  parseItems,
  parsePrefs,
  parseSeries,
  type Prefs,
  type StorageBackend,
} from "../lib/storage";
import type { CompletionRecord, Item } from "../lib/types";
import { showToast } from "./toast";

export const items = signal<Item[]>([]);
export const completions = signal<CompletionRecord[]>([]);
export const series = signal<Series[]>([]);
export const prefs = signal<Prefs>(DEFAULT_PREFS);
export const ready = signal(false);

let backend: StorageBackend;

export async function initStore(b: StorageBackend = defaultBackend()) {
  backend = b;
  const state = await loadState(backend);
  batch(() => {
    items.value = state.items;
    completions.value = state.completions;
    series.value = state.series;
    prefs.value = state.prefs;
    ready.value = true;
  });
  // Keep side panels in other windows in sync.
  backend.subscribe((changes) => {
    batch(() => {
      if ("items" in changes) items.value = parseItems(changes.items);
      if ("completions" in changes) completions.value = parseCompletions(changes.completions);
      if ("series" in changes) series.value = parseSeries(changes.series);
      if ("prefs" in changes) prefs.value = parsePrefs(changes.prefs);
    });
  });
}

// Each setter persists *before* updating the signal. Updating a signal can
// synchronously run effects (e.g. ensureOccurrences) that write newer data;
// persisting first guarantees the newest write reaches storage last.

function setItems(next: Item[]) {
  void backend.set({ items: next });
  items.value = next;
}

function setCompletions(next: CompletionRecord[]) {
  void backend.set({ completions: next });
  completions.value = next;
}

function setSeries(next: Series[]) {
  void backend.set({ series: next });
  series.value = next;
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = { ...prefs.value, ...patch };
  void backend.set({ prefs: next });
  prefs.value = next;
}

// ── Actions ───────────────────────────────────────────────────

export function addItem(item: Item) {
  setItems([...items.value, item]);
}

export function saveItem(item: Item) {
  setItems(items.value.map((i) => (i.id === item.id ? item : i)));
}

/**
 * Applies title/type changes to a series: its template (future occurrences)
 * and every upcoming, uncompleted occurrence. Past and completed occurrences
 * keep the title they had.
 */
export function saveSeries(seriesId: string, patch: Pick<Item, "title" | "type">, now = new Date()) {
  const title = patch.title.trim();
  const t = now.getTime();
  batch(() => {
    setItems(
      items.value.map((i) =>
        i.seriesId === seriesId &&
        !i.completedAt &&
        Date.parse(i.dateTime) > t &&
        ((title && i.title !== title) || i.type !== patch.type)
          ? { ...i, title: title || i.title, type: patch.type, updatedAt: toLocalISO(now) }
          : i,
      ),
    );
    const s = series.value.find((x) => x.id === seriesId);
    if (s && ((title && s.template.title !== title) || s.template.type !== patch.type)) {
      setSeries(
        series.value.map((x) =>
          x.id === seriesId ? { ...x, template: { ...x.template, title: title || x.template.title, type: patch.type } } : x,
        ),
      );
    }
  });
}

// ── Recurring series ──────────────────────────────────────────

/**
 * Turns an item into the first occurrence of a new repeating series.
 * Call inside batch() together with adding/saving the returned item, so
 * occurrence generation sees both at once.
 */
export function makeRepeating(item: Item, rule: RepeatRule, end: RepeatEnd): Item {
  const s: Series = {
    id: crypto.randomUUID(),
    epoch: 0,
    start: item.dateTime,
    rule,
    end,
    template: { title: item.title, type: item.type, ...(item.notes ? { notes: item.notes } : {}) },
    nextIndex: 1,
  };
  if (item.allDay) s.allDay = true;
  setSeries([...series.value, s]);
  return { ...item, seriesId: s.id };
}

/**
 * Changes a series' repeat rule, restarting it from `anchor` (an upcoming
 * occurrence that is kept). Other upcoming occurrences are regenerated;
 * past and completed ones stay. A null rule stops the series and leaves
 * the anchor as a one-off item.
 */
export function changeSeriesRule(seriesId: string, anchor: Item, rule: RepeatRule | null, end: RepeatEnd, now = new Date()) {
  const s = series.value.find((x) => x.id === seriesId);
  if (!s) return;
  const t = now.getTime();
  const isUpcomingSibling = (i: Item) =>
    i.seriesId === seriesId && i.id !== anchor.id && !i.completedAt && Date.parse(i.dateTime) > t;

  batch(() => {
    const kept = items.value.filter((i) => !isUpcomingSibling(i));
    if (rule) {
      setItems(kept.map((i) => (i.id === anchor.id ? { ...anchor, seriesId } : i)));
      const restarted: Series = {
        ...s,
        epoch: s.epoch + 1,
        start: anchor.dateTime,
        rule,
        end,
        template: { title: anchor.title, type: anchor.type, ...(anchor.notes ? { notes: anchor.notes } : {}) },
        nextIndex: 1,
      };
      if (anchor.allDay) restarted.allDay = true;
      else delete restarted.allDay;
      setSeries(series.value.map((x) => (x.id === seriesId ? restarted : x)));
    } else {
      setItems(
        kept.map((i) => {
          if (i.id !== anchor.id) return i;
          const { seriesId: _, ...single } = anchor;
          return single;
        }),
      );
      setSeries(series.value.filter((x) => x.id !== seriesId));
    }
  });
}

/** Stops a series: removes its upcoming occurrences and the rule, with undo. */
export function removeSeries(seriesId: string, now = new Date()) {
  removeMany([], [seriesId], now);
}

/**
 * Removes items and whole series (their upcoming occurrences and rules) as
 * one change, with a single Undo that restores all of it.
 */
export function removeMany(itemIds: Iterable<string>, seriesIds: Iterable<string>, now = new Date()) {
  const t = now.getTime();
  const picked = new Set(itemIds);
  const sIds = new Set(seriesIds);
  const ids = new Set(picked);
  for (const i of items.value) {
    if (i.seriesId && sIds.has(i.seriesId) && !i.completedAt && Date.parse(i.dateTime) > t) ids.add(i.id);
  }
  const removedSeries = series.value.filter((s) => sIds.has(s.id));
  const { next, removed } = ops.removeIds(items.value, ids);
  if (removed.length === 0 && removedSeries.length === 0) return;

  batch(() => {
    setItems(next);
    if (removedSeries.length) setSeries(series.value.filter((s) => !sIds.has(s.id)));
  });

  // Count what the user picked: each item and each series once.
  const pickedRemoved = removed.filter((r) => picked.has(r.item.id)).length;
  const count = pickedRemoved + removedSeries.length;
  const message =
    pickedRemoved === 0 && removedSeries.length === 1
      ? "Repeating item removed"
      : count === 1
        ? "Item removed"
        : `${count} items removed`;

  showToast({
    message,
    action: {
      label: "Undo",
      run: () =>
        batch(() => {
          setItems(ops.restore(items.value, removed));
          const missing = removedSeries.filter((s) => !series.value.some((x) => x.id === s.id));
          if (missing.length) setSeries([...series.value, ...missing]);
        }),
    },
  });
}

/**
 * Adds imported items and series as one change. Undo removes them again,
 * including occurrences generated for the imported series since.
 */
export function addImported(newItems: Item[], newSeries: Series[], count: number) {
  if (newItems.length === 0 && newSeries.length === 0) return;
  const ids = new Set(newItems.map((i) => i.id));
  const sids = new Set(newSeries.map((s) => s.id));
  batch(() => {
    setItems([...items.value, ...newItems]);
    if (newSeries.length) setSeries([...series.value, ...newSeries]);
  });
  showToast({
    message: count === 1 ? "Added 1 item" : `Added ${count} items`,
    action: {
      label: "Undo",
      run: () =>
        batch(() => {
          setItems(items.value.filter((i) => !ids.has(i.id) && !(i.seriesId && sids.has(i.seriesId) && !i.completedAt)));
          if (sids.size) setSeries(series.value.filter((s) => !sids.has(s.id)));
        }),
    },
  });
}

/**
 * Generates upcoming occurrences for every series that is running low.
 * Safe to call often: it only writes when something was added.
 */
export function ensureOccurrences(now: number) {
  if (!ready.value || series.value.length === 0) return;
  const added: Item[] = [];
  let changed = false;
  const nextSeries = series.value.map((s) => {
    const result = topUp(s, [...items.value, ...added], now);
    added.push(...result.added);
    if (result.series !== s) changed = true;
    return result.series;
  });
  if (added.length === 0 && !changed) return;
  batch(() => {
    if (added.length) setItems([...items.value, ...added]);
    if (changed) setSeries(nextSeries);
  });
}

export function removeItems(ids: Iterable<string>) {
  const { next, removed } = ops.removeIds(items.value, new Set(ids));
  if (removed.length === 0) return;
  setItems(next);
  showToast({
    message: removed.length === 1 ? "Item removed" : `${removed.length} items removed`,
    action: { label: "Undo", run: () => setItems(ops.restore(items.value, removed)) },
  });
}

/** Removes every completed item from the list. Completion records (stats) are kept. */
export function clearCompleted() {
  const ids = items.value.filter((i) => i.completedAt).map((i) => i.id);
  const { next, removed } = ops.removeIds(items.value, new Set(ids));
  if (removed.length === 0) return;
  setItems(next);
  showToast({
    message: `Cleared ${removed.length} completed`,
    action: { label: "Undo", run: () => setItems(ops.restore(items.value, removed)) },
  });
}

/** Moves a completed item back to the list and drops its completion record. */
export function uncompleteItem(id: string) {
  const record = completions.value.findLast((c) => c.itemId === id);
  const completedAt = items.value.find((i) => i.id === id)?.completedAt;
  if (!completedAt) return;
  batch(() => {
    setItems(ops.uncomplete(items.value, id));
    if (record) setCompletions(completions.value.filter((c) => c.id !== record.id));
  });
  showToast({
    message: "Marked as not done",
    action: {
      label: "Undo",
      run: () =>
        batch(() => {
          setItems(items.value.map((i) => (i.id === id ? { ...i, completedAt } : i)));
          if (record) setCompletions([...completions.value, record]);
        }),
    },
  });
}

export function completeItem(id: string, now = new Date()) {
  const result = ops.complete(items.value, id, now);
  if (!result) return;
  batch(() => {
    setItems(result.next);
    setCompletions([...completions.value, result.record]);
  });
  showToast({
    message: "Completed",
    action: {
      label: "Undo",
      run: () =>
        batch(() => {
          setItems(ops.uncomplete(items.value, id));
          setCompletions(completions.value.filter((c) => c.id !== result.record.id));
        }),
    },
  });
}
