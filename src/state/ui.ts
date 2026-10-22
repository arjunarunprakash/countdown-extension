import { signal } from "@preact/signals";
import type { Item } from "../lib/types";
import { completeItem } from "./store";
import { showToast } from "./toast";

/** The single item (or series) currently expanded for editing. */
export type Editing = { kind: "item"; id: string } | { kind: "series"; seriesId: string } | { kind: "new"; draft: Item };

export const editing = signal<Editing | null>(null);

/** Items playing the completion animation; they finish completing when it ends. */
export const completing = signal<ReadonlySet<string>>(new Set());

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Moves keyboard focus to an item's tile after the DOM updates. */
export function focusTile(id: string) {
  // Preact flushes renders in a microtask, so the tile exists by the next task.
  setTimeout(() => document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(id)}"]`)?.focus());
}

/** Opens the import flow. The import sheet itself arrives in Phase 5. */
export function openImport() {
  showToast({ message: "Calendar import arrives in Phase 5" });
}

/** Length of the completion animation; keep in sync with components.css (.row--completing). */
export const COMPLETE_MS = 1000;

/** Plays the completion animation, then marks the item complete. */
export function startCompletion(id: string) {
  if (prefersReducedMotion()) return completeItem(id);
  completing.value = new Set(completing.value).add(id);
  setTimeout(() => {
    const next = new Set(completing.value);
    next.delete(id);
    completing.value = next;
    completeItem(id);
  }, COMPLETE_MS);
}
