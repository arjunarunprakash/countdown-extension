import type { Item, Unit } from "../lib/types";
import { prefs, setPrefs } from "../state/store";
import { Icon } from "./Icon";
import { ItemRow } from "./ItemRow";

interface Props {
  items: Item[];
  unit: Unit;
  now: number;
}

export function PastSection({ items, unit, now }: Props) {
  if (items.length === 0) return null;
  const open = !prefs.value.pastCollapsed;

  return (
    <section class="past" aria-labelledby="past-heading">
      <h2>
        <button
          type="button"
          id="past-heading"
          class="section-toggle"
          aria-expanded={open}
          aria-controls="past-list"
          onClick={() => setPrefs({ pastCollapsed: open })}
        >
          <Icon name="chevronDown" />
          Past <span class="section-toggle__count">{items.length}</span>
        </button>
      </h2>
      {open && (
        <ul id="past-list" role="list" class="list list--flush">
          {items.map((item) => (
            <ItemRow key={item.id} row={{ kind: "single", item }} unit={unit} now={now} past />
          ))}
        </ul>
      )}
    </section>
  );
}
