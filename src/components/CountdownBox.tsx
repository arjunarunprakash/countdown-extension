import { abbreviate, describeRemaining, unitsRemaining } from "../lib/countdown";
import type { Item, Unit } from "../lib/types";

interface Props {
  item: Item;
  unit: Unit;
  now: number;
}

export function CountdownBox({ item, unit, now }: Props) {
  const target = Date.parse(item.dateTime);
  const value = unitsRemaining(target, now, unit);

  if (value === null) {
    const overdue = item.type === "due";
    return (
      <div class={`countdown countdown--past ${overdue ? "countdown--overdue" : "countdown--started"}`}>
        {overdue ? "Overdue" : "Started"}
      </div>
    );
  }

  const full = describeRemaining(target, now);
  return (
    <div
      class="countdown"
      role="img"
      aria-label={`${full} left`}
      data-tooltip={`${full} left`}
      data-tooltip-align="start"
    >
      {abbreviate(value)}
    </div>
  );
}
