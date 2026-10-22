import { useEffect, useRef } from "preact/hooks";
import { place, type Align } from "../lib/position";

const HOVER_DELAY = 400;

/**
 * One shared tooltip for every element with data-tooltip="…", rendered in
 * the top layer so it is never hidden behind tiles. Shown after a short
 * hover delay, or immediately on keyboard focus; hidden on leave, blur,
 * scroll, click or Escape. Optional data-tooltip-align="start|end".
 *
 * The tooltip is visual only (aria-hidden): every anchor already carries
 * the same text as its accessible name.
 */
export function TooltipLayer() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tip = ref.current!;
    let anchor: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Countdown tooltips change every tick; follow the attribute.
    const watcher = new MutationObserver(() => {
      if (anchor) render(anchor);
    });

    const render = (el: HTMLElement) => {
      const text = el.dataset.tooltip;
      if (!text || !el.isConnected) return hide();
      tip.textContent = text;
      const a = el.getBoundingClientRect();
      const r = tip.getBoundingClientRect();
      const p = place(a, r, { width: innerWidth, height: innerHeight }, {
        align: (el.dataset.tooltipAlign as Align | undefined) ?? "center",
        offset: 6,
      });
      tip.style.top = `${p.top}px`;
      tip.style.left = `${p.left}px`;
    };

    const show = (el: HTMLElement, delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        anchor = el;
        if (!tip.matches(":popover-open")) tip.showPopover();
        render(el);
        watcher.disconnect();
        watcher.observe(el, { attributes: true, attributeFilter: ["data-tooltip"] });
      }, delay);
    };

    const hide = () => {
      clearTimeout(timer);
      watcher.disconnect();
      anchor = null;
      if (tip.matches(":popover-open")) tip.hidePopover();
    };

    const anchorOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-tooltip]") : null;

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = anchorOf(e.target);
      if (el && el !== anchor) show(el, HOVER_DELAY);
    };
    const onOut = (e: PointerEvent) => {
      const from = anchorOf(e.target);
      if (from && !from.contains(e.relatedTarget as Node | null)) hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = anchorOf(e.target);
      if (el && el.matches(":focus-visible")) show(el, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && anchor) hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", onKey, true);
    addEventListener("scroll", hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", onKey, true);
      removeEventListener("scroll", hide, true);
    };
  }, []);

  return <div ref={ref} popover="manual" class="tooltip" aria-hidden="true" />;
}
