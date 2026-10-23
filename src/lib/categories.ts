import type { Row } from "./types";

// Categories group upcoming items into sections. Colors come from a curated
// palette (tokens --cat-<color> in tokens.css) whose light and dark values are
// checked for WCAG AA on the glass surfaces, so any choice stays readable.

export const CATEGORY_COLORS = ["indigo", "violet", "pink", "orange", "amber", "green", "teal", "slate"] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export const COLOR_NAMES: Record<CategoryColor, string> = {
  indigo: "Indigo",
  violet: "Violet",
  pink: "Pink",
  orange: "Orange",
  amber: "Amber",
  green: "Green",
  teal: "Teal",
  slate: "Slate",
};

export interface Category {
  id: string;
  name: string;
  color: CategoryColor;
  collapsed?: boolean;
}

export const MAX_CATEGORY_NAME = 40;

/** The first palette color not yet used (cycling once all are taken). */
export function nextColor(existing: readonly Category[]): CategoryColor {
  const used = new Set(existing.map((c) => c.color));
  return CATEGORY_COLORS.find((c) => !used.has(c)) ?? CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length]!;
}

/** A row's category: the item's, or a stack's (all its occurrences share one). */
export const rowCategoryId = (row: Row) => (row.kind === "single" ? row.item.categoryId : row.items[0]?.categoryId);

export interface CategoryGroup {
  /** null: items without a (known) category. */
  category: Category | null;
  rows: Row[];
}

/**
 * Splits upcoming rows into sections: every category in the user's order
 * (empty ones included, so they can receive items), then items without a
 * category. Row order within a section is kept (soonest first).
 */
export function groupRows(rows: readonly Row[], categories: readonly Category[]): CategoryGroup[] {
  const known = new Set(categories.map((c) => c.id));
  const byId = new Map<string, Row[]>(categories.map((c) => [c.id, []]));
  const none: Row[] = [];
  for (const row of rows) {
    const id = rowCategoryId(row);
    if (id && known.has(id)) byId.get(id)!.push(row);
    else none.push(row);
  }
  return [...categories.map((c) => ({ category: c, rows: byId.get(c.id)! })), { category: null, rows: none }];
}

/** Moves the element at `from` to index `to` (both within bounds). */
export function moveIndex<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved!);
  return next;
}
