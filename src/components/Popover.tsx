import type { ComponentChildren, HTMLAttributes, RefObject } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { place, type Align } from "../lib/position";

type Props = Omit<HTMLAttributes<HTMLDivElement>, "ref"> & {
  /** Element the popover is positioned against. */
  anchor: RefObject<HTMLElement | null>;
  align?: Align;
  /** Make the popover at least as wide as its anchor (e.g. a listbox). */
  matchWidth?: boolean;
  /** Optional ref to the popover element itself. */
  popoverRef?: RefObject<HTMLDivElement | null>;
  children: ComponentChildren;
};

/**
 * Floating panel rendered in the browser's top layer (HTML Popover API), so
 * it always paints above tiles, the header and any stacking context created
 * by glass effects. It stays in its parent in the DOM, so focus order and
 * click-outside checks (element.contains) work as before.
 *
 * Rendered only while open; positioned with position: fixed next to the
 * anchor, flipping above it when there's no room below.
 */
export function Popover({ anchor, align = "start", matchWidth = false, popoverRef, children, class: className, ...rest }: Props) {
  const own = useRef<HTMLDivElement>(null);
  const ref = popoverRef ?? own;

  useLayoutEffect(() => {
    const el = ref.current;
    const target = anchor.current;
    if (!el || !target) return;

    if (!el.matches(":popover-open")) el.showPopover();

    const update = () => {
      if (!target.isConnected) return;
      const a = target.getBoundingClientRect();
      if (matchWidth) el.style.minWidth = `${Math.round(a.width)}px`;
      el.style.maxHeight = "";
      const r = el.getBoundingClientRect();
      const p = place(a, { width: r.width, height: r.height }, { width: innerWidth, height: innerHeight }, { align });
      el.style.top = `${p.top}px`;
      el.style.left = `${p.left}px`;
      if (p.maxHeight !== undefined) el.style.maxHeight = `${p.maxHeight}px`;
      el.dataset.side = p.side;
    };

    update();
    // Follow the anchor as the list scrolls or the panel resizes.
    addEventListener("scroll", update, true);
    addEventListener("resize", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(target);
    return () => {
      removeEventListener("scroll", update, true);
      removeEventListener("resize", update);
      ro.disconnect();
      if (el.matches(":popover-open")) el.hidePopover();
    };
  }, []);

  return (
    <div ref={ref} popover="manual" class={`popover${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </div>
  );
}
