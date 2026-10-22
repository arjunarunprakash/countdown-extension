import { batch } from "@preact/signals";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDismiss, type DismissReason } from "../hooks/useDismiss";
import { differs, fieldsOf, withFields, type ItemFields } from "../lib/items";
import type { Item, Unit } from "../lib/types";
import { presetOf } from "../lib/recurrence";
import { addItem, changeSeriesRule, makeRepeating, removeItems, saveItem, saveSeries, series } from "../state/store";
import { editing, focusTile, startCompletion } from "../state/ui";
import { CountdownBox } from "./CountdownBox";
import { SelectCell } from "./SelectCell";
import { DatePicker } from "./DatePicker";
import { NO_REPEAT, RepeatField, ruleOf, sameRepeat, type RepeatValue } from "./RepeatField";
import { Icon } from "./Icon";
import { TimeField } from "./TimeField";
import { TypeToggle } from "./TypeToggle";

interface Props {
  item: Item;
  isNew: boolean;
  unit: Unit;
  now: number;
}

/** The repeat settings an item starts with: its series' rule, or none. */
function initialRepeat(item: Item): RepeatValue {
  const s = item.seriesId ? series.value.find((x) => x.id === item.seriesId) : undefined;
  if (!s) return NO_REPEAT;
  const preset = presetOf(s.rule);
  return preset === "custom" ? { preset, end: s.end, custom: s.rule } : { preset, end: s.end };
}

/**
 * A tile in its expanded edit state. Every field edits a local draft; the
 * draft is saved when the editor closes (Escape, Enter in the title, or a
 * click anywhere outside). A new item with no title is discarded.
 */
export function EditorRow({ item, isNew, unit, now }: Props) {
  const [fields, setFields] = useState<ItemFields>(() => fieldsOf(item));
  const [initial] = useState(() => initialRepeat(item));
  const [repeat, setRepeat] = useState<RepeatValue>(initial);
  const latestRepeat = useRef(repeat);
  latestRepeat.current = repeat;
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const latest = useRef(fields);
  latest.current = fields;

  useLayoutEffect(() => {
    titleRef.current?.focus();
    if (!isNew) titleRef.current?.select();
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const set = <K extends keyof ItemFields>(key: K, value: ItemFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));

  /** Saves the draft; returns the saved item, or null if nothing was kept. */
  const save = (): Item | null => batch(saveDraft);

  const saveDraft = (): Item | null => {
    const f = latest.current;
    const r = latestRepeat.current;
    const rule = ruleOf(r);
    const repeatChanged = !sameRepeat(r, initial);
    const stamp = new Date();

    if (isNew) {
      if (!f.title.trim()) return null;
      let created = withFields(item, f, stamp);
      if (rule) created = makeRepeating(created, rule, r.end);
      addItem(created);
      return created;
    }

    let next = withFields(item, { ...f, title: f.title.trim() || item.title }, stamp);
    if (!item.seriesId) {
      if (rule) next = makeRepeating(next, rule, r.end);
      if (rule || differs(item, next)) saveItem(next);
      return next;
    }

    // Part of a series: date/time/notes edits apply to this occurrence;
    // title/type also update the series so later occurrences match.
    if (differs(item, next)) saveItem(next);
    if (repeatChanged) {
      changeSeriesRule(item.seriesId, next, rule, r.end);
      if (!rule) {
        const { seriesId: _, ...single } = next;
        return single;
      }
    } else if (next.title !== item.title || next.type !== item.type) {
      saveSeries(item.seriesId, next);
    }
    return next;
  };

  const close = (reason: DismissReason | "enter") => {
    const saved = save();
    editing.value = null;
    if (saved && reason !== "outside") focusTile(saved.id);
  };

  useDismiss(ref, close);

  const preview = withFields(item, fields, new Date(now));

  return (
    <li class="row grid-row row--editing">
      <SelectCell />
      <CountdownBox item={preview} unit={unit} now={now} />
      <div ref={ref} class="editor" role="group" aria-label={isNew ? "New item" : `Edit ${item.title}`}>
        <input
          ref={titleRef}
          class="editor__title"
          aria-label="Title"
          placeholder={isNew ? "What's coming up?" : "Title"}
          maxLength={200}
          value={fields.title}
          onInput={(e) => set("title", e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              close("enter");
            }
          }}
        />

        <TypeToggle value={fields.type} onChange={(v) => set("type", v)} />

        <div class="editor__when">
          <DatePicker value={fields.date} onChange={(v) => set("date", v)} />
          <TimeField value={fields.time} onChange={(v) => set("time", v)} />
        </div>

        <RepeatField date={fields.date} value={repeat} onChange={setRepeat} />

        <textarea
          class="editor__notes"
          aria-label="Notes"
          placeholder="Add notes"
          rows={2}
          maxLength={2000}
          value={fields.notes}
          onInput={(e) => set("notes", e.currentTarget.value)}
        />

        <div class="editor__actions">
          {!isNew && (
            <button
              type="button"
              class="button button--quiet"
              onClick={() => {
                const saved = save();
                editing.value = null;
                if (saved) startCompletion(saved.id);
              }}
            >
              <Icon name="check" />
              Complete
            </button>
          )}
          <button
            type="button"
            class="button button--danger-quiet"
            onClick={() => {
              editing.value = null;
              if (!isNew) removeItems([item.id]);
            }}
          >
            {isNew ? "Discard" : "Remove"}
          </button>
        </div>
      </div>
    </li>
  );
}
