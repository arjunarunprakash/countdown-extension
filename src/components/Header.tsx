import { UNIT_LABEL } from "../lib/countdown";
import type { Unit } from "../lib/types";
import { IconButton } from "./IconButton";

interface Props {
  unit: Unit;
  onCycleUnit?: () => void;
}

export function Header({ unit, onCycleUnit }: Props) {
  return (
    <header class="header grid-row">
      <button
        type="button"
        class="unit-label"
        aria-label={`Countdown unit: ${UNIT_LABEL[unit]}. Change unit`}
        data-tooltip="Change unit"
        data-tooltip-align="start"
        onClick={onCycleUnit}
      >
        {UNIT_LABEL[unit]}
      </button>
      <div class="header__actions">
        <IconButton icon="plus" label="New item" />
        <IconButton icon="import" label="Import" />
        <IconButton icon="export" label="Export" tooltipAlign="end" />
      </div>
    </header>
  );
}
