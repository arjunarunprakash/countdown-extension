import { nextUnit, UNIT_LABEL } from "../lib/countdown";
import type { Unit } from "../lib/types";
import { enterSelection, exitSelection, isSelecting, selected, selectionMode, setSelected } from "../state/selection";
import { prefs, setPrefs } from "../state/store";
import { cycleTheme, THEME_LABEL } from "../state/theme";
import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";

const THEME_ICON = { system: "monitor", light: "sun", dark: "moon" } as const;

interface Props {
  unit: Unit;
  onNew: () => void;
  /** Keys selectable in selection mode, for Select all. */
  selectable: string[];
}

export function Header({ unit, onNew, selectable }: Props) {
  const selecting = isSelecting.value;
  const count = selectable.filter((k) => selected.value.has(k)).length;
  const all = count > 0 && count === selectable.length;

  return (
    <header class="header grid-row">
      <h1 class="visually-hidden">Countdown</h1>
      <div class="select-cell" inert={!selecting}>
        <Checkbox
          checked={all}
          indeterminate={count > 0 && !all}
          disabled={selectable.length === 0}
          onChange={(on) => setSelected(on ? selectable : [])}
          label="Select all"
          hideLabel
        />
      </div>
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
        <IconButton icon="plus" label="New item" onClick={onNew} disabled={selecting} />
        <IconButton
          id="import-button"
          icon="import"
          label="Import"
          pressed={selectionMode.value === "import"}
          disabled={selectionMode.value === "export"}
          onClick={() => (selectionMode.value === "import" ? exitSelection() : enterSelection("import"))}
        />
        <IconButton
          id="export-button"
          icon="export"
          label="Export"
          pressed={selectionMode.value === "export"}
          disabled={selectionMode.value === "import"}
          onClick={() => (selectionMode.value === "export" ? exitSelection() : enterSelection("export"))}
        />
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
