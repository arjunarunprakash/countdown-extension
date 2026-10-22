import { effect, signal } from "@preact/signals";
import type { Unit } from "../lib/types";
import { prefs } from "./store";

/** Current time. Ticks every second in Seconds mode, otherwise on each minute boundary. */
export const now = signal(Date.now());

/**
 * Milliseconds until the next tick: the next whole second (Seconds mode) or
 * whole minute (other units). Ticks land just after the boundary so values
 * derived with Math.floor have already rolled over.
 */
export function msUntilNextTick(t: number, unit: Unit): number {
  const step = unit === "seconds" ? 1_000 : 60_000;
  return step - (t % step) + 5;
}

let timer: ReturnType<typeof setTimeout> | undefined;

function schedule(unit: Unit) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    now.value = Date.now();
    schedule(unit);
  }, msUntilNextTick(Date.now(), unit));
}

export function startClock() {
  // Re-time the ticks whenever the unit changes, and refresh immediately.
  effect(() => {
    const unit = prefs.value.unit;
    now.value = Date.now();
    schedule(unit);
  });
  // Timers are throttled in background tabs; catch up when the panel is visible again.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) now.value = Date.now();
  });
}
