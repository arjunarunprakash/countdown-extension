import { signal } from "@preact/signals";

/** Current time, refreshed on each minute boundary. Phase 3 adds per-second ticks. */
export const now = signal(Date.now());

export function startClock() {
  const tick = () => {
    now.value = Date.now();
    setTimeout(tick, 60_000 - (Date.now() % 60_000) + 5);
  };
  setTimeout(tick, 60_000 - (Date.now() % 60_000) + 5);
  // Catch up immediately after the panel was hidden or the machine slept.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) now.value = Date.now();
  });
}
