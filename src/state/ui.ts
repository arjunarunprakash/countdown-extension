import { signal } from "@preact/signals";
import type { Item } from "../lib/types";
import { completeItem } from "./store";

/** The single item (or series) currently expanded for editing. */
export type Editing = { kind: "item"; id: string } | { kind: "series"; seriesId: string } | { kind: "new"; draft: Item };

export const editing = signal<Editing | null>(null);

/** Items playing the completion animation; they finish completing when it ends. */
export const completing = signal<ReadonlySet<string>>(new Set());

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Where keyboard focus should go when a tile is about to leave the list:
 * the next tile, else the previous one, else the New item button.
 */
export function neighbourOf(id: string): () => void {
  // The item's row: its tile, or the editor open in its place.
  const own =
    document.querySelector(`[data-tile-id="${CSS.escape(id)}"]`)?.closest("li.row") ??
    document.querySelector(".row--editing");
  const rows = [...document.querySelectorAll<HTMLElement>("li.row")];
  const at = own ? rows.indexOf(own as HTMLElement) : -1;
  const tileIn = (row: HTMLElement | undefined) => row?.querySelector<HTMLElement>("[data-tile-id]") ?? undefined;
  let target: HTMLElement | undefined;
  for (let i = at + 1; i < rows.length && !target; i++) target = tileIn(rows[i]);
  for (let i = at - 1; i >= 0 && !target; i--) target = tileIn(rows[i]);
  const targetId = target?.dataset.tileId;
  return () =>
    setTimeout(() => {
      const el = targetId ? document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(targetId)}"]`) : null;
      (el ?? document.querySelector<HTMLElement>('[aria-label="New item"]'))?.focus();
    });
}

/** Moves keyboard focus to an item's tile after the DOM updates. */
export function focusTile(id: string) {
  // Preact flushes renders in a microtask, so the tile exists by the next task.
  setTimeout(() => document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(id)}"]`)?.focus());
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
