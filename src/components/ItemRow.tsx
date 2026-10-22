import { useLayoutEffect, useRef } from "preact/hooks";
import { formatItemDate } from "../lib/dates";
import type { Item, Row, Unit } from "../lib/types";
import { describeEnd, describeRule } from "../lib/recurrence";
import { series } from "../state/store";
import { completing, editing } from "../state/ui";
import { CountdownBox } from "./CountdownBox";
import { Icon } from "./Icon";
import { EditorRow } from "./ItemEditor";
import { ItemTile } from "./ItemTile";
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

/** "Weekly on Monday · until 31 December", or null if the item doesn't repeat. */
function repeatLabel(seriesId: string | undefined): string | null {
  const s = seriesId ? series.value.find((x) => x.id === seriesId) : undefined;
  if (!s) return null;
  const end = describeEnd(s.end);
  return `${describeRule(s.rule, new Date(s.start))}${end ? ` · ${end}` : ""}`;
}

function SingleRow({ item, unit, now, past }: { item: Item; unit: Unit; now: number; past: boolean }) {
  const isCompleting = completing.value.has(item.id);
  const ref = useCollapse(isCompleting);
  return (
    <li ref={ref} class={`row grid-row${isCompleting ? " row--completing" : ""}`}>
      <CountdownBox item={item} unit={unit} now={now} completing={isCompleting} />
      <ItemTile
        item={item}
        past={past}
        meta={!past && repeatLabel(item.seriesId) && <RepeatMeta text={repeatLabel(item.seriesId)!} />}
        onOpen={() => (editing.value = { kind: "item", id: item.id })}
      />
    </li>
  );
}

function StackRow({ seriesId, items, unit, now }: { seriesId: string; items: Item[]; unit: Unit; now: number }) {
  const head = items[0]!;
  const more = items.length - 1;
  const layers = Math.min(more, 2);
  const isCompleting = completing.value.has(head.id);
  const date = formatItemDate(new Date(head.dateTime), head.allDay);
  return (
    <li class="row row--stack grid-row" style={{ "--stack-layers": layers }}>
      <CountdownBox item={head} unit={unit} now={now} completing={isCompleting} />
      <div class="stack">
        <ItemTile
          item={head}
          label={`${head.title}, ${repeatLabel(seriesId) ?? "repeating"}. Next ${head.type === "due" ? "due" : "starts"} ${date}. Open series`}
          onOpen={() => (editing.value = { kind: "series", seriesId })}
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
