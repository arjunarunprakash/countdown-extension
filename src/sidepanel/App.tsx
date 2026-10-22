import { useMemo } from "preact/hooks";
import { Header } from "../components/Header";
import { ItemRow } from "../components/ItemRow";
import { PastSection } from "../components/PastSection";
import { buildRows } from "../lib/rows";
import { sampleItems } from "../lib/sample";
import type { Row, Unit } from "../lib/types";

const rowKey = (row: Row) => (row.kind === "single" ? row.item.id : row.seriesId);

// Phase 1: static view over sample data. Storage, editing and live
// countdowns arrive in Phases 2–3.
export function App() {
  const now = Date.now();
  const unit: Unit = "days";
  const { upcoming, past } = useMemo(() => buildRows(sampleItems(new Date(now)), now), []);

  return (
    <div class="app">
      <Header unit={unit} />
      <main class="list">
        <ul role="list" class="list list--flush" aria-label="Upcoming">
          {upcoming.map((row) => (
            <ItemRow key={rowKey(row)} row={row} unit={unit} now={now} />
          ))}
        </ul>
        <PastSection items={past} unit={unit} now={now} />
      </main>
    </div>
  );
}
