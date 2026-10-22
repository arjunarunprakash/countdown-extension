import { UNIT_LABEL } from "../lib/countdown";
import type { Unit } from "../lib/types";
import { prefs } from "../state/store";
import { cycleTheme, THEME_LABEL } from "../state/theme";
import { IconButton } from "./IconButton";

interface Props {
  unit: Unit;
  onCycleUnit?: () => void;
  onNew: () => void;
}

const THEME_ICON = { system: "monitor", light: "sun", dark: "moon" } as const;

export function Header({ unit, onCycleUnit, onNew }: Props) {
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
        <IconButton icon="plus" label="New item" onClick={onNew} />
        <IconButton icon="import" label="Import" />
        <IconButton icon="export" label="Export" />
        <IconButton
          icon={THEME_ICON[prefs.value.theme]}
          label={`Theme: ${THEME_LABEL[prefs.value.theme]}`}
          onClick={cycleTheme}
          tooltipAlign="end"
        />
      </div>
    </header>
  );
}
