import { isSelecting, selected, toggleSelected } from "../state/selection";
import { Checkbox } from "./Checkbox";

interface Props {
  /** Selection key; omit for rows that can't be selected (keeps the grid column). */
  selKey?: string;
  label?: string;
  /** Shown but not selectable (e.g. an import duplicate). */
  disabled?: boolean;
}

/**
 * First grid column of every row. Collapsed to zero width outside selection
 * mode; in selection mode the column widens and the checkbox slides in.
 * Inert while hidden so it can't be focused.
 */
export function SelectCell({ selKey, label = "", disabled = false }: Props) {
  return (
    <div class="select-cell" inert={!isSelecting.value}>
      {selKey && (
        <Checkbox
          checked={!disabled && selected.value.has(selKey)}
          disabled={disabled}
          onChange={(on) => toggleSelected(selKey, on)}
          label={`Select ${label}`}
          hideLabel
        />
      )}
    </div>
  );
}
