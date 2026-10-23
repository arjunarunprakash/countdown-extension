import { signal } from "@preact/signals";
import type { CategoryColor } from "../lib/categories";

// Pointer-based drag and drop for moving items into categories and
// reordering categories. A press only becomes a drag after the pointer moves
// a few pixels, so a plain click still opens the item. Keyboard users get the
// same results from the Category field in editors and Move up/down in a
// category's menu.

export type DragSubject =
  | { kind: "item" | "series"; id: string; title: string; color?: CategoryColor }
  | { kind: "category"; id: string; title: string; color: CategoryColor };

export interface DragState {
  subject: DragSubject;
  x: number;
  y: number;
  /** Item drags: the category under the pointer ("none" = Other), if any. */
  overCategory: string | null;
  /** Category drags: index the category would move to. */
  insertAt: number | null;
}

export const drag = signal<DragState | null>(null);

const THRESHOLD = 6;
const EDGE = 48;
const SCROLL_STEP = 14;

interface Options {
  subject: () => DragSubject;
  /** Called on release over a valid target. */
  onDrop: (state: DragState) => void;
}

/**
 * Pointer handlers for a drag source. Returns an onPointerDown for the
 * element; the rest is tracked on the window until release.
 */
export function startDragOnPress(e: PointerEvent, { subject, onDrop }: Options) {
  if (e.button !== 0 || e.pointerType === "touch") return;
  const startX = e.clientX;
  const startY = e.clientY;
  let active = false;
  let scrollTimer: ReturnType<typeof setInterval> | undefined;
  let lastY = startY;

  const locate = (x: number, y: number): Pick<DragState, "overCategory" | "insertAt"> => {
    const s = drag.value?.subject ?? subject();
    if (s.kind === "category") {
      // Insert before the first category header whose middle is below the pointer.
      const heads = [...document.querySelectorAll<HTMLElement>("[data-category-head]")];
      let index = heads.length;
      for (let i = 0; i < heads.length; i++) {
        const r = heads[i]!.getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          index = i;
          break;
        }
      }
      return { overCategory: null, insertAt: index };
    }
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-category]");
    return { overCategory: target?.dataset.dropCategory ?? null, insertAt: null };
  };

  const onMove = (ev: PointerEvent) => {
    lastY = ev.clientY;
    if (!active) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < THRESHOLD) return;
      active = true;
      document.body.classList.add("is-dragging");
      // Scroll the panel while the pointer rests near its top or bottom edge.
      scrollTimer = setInterval(() => {
        if (lastY < EDGE) scrollBy(0, -SCROLL_STEP);
        else if (lastY > innerHeight - EDGE) scrollBy(0, SCROLL_STEP);
        else return;
        if (drag.value) drag.value = { ...drag.value, ...locate(drag.value.x, drag.value.y) };
      }, 16);
    }
    ev.preventDefault();
    drag.value = { subject: drag.value?.subject ?? subject(), x: ev.clientX, y: ev.clientY, ...locate(ev.clientX, ev.clientY) };
  };

  const finish = (drop: boolean) => {
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerup", onUp);
    removeEventListener("keydown", onKey, true);
    clearInterval(scrollTimer);
    document.body.classList.remove("is-dragging");
    const state = drag.value;
    drag.value = null;
    if (!active) return;
    // The release would otherwise "click" the element that was dragged.
    const swallow = (ce: MouseEvent) => {
      ce.stopPropagation();
      ce.preventDefault();
    };
    addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => removeEventListener("click", swallow, { capture: true }), 0);
    if (drop && state) onDrop(state);
  };
  const onUp = () => finish(true);
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key !== "Escape") return;
    ev.preventDefault();
    ev.stopPropagation();
    finish(false);
  };

  addEventListener("pointermove", onMove);
  addEventListener("pointerup", onUp);
  addEventListener("keydown", onKey, true);
}
