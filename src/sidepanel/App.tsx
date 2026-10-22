import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { EmptyState } from "../components/EmptyState";
import { ExportSheet } from "../components/ExportSheet";
import { Header } from "../components/Header";
import { ImportSheet } from "../components/ImportSheet";
import { EditorRow } from "../components/ItemEditor";
import { ItemRow } from "../components/ItemRow";
import { CompletedSection, OverdueSection } from "../components/Sections";
import { Toast } from "../components/Toast";
import { TooltipLayer } from "../components/TooltipLayer";
import { usePresence } from "../hooks/usePresence";
import { newItem } from "../lib/items";
import { buildRows } from "../lib/rows";
import type { Row } from "../lib/types";
import { now } from "../state/clock";
import { draftIndex, importFile, selectableImportKeys } from "../state/importer";
import {
  enterSelection,
  exitSelection,
  selectableKeys,
  selected,
  selectionEntries,
  selectionMode,
  type SelectionMode,
} from "../state/selection";
import { items, prefs, ready } from "../state/store";
import { editing } from "../state/ui";

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
  const mode = selectionMode.value;
  // While previewing an import, candidates are shown in the list alongside existing items.
  const draftItems = draftIndex.value.items;
  const list = useMemo(() => (draftItems.length ? [...items.value, ...draftItems] : items.value), [items.value, draftItems]);
  const sections = useMemo(() => buildRows(list, t), [list, t]);
  const { upcoming, overdue, completed } = sections;

  // Keep the last mode while the sheet animates out.
  const sheet = usePresence(mode !== null, SHEET_EXIT_MS);
  const lastMode = useRef<SelectionMode>("export");
  if (mode) lastMode.current = mode;

  const selectable = useMemo(
    () => (mode === "import" ? selectableImportKeys.value : selectableKeys(sections)),
    [mode, sections, selectableImportKeys.value],
  );
  const entries = useMemo(() => selectionEntries(sections, selected.value), [sections, selected.value]);
  const dragging = useFileDrop();
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
        {nothingUpcoming && mode !== "import" && (
          <EmptyState variant={nothingAtAll ? "first" : "clear"} onNew={startNew} onImport={() => enterSelection("import")} />
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
      {sheet.mounted &&
        (lastMode.current === "import" ? (
          <ImportSheet state={sheet.state} dragging={dragging} />
        ) : (
          <ExportSheet entries={entries} state={sheet.state} />
        ))}
      <Toast />
      <TooltipLayer />
    </div>
  );
}

/** Moves focus into selection mode and back to the button that opened it. */
function useSelectionFocus(mode: SelectionMode | null) {
  const previous = useRef(mode);
  useEffect(() => {
    const was = previous.current;
    previous.current = mode;
    if (mode && !was) {
      const target = mode === "import" ? ".sheet .dropzone__browse" : ".header .select-cell input";
      setTimeout(() => document.querySelector<HTMLElement>(target)?.focus());
    } else if (!mode && was) {
      setTimeout(() => document.getElementById(`${was}-button`)?.focus());
    }
  }, [mode]);
}

/**
 * Accepts calendar files dropped anywhere on the panel (opening Import if
 * needed) and stops the browser from navigating to a dropped file.
 * Returns true while a file is being dragged over the panel.
 */
function useFileDrop(): boolean {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      if (selectionMode.value !== "import") enterSelection("import");
      void importFile(file);
    };
    addEventListener("dragenter", onEnter);
    addEventListener("dragleave", onLeave);
    addEventListener("dragover", onOver);
    addEventListener("drop", onDrop);
    return () => {
      removeEventListener("dragenter", onEnter);
      removeEventListener("dragleave", onLeave);
      removeEventListener("dragover", onOver);
      removeEventListener("drop", onDrop);
    };
  }, []);
  return dragging;
}
