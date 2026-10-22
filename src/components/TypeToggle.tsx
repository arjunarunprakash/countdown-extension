import { useId } from "preact/hooks";
import type { ItemType } from "../lib/types";

interface Props {
  value: ItemType;
  onChange: (value: ItemType) => void;
}

const OPTIONS: { value: ItemType; label: string }[] = [
  { value: "due", label: "Due" },
  { value: "starts", label: "Starts" },
];

/** Two-option segmented control built on native radios (arrow keys work for free). */
export function TypeToggle({ value, onChange }: Props) {
  const name = useId();
  return (
    <fieldset class="segmented">
      <legend class="visually-hidden">Type</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} class="segmented__option">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
