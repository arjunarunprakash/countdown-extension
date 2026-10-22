import type { Item, Row } from "./types";

const time = (item: Item) => Date.parse(item.dateTime);

/**
 * Splits items into upcoming rows (soonest first, recurring series collapsed
 * into stacks) and past items (most recent first). Completed items are excluded.
 */
export function buildRows(items: readonly Item[], now: number): { upcoming: Row[]; past: Item[] } {
  const upcomingSingles: Item[] = [];
  const series = new Map<string, Item[]>();
  const past: Item[] = [];

  for (const item of items) {
    if (item.completedAt) continue;
    if (time(item) <= now) {
      past.push(item);
    } else if (item.seriesId) {
      const group = series.get(item.seriesId) ?? [];
      group.push(item);
      series.set(item.seriesId, group);
    } else {
      upcomingSingles.push(item);
    }
  }

  const rows: Row[] = upcomingSingles.map((item) => ({ kind: "single", item }));
  for (const [seriesId, group] of series) {
    group.sort((a, b) => time(a) - time(b));
    // A series with one occurrence left is just a tile.
    rows.push(group.length === 1 ? { kind: "single", item: group[0]! } : { kind: "stack", seriesId, items: group });
  }

  const head = (row: Row) => (row.kind === "single" ? row.item : row.items[0]!);
  rows.sort((a, b) => time(head(a)) - time(head(b)) || head(a).title.localeCompare(head(b).title));
  past.sort((a, b) => time(b) - time(a));

  return { upcoming: rows, past };
}
