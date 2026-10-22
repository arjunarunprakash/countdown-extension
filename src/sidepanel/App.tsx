import { useMemo } from "preact/hooks";
import { Header } from "../components/Header";
import { EditorRow } from "../components/ItemEditor";
import { ItemRow } from "../components/ItemRow";
import { EmptyState } from "../components/EmptyState";
import { CompletedSection, OverdueSection } from "../components/Sections";
import { Toast } from "../components/Toast";
import { newItem } from "../lib/items";
import { buildRows } from "../lib/rows";
import type { Row } from "../lib/types";
import { now } from "../state/clock";
import { items, prefs, ready } from "../state/store";
import { editing, openImport } from "../state/ui";

const rowKey = (row: Row) => (row.kind === "single" ? row.item.id : row.seriesId);

function startNew() {
  if (editing.value?.kind === "new") {
    document.querySelector<HTMLInputElement>(".row--editing .editor__title")?.focus();
    return;
  }
  editing.value = { kind: "new", draft: newItem(new Date()) };
}

export function App() {
  const t = now.value;
  const list = items.value;
  const { upcoming, overdue, completed } = useMemo(() => buildRows(list, t), [list, t]);
  if (!ready.value) return null;

  const unit = prefs.value.unit;
  const e = editing.value;
  const nothingUpcoming = upcoming.length === 0 && e?.kind !== "new";
  const nothingAtAll = nothingUpcoming && overdue.length === 0 && completed.length === 0;

  return (
    <div class="app">
      <Header unit={unit} onNew={startNew} />
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
      <Toast />
    </div>
  );
}
