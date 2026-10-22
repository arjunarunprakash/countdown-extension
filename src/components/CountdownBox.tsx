import { abbreviate, describeRemaining, unitsRemaining } from "../lib/countdown";
import type { Item, Unit } from "../lib/types";

interface Props {
  item: Item;
  unit: Unit;
  now: number;
  /** Plays the completion animation: the box turns into a check mark. */
  completing?: boolean;
}

const BURST = [0, 60, 120, 180, 240, 300];

export function CountdownBox({ item, unit, now, completing = false }: Props) {
  if (completing) {
    return (
      <div class="countdown countdown--done" role="img" aria-label="Completed">
        <svg class="countdown__check" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12.5 10 17.5 19 7" pathLength={1} />
        </svg>
        {BURST.map((deg) => (
          <span key={deg} class="countdown__spark" style={{ "--angle": `${deg}deg` }} aria-hidden="true" />
        ))}
      </div>
    );
  }

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
