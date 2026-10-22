import { useEffect, useRef } from "preact/hooks";

interface Props {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Hide the label visually (it stays available to screen readers). */
  hideLabel?: boolean;
  disabled?: boolean;
}

export function Checkbox({ checked, indeterminate = false, onChange, label, hideLabel = false, disabled }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label class="checkbox">
      <input
        ref={ref}
        type="checkbox"
        class="checkbox__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span class="checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 16 16" class="checkbox__mark">
          {indeterminate ? <path d="M4 8h8" /> : <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />}
        </svg>
      </span>
      <span class={hideLabel ? "visually-hidden" : "checkbox__label"}>{label}</span>
    </label>
  );
}
