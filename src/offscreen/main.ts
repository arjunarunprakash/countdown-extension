// Hidden page (chrome.offscreen, reason MATCH_MEDIA): tells the service
// worker whether Chrome is in dark mode, now and whenever it changes, so the
// toolbar icon matches the toolbar it sits on.
//
// Hidden pages don't render, and media-query "change" events are dispatched
// as part of rendering, so they can't be relied on here. Reading .matches is
// always current, so a light poll backs the event up and only reports changes.
const query = matchMedia("(prefers-color-scheme: dark)");
const POLL_MS = 5_000;
let last: boolean | null = null;

async function report() {
  if (query.matches === last) return;
  last = query.matches;
  try {
    await chrome.runtime.sendMessage({ type: "toolbar-scheme", dark: last });
  } catch {
    // The worker may be restarting; try again on the next check.
    last = null;
  }
}

report();
query.addEventListener("change", report);
setInterval(report, POLL_MS);
