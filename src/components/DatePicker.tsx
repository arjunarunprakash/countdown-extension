import { useId, useRef, useState } from "preact/hooks";
import { useDismiss } from "../hooks/useDismiss";
import { formatShortDay, sameDay } from "../lib/calendar";
import { formatTypedDate, parseTypedDate, type DateParts } from "../lib/parse";
import { CalendarMonth } from "./CalendarMonth";
import { Icon } from "./Icon";
import { Popover } from "./Popover";

interface Props {
  value: DateParts;
  onChange: (value: DateParts) => void;
  /** Accessible name prefix, e.g. "End date". */
  label?: string;
}

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
  const popoverRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const ids = { error: useId(), text: useId() };

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
    setOpen(true);
  };

  const pick = (p: DateParts) => {
    onChange(p);
    close(true);
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

  return (
    <div class="picker" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        class="field-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close(false) : openPicker())}
      >
        <Icon name="calendar" />
        <span class="visually-hidden">{label}: </span>
        {formatShortDay(value)}
      </button>

      {open && (
        <Popover
          anchor={triggerRef}
          popoverRef={popoverRef}
          class="popover--date"
          role="dialog"
          aria-modal="false"
          aria-label={label === "Date" ? "Choose date" : `Choose ${label.toLowerCase()}`}
        >
          <CalendarMonth
            view={view}
            onViewChange={setView}
            focusDay={focusDay}
            onFocusDayChange={setFocusDay}
            isSelected={(d) => sameDay(d, value)}
            onPick={pick}
          />

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
