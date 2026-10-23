// Applies a forced light/dark theme before the first paint, so the panel
// doesn't flash the system scheme while the app loads. Extension pages can't
// run inline scripts, so this tiny classic script sits in <head> instead.
// The cache is written by src/state/theme.ts; chrome.storage stays the
// source of truth and is applied once the app starts.
try {
  const theme = localStorage.getItem("countdown-theme-cache");
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
} catch {
  // Storage unavailable: the stored preference is applied a moment later.
}
