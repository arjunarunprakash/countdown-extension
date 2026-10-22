import type { Row, Unit } from "../lib/types";
import { CountdownBox } from "./CountdownBox";
import { Icon } from "./Icon";
import { ItemTile } from "./ItemTile";

interface Props {
  row: Row;
  unit: Unit;
  now: number;
}

export function ItemRow({ row, unit, now }: Props) {
  if (row.kind === "single") {
    return (
      <li class="row grid-row">
        <CountdownBox item={row.item} unit={unit} now={now} />
        <ItemTile item={row.item} />
      </li>
    );
  }

  const head = row.items[0]!;
  const more = row.items.length - 1;
  const layers = Math.min(more, 2);
  return (
    <li class="row row--stack grid-row" style={{ "--stack-layers": layers }}>
      <CountdownBox item={head} unit={unit} now={now} />
      <div class="stack">
        <ItemTile
          item={head}
          meta={
            <span class="stack__count">
              <Icon name="repeat" />
              Repeats · {more} more
            </span>
          }
        />
        {layers >= 1 && <div class="stack__layer stack__layer--1" aria-hidden="true" />}
        {layers >= 2 && <div class="stack__layer stack__layer--2" aria-hidden="true" />}
      </div>
    </li>
  );
}
