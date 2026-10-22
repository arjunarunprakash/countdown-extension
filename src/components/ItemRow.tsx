import { useLayoutEffect, useRef } from "preact/hooks";
import type { Item, Row, Unit } from "../lib/types";
import { describeEnd, describeRule } from "../lib/recurrence";
import { draftIndex } from "../state/importer";
import { isSelecting, selected, selectionMode, seriesKey, toggleSelected } from "../state/selection";
import { series } from "../state/store";
import { completing, editing } from "../state/ui";
import { CountdownBox } from "./CountdownBox";
import { Icon } from "./Icon";
import { EditorRow } from "./ItemEditor";
import { ItemTile } from "./ItemTile";
import { SelectCell } from "./SelectCell";
import { StackEditorRow } from "./StackEditor";

interface Props {
  row: Row;
  unit: Unit;
  now: number;
  past?: boolean;
}

export function ItemRow({ row, unit, now, past = false }: Props) {
  const e = editing.value;
  if (row.kind === "single") {
    if (e?.kind === "item" && e.id === row.item.id) {
      return <EditorRow item={row.item} isNew={false} unit={unit} now={now} />;
    }
    return <SingleRow item={row.item} unit={unit} now={now} past={past} />;
  }
  // One occurrence of a stack opened on its own (from the stack's Edit button).
  const single = e?.kind === "item" ? row.items.find((i) => i.id === e.id) : undefined;
  if (single) return <EditorRow item={single} isNew={false} unit={unit} now={now} />;
  if (e?.kind === "series" && e.seriesId === row.seriesId) {
    return <StackEditorRow seriesId={row.seriesId} items={row.items} unit={unit} now={now} />;
  }
  return <StackRow seriesId={row.seriesId} items={row.items} unit={unit} now={now} />;
}

/** Locks the row's current height into a CSS variable so it can animate closed. */
function useCollapse(active: boolean) {
  const ref = useRef<HTMLLIElement>(null);
  useLayoutEffect(() => {
    if (active && ref.current) ref.current.style.setProperty("--row-h", `${ref.current.offsetHeight}px`);
  }, [active]);
  return ref;
}

/**
 * How a row behaves in selection mode. In Export, existing rows are
 * selectable; in Import, only previewed candidates are (duplicates shown but
 * disabled), and they carry an "Import" / "Already added" badge.
 */
function selectionFor(key: string, candidateId: string, isCandidate: boolean) {
  const mode = selectionMode.value;
  const duplicate = isCandidate && draftIndex.value.duplicates.has(candidateId);
  const selectable = mode === "export" ? !isCandidate : mode === "import" ? isCandidate : false;
  return {
    selKey: selectable ? key : undefined,
    duplicate,
    badge: isCandidate
      ? duplicate
        ? ({ text: "Already added", tone: "muted" } as const)
        : ({ text: "Import", tone: "accent" } as const)
      : undefined,
    rowClass: isCandidate ? (duplicate ? " row--candidate row--duplicate" : " row--candidate") : "",
    toggle: () => {
      if (selectable && !duplicate) toggleSelected(key);
    },
  };
}

/** "Weekly on Monday · until 31 December", or null if the item doesn't repeat. */
function repeatLabel(seriesId: string | undefined): string | null {
  // Saved series, or one still being previewed for import.
  const s = seriesId ? (series.value.find((x) => x.id === seriesId) ?? draftIndex.value.seriesById.get(seriesId)) : undefined;
  if (!s) return null;
  const end = describeEnd(s.end);
  return `${describeRule(s.rule, new Date(s.start))}${end ? ` · ${end}` : ""}`;
}

function SingleRow({ item, unit, now, past }: { item: Item; unit: Unit; now: number; past: boolean }) {
  const isCompleting = completing.value.has(item.id);
  const ref = useCollapse(isCompleting);
  const sel = selectionFor(item.id, item.id, draftIndex.value.itemIds.has(item.id));
  return (
    <li ref={ref} class={`row grid-row${isCompleting ? " row--completing" : ""}${sel.rowClass}`}>
      <SelectCell selKey={sel.selKey} label={item.title} disabled={sel.duplicate} />
      <CountdownBox item={item} unit={unit} now={now} completing={isCompleting} />
      <ItemTile
        item={item}
        past={past}
        meta={!past && repeatLabel(item.seriesId) && <RepeatMeta text={repeatLabel(item.seriesId)!} />}
        selecting={isSelecting.value}
        selected={sel.selKey !== undefined && !sel.duplicate && selected.value.has(item.id)}
        badge={sel.badge}
        onOpen={() => (isSelecting.value ? sel.toggle() : (editing.value = { kind: "item", id: item.id }))}
      />
    </li>
  );
}

function StackRow({ seriesId, items, unit, now }: { seriesId: string; items: Item[]; unit: Unit; now: number }) {
  const head = items[0]!;
  const more = items.length - 1;
  const layers = Math.min(more, 2);
  const isCompleting = completing.value.has(head.id);
  const key = seriesKey(seriesId);
  const sel = selectionFor(key, seriesId, draftIndex.value.seriesIds.has(seriesId));
  return (
    <li class={`row row--stack grid-row${sel.rowClass}`} style={{ "--stack-layers": layers }}>
      <SelectCell selKey={sel.selKey} label={`${head.title} (all occurrences)`} disabled={sel.duplicate} />
      <CountdownBox item={head} unit={unit} now={now} completing={isCompleting} />
      <div class="stack">
        <ItemTile
          item={head}
          selecting={isSelecting.value}
          selected={sel.selKey !== undefined && !sel.duplicate && selected.value.has(key)}
          badge={sel.badge}
          onOpen={() => (isSelecting.value ? sel.toggle() : (editing.value = { kind: "series", seriesId }))}
          meta={<RepeatMeta text={repeatLabel(seriesId) ?? `Repeats · ${more} more`} />}
        />
        {layers >= 1 && <div class="stack__layer stack__layer--1" aria-hidden="true" />}
        {layers >= 2 && <div class="stack__layer stack__layer--2" aria-hidden="true" />}
      </div>
    </li>
  );
}

function RepeatMeta({ text }: { text: string }) {
  return (
    <span class="stack__count">
      <Icon name="repeat" />
      {text}
    </span>
  );
}
