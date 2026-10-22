import { useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "../hooks/useDismiss";
import { daysBetween, formatFullDay, fromYmd, toDateParts, toYmd } from "../lib/calendar";
import { formatShortDateTime } from "../lib/dates";
import { parseTypedDate, type DateParts } from "../lib/parse";
import { MAX_CUSTOM_DATES } from "../lib/recurrence";
import { CalendarMonth } from "./CalendarMonth";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

interface Props {
  /** Chosen days, YYYY-MM-DD, sorted. */
  dates: string[];
  onChange: (dates: string[]) => void;
}

const sortUnique = (days: Iterable<string>) => [...new Set(days)].sort().slice(0, MAX_CUSTOM_DATES);

/**
 * Hand-picked dates for a repeating item: chips for the chosen days and a
 * calendar popover where clicking toggles a day and Shift-click adds the
 * range from the last day clicked. Past days can't be chosen.
 */
export function MultiDatePicker({ dates, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const first = dates[0] ? fromYmd(dates[0]) : toDateParts(new Date());
  const [view, setView] = useState(first);
  const [focusDay, setFocusDay] = useState(first);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lastPicked = useRef<DateParts | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ids = { text: useId(), error: useId(), count: useId() };
  const todayYmd = toYmd(toDateParts(new Date()));
  const chosen = new Set(dates);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setError(null);
    if (returnFocus) triggerRef.current?.focus();
  };
  useDismiss(wrapRef, (reason) => close(reason === "escape"), open);

  const isPast = (d: DateParts) => toYmd(d) < todayYmd;

  const pick = (d: DateParts, e: { shiftKey: boolean }) => {
    const key = toYmd(d);
    if (e.shiftKey && lastPicked.current) {
      // Shift: add every choosable day between the last pick and this one.
      const range = daysBetween(lastPicked.current, d).filter((x) => !isPast(x)).map(toYmd);
      onChange(sortUnique([...dates, ...range]));
    } else {
      onChange(chosen.has(key) ? dates.filter((x) => x !== key) : sortUnique([...dates, key]));
    }
    lastPicked.current = d;
  };

  const addTyped = () => {
    const parsed = parseTypedDate(text);
    if (!parsed) return setError("Enter a real date as MM/DD/YYYY");
    if (isPast(parsed)) return setError("Choose today or a later date");
    onChange(sortUnique([...dates, toYmd(parsed)]));
    setView(parsed);
    setFocusDay(parsed);
    setText("");
    setError(null);
  };

  return (
    <div class="multi-dates" ref={wrapRef}>
      {dates.length > 0 && (
        <ul class="date-chips" role="list" aria-label="Chosen dates">
          {dates.map((day) => {
            const d = fromYmd(day);
            const date = new Date(d.year, d.month, d.day);
            return (
              <li key={day} class="date-chip">
                <span>{formatShortDateTime(date, true)}</span>
                <button
                  type="button"
                  class="date-chip__remove"
                  aria-label={`Remove ${formatFullDay(d)}`}
                  onClick={() => onChange(dates.filter((x) => x !== day))}
                >
                  <Icon name="close" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        ref={triggerRef}
        type="button"
        class="field-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) return close(false);
          setView(first);
          setFocusDay(first);
          setOpen(true);
        }}
      >
        <Icon name="calendar" />
        {dates.length ? "Add or remove dates" : "Choose dates"}
      </button>

      {open && (
        <Popover anchor={triggerRef} class="popover--date" role="dialog" aria-modal="false" aria-label="Choose dates" aria-describedby={ids.count}>
          <CalendarMonth
            view={view}
            onViewChange={setView}
            focusDay={focusDay}
            onFocusDayChange={setFocusDay}
            isSelected={(d) => chosen.has(toYmd(d))}
            isDisabled={isPast}
            onPick={pick}
            multiselect
          />
          <p id={ids.count} class="multi-dates__count" aria-live="polite">
            {dates.length === 0 ? "Click days to choose them" : `${dates.length} ${dates.length === 1 ? "date" : "dates"} chosen`}
            <span class="multi-dates__tip"> · Shift-click adds a range</span>
          </p>

          <div class="popover__field">
            <label for={ids.text} class="field-label">
              Or type a date to add
            </label>
            <div class="url-form__row">
              <input
                id={ids.text}
                class={`text-input${error ? " text-input--invalid" : ""}`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/DD/YYYY"
                value={text}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? ids.error : undefined}
                onInput={(e) => {
                  setText(e.currentTarget.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addTyped();
                }}
              />
              <button type="button" class="button button--primary" onClick={() => close(true)}>
                Done
              </button>
            </div>
            {error && (
              <p id={ids.error} class="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}
