// Clicking the toolbar icon opens the side panel instead of a popup.
const openOnClick = () =>
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error("Countdown: could not set panel behavior", error));

chrome.runtime.onInstalled.addListener(openOnClick);
chrome.runtime.onStartup.addListener(openOnClick);
