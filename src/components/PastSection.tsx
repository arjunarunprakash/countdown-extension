import { useState } from "preact/hooks";
import type { Item, Unit } from "../lib/types";
import { CountdownBox } from "./CountdownBox";
import { Icon } from "./Icon";
import { ItemTile } from "./ItemTile";

interface Props {
  items: Item[];
  unit: Unit;
  now: number;
}

export function PastSection({ items, unit, now }: Props) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;

  return (
    <section class="past" aria-labelledby="past-heading">
      <h2>
        <button
          type="button"
          id="past-heading"
          class="section-toggle"
          aria-expanded={open}
          aria-controls="past-list"
          onClick={() => setOpen(!open)}
        >
          <Icon name="chevronDown" />
          Past <span class="section-toggle__count">{items.length}</span>
        </button>
      </h2>
      {open && (
        <ul id="past-list" role="list" class="list list--flush">
          {items.map((item) => (
            <li key={item.id} class="row grid-row">
              <CountdownBox item={item} unit={unit} now={now} />
              <ItemTile item={item} past />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
