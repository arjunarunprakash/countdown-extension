import { useEffect, useState } from "preact/hooks";
import { prefersReducedMotion } from "../state/ui";

/**
 * Keeps an element mounted for `ms` after `open` turns false so it can play
 * an exit animation. `state` is "open" while shown and "closing" while leaving.
 */
export function usePresence(open: boolean, ms: number): { mounted: boolean; state: "open" | "closing" } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : ms);
    return () => clearTimeout(timer);
  }, [open]);
  return { mounted: open || mounted, state: open ? "open" : "closing" };
}
