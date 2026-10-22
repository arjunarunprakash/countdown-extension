import { toLocalISO } from "./dates";
import type { DateParts, TimeParts } from "./parse";
import type { CompletionRecord, Item, ItemType } from "./types";

// Pure operations on the item list. The store (src/state) wraps these with
// persistence and undo; keeping them pure makes them straightforward to test.

export interface ItemFields {
  title: string;
  type: ItemType;
  date: DateParts;
  /** null means all-day. */
  time: TimeParts | null;
  notes: string;
}

export function newItem(now: Date, id: string = crypto.randomUUID()): Item {
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
  const stamp = toLocalISO(now);
  return {
    id,
    title: "",
    type: "due",
    dateTime: toLocalISO(tomorrow),
    createdAt: stamp,
    updatedAt: stamp,
    source: "manual",
  };
}

export function fieldsOf(item: Item): ItemFields {
  const d = new Date(item.dateTime);
  return {
    title: item.title,
    type: item.type,
    date: { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() },
    time: item.allDay ? null : { hour: d.getHours(), minute: d.getMinutes() },
    notes: item.notes ?? "",
  };
}

export function withFields(item: Item, fields: ItemFields, now: Date): Item {
  const { date, time } = fields;
  const when = new Date(date.year, date.month, date.day, time?.hour ?? 0, time?.minute ?? 0);
  const next: Item = {
    ...item,
    title: fields.title.trim(),
    type: fields.type,
    dateTime: toLocalISO(when),
    updatedAt: toLocalISO(now),
  };
  if (time) delete next.allDay;
  else next.allDay = true;
  const notes = fields.notes.trim();
  if (notes) next.notes = notes;
  else delete next.notes;
  return next;
}

/** True when saving would change anything the user can see. */
export function differs(a: Item, b: Item): boolean {
  return (
    a.title !== b.title ||
    a.type !== b.type ||
    // Same instant written with a different UTC offset is not a change.
    Date.parse(a.dateTime) !== Date.parse(b.dateTime) ||
    Boolean(a.allDay) !== Boolean(b.allDay) ||
    (a.notes ?? "") !== (b.notes ?? "")
  );
}

export interface Removed {
  item: Item;
  index: number;
}

export function removeIds(items: readonly Item[], ids: ReadonlySet<string>): { next: Item[]; removed: Removed[] } {
  const next: Item[] = [];
  const removed: Removed[] = [];
  items.forEach((item, index) => (ids.has(item.id) ? removed.push({ item, index }) : next.push(item)));
  return { next, removed };
}

/** Puts removed items back at their original positions. */
export function restore(items: readonly Item[], removed: readonly Removed[]): Item[] {
  const next = [...items];
  const present = new Set(items.map((i) => i.id));
  for (const { item, index } of [...removed].sort((a, b) => a.index - b.index)) {
    if (!present.has(item.id)) next.splice(Math.min(index, next.length), 0, item);
  }
  return next;
}

export function complete(
  items: readonly Item[],
  id: string,
  now: Date,
): { next: Item[]; record: CompletionRecord } | null {
  const item = items.find((i) => i.id === id);
  if (!item || item.completedAt) return null;
  const at = toLocalISO(now);
  const record: CompletionRecord = {
    id: crypto.randomUUID(),
    itemId: item.id,
    title: item.title,
    type: item.type,
    dateTime: item.dateTime,
    completedAt: at,
  };
  return { next: items.map((i) => (i.id === id ? { ...i, completedAt: at } : i)), record };
}

export function uncomplete(items: readonly Item[], id: string): Item[] {
  return items.map((i) => {
    if (i.id !== id) return i;
    const { completedAt: _, ...rest } = i;
    return rest;
  });
}
