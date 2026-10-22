import { useMemo } from "preact/hooks";
import { Header } from "../components/Header";
import { EditorRow } from "../components/ItemEditor";
import { ItemRow } from "../components/ItemRow";
import { PastSection } from "../components/PastSection";
import { Toast } from "../components/Toast";
import { newItem } from "../lib/items";
import { buildRows } from "../lib/rows";
import type { Row } from "../lib/types";
import { now } from "../state/clock";
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

export function App() {
  const t = now.value;
  const list = items.value;
  const { upcoming, past } = useMemo(() => buildRows(list, t), [list, t]);
  if (!ready.value) return null;

  const unit = prefs.value.unit;
  const e = editing.value;
  const isEmpty = upcoming.length === 0 && past.length === 0 && e?.kind !== "new";

  return (
    <div class="app">
      <Header unit={unit} onNew={startNew} />
      <main class="list">
        {/* Placeholder until Phase 3's empty state. */}
        {isEmpty && <p class="empty-hint">No deadlines yet. Select + to add one.</p>}
        <ul role="list" class="list list--flush" aria-label="Upcoming">
          {e?.kind === "new" && <EditorRow key={e.draft.id} item={e.draft} isNew unit={unit} now={t} />}
          {upcoming.map((row) => (
            <ItemRow key={rowKey(row)} row={row} unit={unit} now={t} />
          ))}
        </ul>
        <PastSection items={past} unit={unit} now={t} />
      </main>
      <Toast />
    </div>
  );
}
