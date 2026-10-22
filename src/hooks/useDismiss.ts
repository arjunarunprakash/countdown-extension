import type { RefObject } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

export type DismissReason = "escape" | "outside";

/**
 * Calls onDismiss when Escape is pressed inside the element, or when a
 * pointer goes down outside it. Nested popovers stop Escape propagation
 * so only the innermost layer closes.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  onDismiss: (reason: DismissReason) => void,
  active = true,
) {
  const callback = useRef(onDismiss);
  callback.current = onDismiss;

  useLayoutEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      callback.current("escape");
    };
    const onPointer = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) callback.current("outside");
    };

    el.addEventListener("keydown", onKey);
    // Capture phase so we commit before whatever was clicked reacts.
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      el.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [active, ref]);
}
