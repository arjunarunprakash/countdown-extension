import { batch } from "@preact/signals";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDismiss, type DismissReason } from "../hooks/useDismiss";
import { differs, fieldsOf, withFields, type ItemFields } from "../lib/items";
import type { Item, Unit } from "../lib/types";
import { fromYmd, nextMatchingDay, toYmd } from "../lib/calendar";
import { hasNumberToken, renderTitle } from "../lib/numbering";
import { occurrenceIndex, occurrenceTitle, presetOf, type Series } from "../lib/recurrence";
import { addItem, changeSeriesRule, makeRepeating, removeItems, saveItem, saveSeries, series } from "../state/store";
import { COMPLETE_MS, editing, focusTile, neighbourOf, prefersReducedMotion, startCompletion } from "../state/ui";
import { CountdownBox } from "./CountdownBox";
import { SelectCell } from "./SelectCell";
import { DatePicker } from "./DatePicker";
import { NO_REPEAT, RepeatField, ruleOf, sameRepeat, type RepeatValue } from "./RepeatField";
import { Icon } from "./Icon";
import { TitleNumbering } from "./TitleNumbering";
import { TimeField } from "./TimeField";
import { TypeToggle } from "./TypeToggle";

interface Props {
  item: Item;
  isNew: boolean;
  unit: Unit;
  now: number;
}

const seriesOf = (item: Item): Series | undefined =>
  item.seriesId ? series.value.find((x) => x.id === item.seriesId) : undefined;

/** The repeat settings an item starts with: its series' rule, or none. */
export function repeatOf(s: Series | undefined, from: Item): RepeatValue {
  if (!s) return NO_REPEAT;
  const preset = presetOf(s.rule);
  if (preset === "custom") return { preset, end: s.end, custom: s.rule };
  if (preset === "weeklyOn") return { preset, end: s.end, weekdays: s.rule.weekdays ?? [] };
  if (preset === "dates") {
    // Only this occurrence's date and later ones are editable.
    const fromDay = toYmd(fieldsOf(from).date);
    return { preset, end: s.end, dates: (s.rule.dates ?? []).filter((d) => d >= fromDay) };
  }
  return { preset, end: s.end };
}

/** How many occurrences a repeat will make, when that's known (for the title preview). */
export function occurrenceCount(r: RepeatValue): number | undefined {
  if (r.preset === "dates") return r.dates?.length;
  return r.end.type === "count" ? r.end.count : undefined;
}

/**
 * A tile in its expanded edit state. Every field edits a local draft; the
 * draft is saved when the editor closes (Escape, Enter in the title, or a
 * click anywhere outside). A new item with no title is discarded.
 */
export function EditorRow({ item, isNew, unit, now }: Props) {
  const [owner] = useState(() => seriesOf(item));
  const [fields, setFields] = useState<ItemFields>(() => {
    const f = fieldsOf(item);
    // An occurrence's series-wide title is the template ("Chapter {n}"), not
    // this occurrence's own title, which may be numbered or renamed on its own.
    return owner && !isNew ? { ...f, title: owner.template.title } : f;
  });
  const [initial] = useState(() => repeatOf(owner, item));
  const [repeat, setRepeatState] = useState<RepeatValue>(initial);
  const [numberFrom, setNumberFrom] = useState(owner?.numberFrom ?? 1);
  const latestRepeat = useRef(repeat);
  latestRepeat.current = repeat;
  const latestFrom = useRef(numberFrom);
  latestFrom.current = numberFrom;
  // Renaming an occurrence of a series: the whole series, or just this one.
  const [scope, setScope] = useState<"series" | "one">(item.customTitle ? "one" : "series");
  const [ownTitle, setOwnTitle] = useState(item.title);
  const latestOwn = useRef({ scope, ownTitle });
  latestOwn.current = { scope, ownTitle };
  const inSeries = !isNew && owner !== undefined;
  const onlyThis = inSeries && scope === "one";
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

  // With custom dates, the item's own date is the earliest chosen day; with
  // chosen weekdays, the first of those days on or after the current date.
  const setRepeat = (r: RepeatValue) => {
    setRepeatState(r);
    if (r.preset === "dates" && r.dates?.length) set("date", fromYmd(r.dates[0]!));
    if (r.preset === "weeklyOn" && r.weekdays?.length) setFields((f) => ({ ...f, date: nextMatchingDay(f.date, r.weekdays!) }));
  };

  /** Saves the draft; returns the saved item, or null if nothing was kept. */
  const save = (): Item | null => batch(saveDraft);

  const saveDraft = (): Item | null => {
    const f = { ...latest.current };
    const r = latestRepeat.current;
    const from = latestFrom.current;
    const rule = ruleOf(r);
    const repeatChanged = !sameRepeat(r, initial);
    const stamp = new Date();
    // A weekly-on-days series starts on one of its days (the date may have been changed since).
    if (rule?.freq === "WEEKLY" && rule.weekdays?.length) f.date = nextMatchingDay(f.date, rule.weekdays);
    const raw = f.title.trim();
    const numbered = hasNumberToken(raw);
    // A one-off item with {n} just reads it as the starting number.
    const firstTitle = numbered ? renderTitle(raw, 0, from) : raw;
    const title = { template: raw, numberFrom: from };

    if (isNew) {
      if (!raw) return null;
      let created = withFields(item, { ...f, title: firstTitle }, stamp);
      if (rule) created = makeRepeating(created, rule, r.end, title);
      addItem(created);
      return created;
    }

    if (!item.seriesId || !owner) {
      let next = withFields(item, { ...f, title: raw ? firstTitle : item.title }, stamp);
      if (rule && !item.seriesId) next = makeRepeating(next, rule, r.end, title);
      if (rule || differs(item, next)) saveItem(next);
      return next;
    }

    // Part of a series: date/time/notes edits apply to this occurrence;
    // the title (template) and type apply to the series, unless this
    // occurrence is renamed on its own.
    const index = occurrenceIndex(owner, item);
    const template = raw || owner.template.title;
    const seriesTitle = occurrenceTitle({ ...owner, template: { ...owner.template, title: template }, numberFrom: numbered ? from : undefined }, index);
    const own = latestOwn.current;
    const custom = own.scope === "one" && own.ownTitle.trim() !== "" && own.ownTitle.trim() !== seriesTitle;
    let next = withFields(item, { ...f, title: custom ? own.ownTitle : seriesTitle }, stamp);
    if (custom) next = { ...next, customTitle: true };
    else delete next.customTitle;
    if (differs(item, next) || Boolean(item.customTitle) !== Boolean(next.customTitle)) saveItem(next);

    if (repeatChanged) {
      // Restarting from this occurrence: it keeps its number.
      changeSeriesRule(item.seriesId, next, rule, r.end, stamp, { template, numberFrom: from + index });
      if (!rule) {
        const { seriesId: _, ...single } = next;
        return single;
      }
    } else if (template !== owner.template.title || next.type !== owner.template.type || (numbered && from !== owner.numberFrom)) {
      saveSeries(item.seriesId, { title: template, type: next.type, numberFrom: from });
    }
    return next;
  };

  const close = (reason: DismissReason | "enter") => {
    const saved = save();
    editing.value = null;
    if (saved && reason !== "outside") focusTile(saved.id);
  };

  useDismiss(ref, close);

  const preview = withFields(item, { ...fields, title: renderTitle(fields.title, 0, numberFrom) }, new Date(now));

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
          value={onlyThis ? ownTitle : fields.title}
          onInput={(e) => (onlyThis ? setOwnTitle(e.currentTarget.value) : set("title", e.currentTarget.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              close("enter");
            }
          }}
        />
        {inSeries && (
          <div class="rename-scope">
            <span id={`scope-label-${item.id}`} class="rename-scope__label">
              Rename
            </span>
            <div class="segmented segmented--small" role="radiogroup" aria-labelledby={`scope-label-${item.id}`}>
              {(
                [
                  ["series", "All upcoming"],
                  ["one", "Only this one"],
                ] as const
              ).map(([value, text]) => (
                <label key={value} class="segmented__option">
                  <input type="radio" name={`scope-${item.id}`} checked={scope === value} onChange={() => setScope(value)} />
                  <span>{text}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        {!onlyThis && (
          <TitleNumbering
            title={fields.title}
            onTitleChange={(v) => set("title", v)}
            from={numberFrom}
            onFromChange={setNumberFrom}
            repeating={repeat.preset !== "none"}
            count={occurrenceCount(repeat)}
            offset={owner && sameRepeat(repeat, initial) ? occurrenceIndex(owner, item) : 0}
            inputRef={titleRef}
          />
        )}

        <TypeToggle value={fields.type} onChange={(v) => set("type", v)} />

        <div class="editor__when">
          {/* Custom dates replace the single date with chips (in the repeat section). */}
          {repeat.preset !== "dates" && <DatePicker value={fields.date} onChange={(v) => set("date", v)} />}
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
                const refocus = neighbourOf(item.id);
                const saved = save();
                editing.value = null;
                if (saved) startCompletion(saved.id);
                // Keep keyboard users in place once the row has gone.
                setTimeout(refocus, prefersReducedMotion() ? 0 : COMPLETE_MS + 50);
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
              const refocus = neighbourOf(item.id);
              editing.value = null;
              if (!isNew) removeItems([item.id]);
              refocus();
            }}
          >
            {isNew ? "Discard" : "Remove"}
          </button>
        </div>
      </div>
    </li>
  );
}
