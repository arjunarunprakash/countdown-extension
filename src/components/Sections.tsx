import type { ComponentChildren } from "preact";
import { useId, useState } from "preact/hooks";
import { formatItemDate, formatShortDateTime } from "../lib/dates";
import type { Prefs } from "../lib/storage";
import type { Item, Unit } from "../lib/types";
import { clearCompleted, prefs, removeItems, setPrefs, uncompleteItem } from "../state/store";
import { Icon } from "./Icon";
import { ItemRow } from "./ItemRow";
import { SelectCell } from "./SelectCell";
import { isSelecting } from "../state/selection";

interface SectionProps {
  title: string;
  count: number;
  prefKey: keyof Pick<Prefs, "overdueCollapsed" | "completedCollapsed">;
  /** Optional control on the right of the heading row (e.g. "Clear"). */
  action?: ComponentChildren;
  children: ComponentChildren;
}

/** A collapsible list section whose open state is remembered in prefs. */
function Section({ title, count, prefKey, action, children }: SectionProps) {
  const id = useId();
  if (count === 0) return null;
  const open = !prefs.value[prefKey];

  return (
    <section class="section" aria-labelledby={`${id}-heading`}>
      <div class="section__head">
        <h2>
          <button
            type="button"
            id={`${id}-heading`}
            class="section-toggle"
            aria-expanded={open}
            aria-controls={`${id}-list`}
            onClick={() => setPrefs({ [prefKey]: open })}
          >
            <Icon name="chevronDown" />
            {title} <span class="section-toggle__count">{count}</span>
          </button>
        </h2>
        {open && action}
      </div>
      {open && (
        <ul id={`${id}-list`} role="list" class="list list--flush">
          {children}
        </ul>
      )}
    </section>
  );
}

export function OverdueSection({ items, unit, now }: { items: Item[]; unit: Unit; now: number }) {
  return (
    <Section title="Overdue" count={items.length} prefKey="overdueCollapsed">
      {items.map((item) => (
        <ItemRow key={item.id} row={{ kind: "single", item }} unit={unit} now={now} past />
      ))}
    </Section>
  );
}

const PAGE = 20;

export function CompletedSection({ items, now }: { items: Item[]; now: number }) {
  const [shown, setShown] = useState(PAGE);
  const visible = items.slice(0, shown);
  const hidden = items.length - visible.length;

  return (
    <Section
      title="Completed"
      count={items.length}
      prefKey="completedCollapsed"
      action={
        <button type="button" class="button button--subtle" onClick={clearCompleted}>
          Clear
        </button>
      }
    >
      {visible.map((item) => (
        <CompletedRow key={item.id} item={item} now={now} />
      ))}
      {hidden > 0 && (
        <li class="section__more">
          <button type="button" class="button button--subtle" onClick={() => setShown(shown + PAGE)}>
            Show {Math.min(hidden, PAGE)} more
          </button>
        </li>
      )}
    </Section>
  );
}

function CompletedRow({ item, now }: { item: Item; now: number }) {
  const completedAt = formatItemDate(new Date(item.completedAt!));
  const original = formatShortDateTime(new Date(item.dateTime), item.allDay, new Date(now));
  return (
    <li class="row grid-row row--completed">
      <SelectCell />
      <div class="countdown countdown--completed" role="img" aria-label="Completed">
        <Icon name="check" />
      </div>
      {/* Completed items aren't part of selection; their actions pause meanwhile. */}
      <div class="tile tile--completed" inert={isSelecting.value}>
        <span class="tile__top">
          <span class="tile__title">{item.title}</span>
          <span class="tile__actions">
            <button
              type="button"
              class="icon-button icon-button--sm"
              aria-label={`Mark ${item.title} as not done`}
              data-tooltip="Mark as not done"
              data-tooltip-align="end"
              onClick={() => uncompleteItem(item.id)}
            >
              <Icon name="undo" />
            </button>
            <button
              type="button"
              class="icon-button icon-button--sm icon-button--danger"
              aria-label={`Remove ${item.title}`}
              data-tooltip="Remove"
              data-tooltip-align="end"
              onClick={() => removeItems([item.id])}
            >
              <Icon name="close" />
            </button>
          </span>
        </span>
        <span class="tile__date">
          <span class="visually-hidden">Completed </span>
          <time dateTime={item.completedAt}>{completedAt}</time>
        </span>
        <span class="tile__meta">
          {item.type === "due" ? "Due" : "Starts"} {original}
        </span>
      </div>
    </li>
  );
}
