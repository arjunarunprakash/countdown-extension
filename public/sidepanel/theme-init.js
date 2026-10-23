// Applies a forced light/dark theme and the colour palette before the first
// paint, so the panel doesn't flash the defaults while the app loads.
// Extension pages can't run inline scripts, so this tiny classic script sits
// in <head> instead. The caches are written by src/state/theme.ts;
// chrome.storage stays the source of truth and is applied once the app starts.
try {
  const root = document.documentElement;
  const theme = localStorage.getItem("countdown-theme-cache");
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  const palette = localStorage.getItem("countdown-palette-cache");
  if (palette && /^[a-z]+$/.test(palette) && palette !== "indigo") root.dataset.palette = palette;
} catch {
  // Storage unavailable: the stored preferences are applied a moment later.
}
