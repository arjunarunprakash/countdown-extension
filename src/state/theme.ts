import { computed, effect, signal } from "@preact/signals";
import type { PaletteId } from "../lib/palettes";
import type { Theme } from "../lib/storage";
import { prefs, setPrefs } from "./store";

// Outside the "countdown:" prefix that the localStorage fallback treats as app data.
// public/sidepanel/theme-init.js reads them before the first paint.
const CACHE_KEY = "countdown-theme-cache";
const PALETTE_CACHE_KEY = "countdown-palette-cache";

/**
 * "system" follows prefers-color-scheme; "light"/"dark" force a scheme.
 * Tokens use light-dark(), so switching only changes color-scheme on <html>.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/** Indigo is the default token set; other palettes override it via data-palette. */
export function applyPalette(palette: PaletteId) {
  const root = document.documentElement;
  if (palette === "indigo") delete root.dataset.palette;
  else root.dataset.palette = palette;
}

/** The system's current scheme, kept live so "System" can say what it resolves to. */
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
export const systemDark = signal(darkQuery.matches);
darkQuery.addEventListener("change", (e) => (systemDark.value = e.matches));

/**
 * Tells the service worker whether Chrome is in dark mode (the toolbar icon
 * matches it). The worker's hidden page reports this too; the panel is a
 * second source whenever it's open.
 */
function reportToolbarScheme(dark: boolean) {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) return; // Local preview outside the extension.
  chrome.runtime.sendMessage({ type: "toolbar-scheme", dark }).catch(() => {
    // The worker re-reads the stored scheme when it next wakes.
  });
}

export function syncTheme() {
  effect(() => reportToolbarScheme(systemDark.value));
  effect(() => {
    const { theme, palette } = prefs.value;
    applyTheme(theme);
    applyPalette(palette);
    try {
      localStorage.setItem(CACHE_KEY, theme);
      localStorage.setItem(PALETTE_CACHE_KEY, palette);
    } catch {
      // Cache only.
    }
  });
}

type Appearance = { theme?: Theme; palette?: PaletteId };

// A change waits for the cross-fade to capture the old look before it's
// saved. Until then the menu shows the pending choice, so a re-render can't
// flip its radios back, and quick successive changes merge into one.
const pending = signal<Appearance>({});

/** The theme and palette the Appearance menu should show as selected. */
export const shownAppearance = computed(() => ({
  theme: pending.value.theme ?? prefs.value.theme,
  palette: pending.value.palette ?? prefs.value.palette,
}));

/** Changes the appearance, cross-fading the whole panel where supported. */
export function setAppearance(change: Appearance) {
  pending.value = { ...pending.value, ...change };
  const apply = () => {
    const latest = pending.value;
    if (!latest.theme && !latest.palette) return;
    pending.value = {};
    setPrefs(latest);
    if (latest.theme) applyTheme(latest.theme);
    if (latest.palette) applyPalette(latest.palette);
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !reduce) document.startViewTransition(apply);
  else apply();
}

export const THEME_LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };
