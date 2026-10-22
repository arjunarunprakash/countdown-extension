import { effect } from "@preact/signals";
import type { Theme } from "../lib/storage";
import { prefs, setPrefs } from "./store";

// Outside the "countdown:" prefix that the localStorage fallback treats as app data.
const CACHE_KEY = "countdown-theme-cache";
const ORDER: Theme[] = ["system", "light", "dark"];

/**
 * "system" follows prefers-color-scheme; "light"/"dark" force a scheme.
 * Tokens use light-dark(), so switching only changes color-scheme on <html>.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/**
 * Applies the last-used theme synchronously before storage loads, so a forced
 * theme doesn't flash the system one on open. localStorage is only a cache;
 * chrome.storage prefs remain the source of truth.
 */
export function applyCachedTheme() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached === "light" || cached === "dark") applyTheme(cached);
  } catch {
    // Storage can be unavailable; the stored pref is applied a moment later.
  }
}

export function syncTheme() {
  effect(() => {
    const theme = prefs.value.theme;
    applyTheme(theme);
    try {
      localStorage.setItem(CACHE_KEY, theme);
    } catch {
      // Cache only.
    }
  });
}

export function cycleTheme() {
  const next = ORDER[(ORDER.indexOf(prefs.value.theme) + 1) % ORDER.length]!;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Cross-fade the whole panel between themes where supported.
  if (document.startViewTransition && !reduce) {
    document.startViewTransition(() => {
      setPrefs({ theme: next });
      applyTheme(next);
    });
  } else {
    setPrefs({ theme: next });
  }
}

export const THEME_LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };
