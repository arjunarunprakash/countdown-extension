import type { ComponentChildren } from "preact";
import { formatItemDate } from "../lib/dates";
import type { Item } from "../lib/types";

interface Props {
  item: Item;
  past?: boolean;
  /** Extra line under the date, e.g. a stack's occurrence count. */
  meta?: ComponentChildren;
  onOpen?: () => void;
}

export function ItemTile({ item, past = false, meta, onOpen }: Props) {
  const date = formatItemDate(new Date(item.dateTime), item.allDay);
  return (
    <button
      type="button"
      class={`tile${past ? " tile--past" : ""}`}
      aria-label={`${item.title}, ${item.type === "due" ? "due" : "starts"} ${date}. Edit`}
      onClick={onOpen}
    >
      <span class="tile__top">
        <span class="tile__title">{item.title}</span>
        <span class={`tag tag--${item.type}`} aria-hidden="true">
          {item.type === "due" ? "Due" : "Starts"}
        </span>
      </span>
      <span class="tile__date">{date}</span>
      {meta && <span class="tile__meta">{meta}</span>}
    </button>
  );
}
