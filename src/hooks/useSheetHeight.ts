import type { RefObject } from "preact";
import { useLayoutEffect } from "preact/hooks";

/**
 * Publishes a bottom sheet's height as --sheet-h on .app, so the list can
 * leave room under its last rows and the toast can sit above the sheet.
 */
export function useSheetHeight(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    const app = el?.closest<HTMLElement>(".app");
    if (!el || !app) return;
    const measure = () => app.style.setProperty("--sheet-h", `${el.offsetHeight}px`);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      app.style.removeProperty("--sheet-h");
    };
  }, []);
}
