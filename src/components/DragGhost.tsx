import { categories } from "../state/store";
import { drag } from "../state/drag";

/** A small label that follows the pointer while dragging, saying what will happen. */
export function DragGhost() {
  const d = drag.value;
  if (!d) return null;
  const target =
    d.subject.kind === "category"
      ? null
      : d.overCategory === "none"
        ? "Other"
        : (categories.value.find((c) => c.id === d.overCategory)?.name ?? null);
  return (
    <div
      class={`drag-ghost${d.subject.color ? ` category--${d.subject.color}` : ""}`}
      style={{ left: `${d.x + 14}px`, top: `${d.y + 14}px` }}
      aria-hidden="true"
    >
      <span class="category__dot" />
      <span class="drag-ghost__title">{d.subject.title}</span>
      {target && <span class="drag-ghost__target">→ {target}</span>}
    </div>
  );
}
