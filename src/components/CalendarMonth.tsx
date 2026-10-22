import { useId, useLayoutEffect, useRef } from "preact/hooks";
import { addDays, addMonths, formatFullDay, formatMonthYear, monthGrid, sameDay, toDateParts } from "../lib/calendar";
import type { DateParts } from "../lib/parse";
import { Icon } from "./Icon";

const WEEKDAYS = [
  ["S", "Sunday"],
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
] as const;

interface Props {
  view: DateParts;
  onViewChange: (p: DateParts) => void;
  /** The day holding keyboard focus (roving tabindex). */
  focusDay: DateParts;
  onFocusDayChange: (p: DateParts) => void;
  isSelected: (d: DateParts) => boolean;
  /** Shown but not choosable (e.g. past days). Stays focusable for navigation. */
  isDisabled?: (d: DateParts) => boolean;
  onPick: (d: DateParts, e: { shiftKey: boolean }) => void;
  /** Several days can be selected (sets aria-multiselectable). */
  multiselect?: boolean;
}

/**
 * Month grid with Google-Calendar-style keyboard support: arrows move a day
 * or week, Home/End to the week's ends, PageUp/PageDown a month (Shift: a
 * year), Enter/Space picks. Shared by the single and multi date pickers.
 */
export function CalendarMonth({ view, onViewChange, focusDay, onFocusDayChange, isSelected, isDisabled, onPick, multiselect }: Props) {
  const titleId = useId();
  const gridRef = useRef<HTMLTableElement>(null);
  // Focus the active day when the grid first appears and after keyboard moves.
  const moveFocus = useRef(true);
  const today = toDateParts(new Date());

  useLayoutEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  });

  const navigate = (p: DateParts) => {
    onFocusDayChange(p);
    onViewChange(p);
    moveFocus.current = true;
  };

  const onKey = (e: KeyboardEvent) => {
    const weekday = new Date(focusDay.year, focusDay.month, focusDay.day).getDay();
    const moves: Record<string, () => DateParts> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      Home: () => addDays(focusDay, -weekday),
      End: () => addDays(focusDay, 6 - weekday),
      PageUp: () => addMonths(focusDay, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focusDay, e.shiftKey ? 12 : 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    navigate(move());
  };

  const grid = monthGrid(view.year, view.month);

  return (
    <>
      <div class="calendar__header">
        <button type="button" class="icon-button" aria-label="Previous month" onClick={() => onViewChange(addMonths(view, -1))}>
          <Icon name="chevronLeft" />
        </button>
        <h3 id={titleId} class="calendar__title" aria-live="polite">
          {formatMonthYear(view)}
        </h3>
        <button type="button" class="icon-button" aria-label="Next month" onClick={() => onViewChange(addMonths(view, 1))}>
          <Icon name="chevronRight" />
        </button>
      </div>

      <table
        ref={gridRef}
        class="calendar"
        role="grid"
        aria-labelledby={titleId}
        aria-multiselectable={multiselect || undefined}
        onKeyDown={onKey}
      >
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
                const selected = isSelected(d);
                const disabled = isDisabled?.(d) ?? false;
                const classes = [
                  "calendar__day",
                  d.month !== view.month && "calendar__day--outside",
                  sameDay(d, today) && "calendar__day--today",
                  selected && "calendar__day--selected",
                  disabled && "calendar__day--disabled",
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
                      aria-disabled={disabled || undefined}
                      onClick={(e) => {
                        onFocusDayChange(d);
                        if (!disabled) onPick(d, e);
                      }}
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
    </>
  );
}
