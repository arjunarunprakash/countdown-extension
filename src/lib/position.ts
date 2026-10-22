// Positions a floating element (popover, tooltip) next to an anchor, in
// viewport coordinates for position: fixed. Pure, so it is unit-tested.

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type Align = "start" | "center" | "end";

export interface PlaceOptions {
  /** Horizontal alignment relative to the anchor. */
  align?: Align;
  /** Gap between anchor and floating element. */
  offset?: number;
  /** Minimum distance kept from the viewport edges. */
  padding?: number;
}

export interface Placement {
  top: number;
  left: number;
  side: "bottom" | "top";
  /** Set when the element doesn't fit on either side: cap its height and scroll. */
  maxHeight?: number;
}

/**
 * Prefers below the anchor; flips above when there isn't room below but there
 * is above; otherwise uses the roomier side with a max height. Horizontally,
 * aligns as requested and then clamps inside the viewport.
 */
export function place(
  anchor: Rect,
  floating: { width: number; height: number },
  viewport: { width: number; height: number },
  { align = "start", offset = 4, padding = 8 }: PlaceOptions = {},
): Placement {
  const below = viewport.height - (anchor.top + anchor.height) - offset - padding;
  const above = anchor.top - offset - padding;

  let side: Placement["side"] = "bottom";
  let maxHeight: number | undefined;
  if (floating.height > below) {
    if (floating.height <= above) side = "top";
    else {
      side = above > below ? "top" : "bottom";
      maxHeight = Math.max(0, Math.floor(side === "top" ? above : below));
    }
  }
  const height = maxHeight ?? floating.height;
  const top = side === "bottom" ? anchor.top + anchor.height + offset : anchor.top - offset - height;

  let left =
    align === "start"
      ? anchor.left
      : align === "end"
        ? anchor.left + anchor.width - floating.width
        : anchor.left + (anchor.width - floating.width) / 2;
  const maxLeft = viewport.width - padding - floating.width;
  left = Math.max(padding, Math.min(left, maxLeft));

  return { top: Math.round(top), left: Math.round(left), side, ...(maxHeight !== undefined ? { maxHeight } : {}) };
}
