import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDismiss, type DismissReason } from "../hooks/useDismiss";
import { relativeLabel } from "../lib/countdown";
import { formatItemDate, formatShortDateTime } from "../lib/dates";
import { formatTime } from "../lib/parse";
import type { Item, ItemType, Unit } from "../lib/types";
import { removeItems, saveSeries } from "../state/store";
import { completing, editing, focusTile, startCompletion } from "../state/ui";
import { Checkbox } from "./Checkbox";
import { CountdownBox } from "./CountdownBox";
import { Icon } from "./Icon";
import { TypeToggle } from "./TypeToggle";

interface Props {
  seriesId: string;
  /** Upcoming occurrences, soonest first. */
  items: Item[];
  unit: Unit;
  now: number;
}

/**
 * An expanded recurring stack: edit the series title/type, and complete or
 * remove occurrences one at a time or in bulk. Closes like the item editor.
 */
export function StackEditorRow({ seriesId, items, unit, now }: Props) {
  const head = items[0]!;
  const [title, setTitle] = useState(head.title);
  const [type, setType] = useState<ItemType>(head.type);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ title, type });
  latest.current = { title, type };

  useLayoutEffect(() => {
    titleRef.current?.focus();
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);

  // Drop selections for occurrences that were removed or completed meanwhile.
  const ids = new Set(items.map((i) => i.id));
  const selectedHere = [...selected].filter((id) => ids.has(id));

  const close = (reason: DismissReason | "enter") => {
    saveSeries(seriesId, latest.current);
    editing.value = null;
    if (reason !== "outside") focusTile(items[0]!.id);
  };

  useDismiss(ref, close);

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const allChecked = selectedHere.length === items.length;

  return (
    <li class="row grid-row row--editing row--stack-open">
      <CountdownBox item={head} unit={unit} now={now} />
      <div ref={ref} class="editor editor--stack" role="group" aria-label={`Edit series ${head.title}`}>
        <input
          ref={titleRef}
          class="editor__title"
          aria-label="Series title"
          maxLength={200}
          value={title}
          onInput={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              close("enter");
            }
          }}
        />
        <TypeToggle value={type} onChange={setType} />

        <div class="occurrences">
          <div class="occurrences__head">
            <Checkbox
              checked={allChecked}
              indeterminate={selectedHere.length > 0 && !allChecked}
              onChange={(on) => setSelected(on ? new Set(ids) : new Set())}
              label="Select all"
            />
            <span class="occurrences__count">{items.length} upcoming</span>
          </div>

          <ul class="occurrences__list" role="list" aria-label="Occurrences">
            {items.map((occ) => {
              const date = new Date(occ.dateTime);
              const isCompleting = completing.value.has(occ.id);
              return (
                <li key={occ.id} class={`occurrence${isCompleting ? " occurrence--completing" : ""}`}>
                  <Checkbox
                    checked={selected.has(occ.id)}
                    onChange={(on) => toggle(occ.id, on)}
                    label={formatItemDate(date, occ.allDay)}
                    hideLabel
                  />
                  <span class="occurrence__text">
                    <span class="occurrence__date">{formatShortDateTime(date, true, new Date(now))}</span>
                    <span class="occurrence__rel">
                      {occ.allDay ? "All day" : formatTime({ hour: date.getHours(), minute: date.getMinutes() })} ·{" "}
                      {relativeLabel(date.getTime(), now)}
                    </span>
                  </span>
                  <button
                    type="button"
                    class="icon-button icon-button--sm icon-button--complete"
                    aria-label={`Complete ${formatItemDate(date, occ.allDay)}`}
                    data-tooltip="Complete"
                    data-tooltip-align="end"
                    disabled={isCompleting}
                    onClick={() => startCompletion(occ.id)}
                  >
                    <Icon name="check" />
                  </button>
                  <button
                    type="button"
                    class="icon-button icon-button--sm icon-button--danger"
                    aria-label={`Remove ${formatItemDate(date, occ.allDay)}`}
                    data-tooltip="Remove"
                    data-tooltip-align="end"
                    disabled={isCompleting}
                    onClick={() => removeItems([occ.id])}
                  >
                    <Icon name="close" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div class="editor__actions">
          <button
            type="button"
            class="button button--danger-quiet"
            disabled={selectedHere.length === 0}
            onClick={() => {
              removeItems(selectedHere);
              setSelected(new Set());
            }}
          >
            Remove selected{selectedHere.length > 0 && ` (${selectedHere.length})`}
          </button>
        </div>
      </div>
    </li>
  );
}
