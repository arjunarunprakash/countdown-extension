import { nextUnit, UNIT_LABEL } from "../lib/countdown";
import type { Unit } from "../lib/types";
import { prefs, setPrefs } from "../state/store";
import { openImport } from "../state/ui";
import { cycleTheme, THEME_LABEL } from "../state/theme";
import { IconButton } from "./IconButton";

interface Props {
  unit: Unit;
  onNew: () => void;
}

const THEME_ICON = { system: "monitor", light: "sun", dark: "moon" } as const;

export function Header({ unit, onNew }: Props) {
  return (
    <header class="header grid-row">
      <button
        type="button"
        class="unit-label"
        aria-label={`Countdown unit: ${UNIT_LABEL[unit]}. Change unit`}
        data-tooltip="Change unit"
        data-tooltip-align="start"
        onClick={() => setPrefs({ unit: nextUnit(unit) })}
      >
        <span key={unit} class="unit-label__text">
          {UNIT_LABEL[unit]}
        </span>
      </button>
      {/* Announces the new unit to screen readers after a change. */}
      <span class="visually-hidden" aria-live="polite">
        Showing time left in {unit}
      </span>
      <div class="header__actions">
        <IconButton icon="plus" label="New item" onClick={onNew} />
        <IconButton icon="import" label="Import" onClick={openImport} />
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
