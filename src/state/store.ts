import { batch, signal } from "@preact/signals";
import { toLocalISO } from "../lib/dates";
import * as ops from "../lib/items";
import {
  DEFAULT_PREFS,
  defaultBackend,
  loadState,
  parseCompletions,
  parseItems,
  parsePrefs,
  type Prefs,
  type StorageBackend,
} from "../lib/storage";
import type { CompletionRecord, Item } from "../lib/types";
import { showToast } from "./toast";

export const items = signal<Item[]>([]);
export const completions = signal<CompletionRecord[]>([]);
export const prefs = signal<Prefs>(DEFAULT_PREFS);
export const ready = signal(false);

let backend: StorageBackend;

export async function initStore(b: StorageBackend = defaultBackend()) {
  backend = b;
  const state = await loadState(backend);
  batch(() => {
    items.value = state.items;
    completions.value = state.completions;
    prefs.value = state.prefs;
    ready.value = true;
  });
  // Keep side panels in other windows in sync.
  backend.subscribe((changes) => {
    batch(() => {
      if ("items" in changes) items.value = parseItems(changes.items);
      if ("completions" in changes) completions.value = parseCompletions(changes.completions);
      if ("prefs" in changes) prefs.value = parsePrefs(changes.prefs);
    });
  });
}

function setItems(next: Item[]) {
  items.value = next;
  void backend.set({ items: next });
}

function setCompletions(next: CompletionRecord[]) {
  completions.value = next;
  void backend.set({ completions: next });
}

export function setPrefs(patch: Partial<Prefs>) {
  prefs.value = { ...prefs.value, ...patch };
  void backend.set({ prefs: prefs.value });
}

// ── Actions ───────────────────────────────────────────────────

export function addItem(item: Item) {
  setItems([...items.value, item]);
}

export function saveItem(item: Item) {
  setItems(items.value.map((i) => (i.id === item.id ? item : i)));
}

/** Applies title/type changes to every occurrence of a recurring series. */
export function saveSeries(seriesId: string, patch: Pick<Item, "title" | "type">, now = new Date()) {
  const title = patch.title.trim();
  setItems(
    items.value.map((i) =>
      i.seriesId === seriesId && (i.title !== title || i.type !== patch.type)
        ? { ...i, title: title || i.title, type: patch.type, updatedAt: toLocalISO(now) }
        : i,
    ),
  );
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
