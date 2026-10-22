import { useEffect, useMemo, useRef } from "preact/hooks";
import { ExportSheet } from "../components/ExportSheet";
import { Header } from "../components/Header";
import { EditorRow } from "../components/ItemEditor";
import { ItemRow } from "../components/ItemRow";
import { EmptyState } from "../components/EmptyState";
import { CompletedSection, OverdueSection } from "../components/Sections";
import { Toast } from "../components/Toast";
import { TooltipLayer } from "../components/TooltipLayer";
import { newItem } from "../lib/items";
import { buildRows } from "../lib/rows";
import type { Row } from "../lib/types";
import { now } from "../state/clock";
import { items, prefs, ready } from "../state/store";
import { usePresence } from "../hooks/usePresence";
import { exitSelection, selectableKeys, selected, selectionEntries, selectionMode } from "../state/selection";
import { editing, openImport } from "../state/ui";

const rowKey = (row: Row) => (row.kind === "single" ? row.item.id : row.seriesId);

function startNew() {
  if (editing.value?.kind === "new") {
    document.querySelector<HTMLInputElement>(".row--editing .editor__title")?.focus();
    return;
  }
  editing.value = { kind: "new", draft: newItem(new Date()) };
}

/** Sheet slide-down duration; matches --duration-slow. */
const SHEET_EXIT_MS = 240;

export function App() {
  const t = now.value;
  const list = items.value;
  const sections = useMemo(() => buildRows(list, t), [list, t]);
  const { upcoming, overdue, completed } = sections;
  const mode = selectionMode.value;
  const sheet = usePresence(mode === "export", SHEET_EXIT_MS);
  const selectable = useMemo(() => selectableKeys(sections), [sections]);
  const entries = useMemo(() => selectionEntries(sections, selected.value), [sections, selected.value]);
  useSelectionFocus(mode);

  // Escape leaves selection mode (popovers and editors handle their own Escape first).
  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) exitSelection();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode]);

  if (!ready.value) return null;

  const unit = prefs.value.unit;
  const e = editing.value;
  const nothingUpcoming = upcoming.length === 0 && e?.kind !== "new";
  const nothingAtAll = nothingUpcoming && overdue.length === 0 && completed.length === 0;

  return (
    <div class={`app${mode ? " app--selecting" : ""}${sheet.mounted ? " app--sheet" : ""}`}>
      <Header unit={unit} onNew={startNew} selectable={selectable} />
      <main class="list">
        {nothingUpcoming && (
          <EmptyState variant={nothingAtAll ? "first" : "clear"} onNew={startNew} onImport={openImport} />
        )}
        <ul role="list" class="list list--flush" aria-label="Upcoming">
          {e?.kind === "new" && <EditorRow key={e.draft.id} item={e.draft} isNew unit={unit} now={t} />}
          {upcoming.map((row) => (
            <ItemRow key={rowKey(row)} row={row} unit={unit} now={t} />
          ))}
        </ul>
        <OverdueSection items={overdue} unit={unit} now={t} />
        <CompletedSection items={completed} now={t} />
      </main>
      {sheet.mounted && <ExportSheet entries={entries} state={sheet.state} />}
      <Toast />
      <TooltipLayer />
    </div>
  );
}

/** Moves focus into selection mode (Select all) and back to Export when it ends. */
function useSelectionFocus(mode: string | null) {
  const previous = useRef(mode);
  useEffect(() => {
    const was = previous.current;
    previous.current = mode;
    if (mode && !was) {
      setTimeout(() => document.querySelector<HTMLInputElement>(".header .select-cell input")?.focus());
    } else if (!mode && was) {
      setTimeout(() => document.getElementById("export-button")?.focus());
    }
  }, [mode]);
}
