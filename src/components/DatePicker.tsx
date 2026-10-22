import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";
import { useDismiss } from "../hooks/useDismiss";
import {
  addDays,
  addMonths,
  formatFullDay,
  formatMonthYear,
  formatShortDay,
  monthGrid,
  sameDay,
  toDateParts,
} from "../lib/calendar";
import { formatTypedDate, parseTypedDate, type DateParts } from "../lib/parse";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

interface Props {
  value: DateParts;
  onChange: (value: DateParts) => void;
  /** Accessible name prefix, e.g. "End date". */
  label?: string;
}

const WEEKDAYS = [
  ["S", "Sunday"],
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
] as const;

// A complete-looking date that still fails to parse (e.g. 02/30/2026) is
// flagged while typing; anything else waits for Enter or blur.
const LOOKS_COMPLETE = /^\s*\d{1,2}\s*[/.-]\s*\d{1,2}\s*[/.-]\s*\d{4}\s*$/;
const DATE_ERROR = "Enter a real date as MM/DD/YYYY";

/**
 * Date field modelled on Google Calendar's event picker: a button showing the
 * date opens a popover with a month grid and a text field kept in sync.
 */
export function DatePicker({ value, onChange, label = "Date" }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(value);
  const [focusDay, setFocusDay] = useState(value);
  const [text, setText] = useState(formatTypedDate(value));
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const moveFocus = useRef(false);
  const ids = { title: useId(), error: useId(), text: useId() };
  const today = toDateParts(new Date());

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setError(null);
    if (returnFocus) triggerRef.current?.focus();
  };

  useDismiss(wrapRef, (reason) => close(reason === "escape"), open);

  const openPicker = () => {
    setView(value);
    setFocusDay(value);
    setText(formatTypedDate(value));
    setError(null);
    moveFocus.current = true;
    setOpen(true);
  };

  // Move DOM focus to the active day after keyboard navigation or opening.
  // Layout effect so focus moves in the same frame as the DOM update.
  useLayoutEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  });

  const pick = (p: DateParts) => {
    onChange(p);
    close(true);
  };

  const navigate = (p: DateParts) => {
    setFocusDay(p);
    setView(p);
    moveFocus.current = true;
  };

  const onGridKey = (e: KeyboardEvent) => {
    const moves: Record<string, () => DateParts> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      Home: () => addDays(focusDay, -new Date(focusDay.year, focusDay.month, focusDay.day).getDay()),
      End: () => addDays(focusDay, 6 - new Date(focusDay.year, focusDay.month, focusDay.day).getDay()),
      PageUp: () => addMonths(focusDay, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusDay, e.shiftKey ? 12 : 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    navigate(move());
  };

  const onTextInput = (next: string) => {
    setText(next);
    const parsed = parseTypedDate(next);
    if (parsed) {
      setError(null);
      setView(parsed);
      setFocusDay(parsed);
      onChange(parsed);
    } else {
      setError(LOOKS_COMPLETE.test(next) ? DATE_ERROR : null);
    }
  };

  const commitText = () => {
    // Read the live input value: state may lag a render behind fast typing.
    if (parseTypedDate(textRef.current?.value ?? text)) return true;
    setError(DATE_ERROR);
    return false;
  };

  const grid = monthGrid(view.year, view.month);

  return (
    <div class="picker" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        class="field-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${formatFullDay(value)}. Change ${label.toLowerCase()}`}
        onClick={() => (open ? close(false) : openPicker())}
      >
        <Icon name="calendar" />
        {formatShortDay(value)}
      </button>

      {open && (
        <Popover
          anchor={triggerRef}
          popoverRef={popoverRef}
          class="popover--date"
          role="dialog"
          aria-modal="false"
          aria-labelledby={ids.title}
        >
          <div class="calendar__header">
            <button
              type="button"
              class="icon-button"
              aria-label="Previous month"
              onClick={() => setView(addMonths(view, -1))}
            >
              <Icon name="chevronLeft" />
            </button>
            <h3 id={ids.title} class="calendar__title" aria-live="polite">
              {formatMonthYear(view)}
            </h3>
            <button type="button" class="icon-button" aria-label="Next month" onClick={() => setView(addMonths(view, 1))}>
              <Icon name="chevronRight" />
            </button>
          </div>

          <table ref={gridRef} class="calendar" role="grid" aria-labelledby={ids.title} onKeyDown={onGridKey}>
            <thead>
              <tr>
                {WEEKDAYS.map(([short, full]) => (
                  <th key={full} scope="col" abbr={full}>
                    {short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, week) => (
                <tr key={week}>
                  {grid.slice(week * 7, week * 7 + 7).map((d) => {
                    const selected = sameDay(d, value);
                    const classes = [
                      "calendar__day",
                      d.month !== view.month && "calendar__day--outside",
                      sameDay(d, today) && "calendar__day--today",
                      selected && "calendar__day--selected",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <td key={`${d.month}-${d.day}`} role="gridcell" aria-selected={selected}>
                        <button
                          type="button"
                          class={classes}
                          tabIndex={sameDay(d, focusDay) ? 0 : -1}
                          aria-label={formatFullDay(d)}
                          aria-current={sameDay(d, today) ? "date" : undefined}
                          onClick={() => pick(d)}
                        >
                          {d.day}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div class="popover__field">
            <label for={ids.text} class="field-label">
              Or type a date
            </label>
            <input
              ref={textRef}
              id={ids.text}
              class={`text-input${error ? " text-input--invalid" : ""}`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="MM/DD/YYYY"
              value={text}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? ids.error : undefined}
              onInput={(e) => onTextInput(e.currentTarget.value)}
              onBlur={commitText}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (commitText()) close(true);
              }}
            />
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
