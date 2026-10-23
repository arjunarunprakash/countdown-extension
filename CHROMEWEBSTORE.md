# Chrome Web Store Listing — Countdown

> Last Updated: 2026-10-22

Everything the Chrome Developer Dashboard asks for, ready to copy.

## Store Listing

**Extension Name**
Countdown

**Short Description** (must match or be close to manifest.json's description; ≤ 132 characters)
Live countdowns to your deadlines and events, in Chrome's side panel.

**Detailed Description** (plain text; the store strips Markdown)

```
Countdown keeps your deadlines and event start times in Chrome's side panel, each with a live countdown, so you always know how long you have left without opening a calendar.

FEATURES
• Live countdowns in days, hours, minutes or seconds. Click a single countdown to see just that one in another unit.
• Deadlines ("Due") and events ("Starts"), with a Google Calendar–style date and time picker.
• Repeating items: daily, weekdays, weekly on chosen days, every two weeks, monthly, yearly, or hand-picked dates, with an optional end. Repeats stack into one tidy tile.
• Numbered titles for series such as "Chapter 1 Homework", "Chapter 2 Homework"…
• Colour-coded categories. Drag items and whole series between them, and reorder categories by dragging.
• Mark items complete and see exactly when you finished them. Overdue and Completed lists keep everything else out of the way.
• Import from .ics files or calendar links (Google Calendar, Apple Calendar, Outlook), with a preview and duplicate detection.
• Export to Google Calendar or download an .ics file for any calendar app.
• Undo for every remove, complete and import.
• Light and dark themes, full keyboard support, screen-reader friendly, and respects reduced-motion settings.

HOW TO USE
1. Pin Countdown and click its toolbar icon to open the side panel.
2. Click + to add a deadline or event, or Import to bring in a calendar.
3. Click the arrow next to + to create categories, then drag items into them.

PRIVACY
Everything you add stays on your device. Countdown has no account, server, analytics or tracking.

PERMISSIONS
• Side panel: shows Countdown beside the page you're on.
• Storage: saves your items and settings on this device.
• Access to a calendar website (only if you choose to): when you paste a calendar link and press Fetch, Chrome asks whether Countdown may read that one site so it can download the calendar. Nothing else on the web is accessed.
```

**Category**
Productivity › Workflow & Planning

**Single Purpose**
Shows live countdowns to the user's own deadlines and event start times in Chrome's side panel.

**Primary Language**
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `public/icons/icon-128.png` |
| Screenshot 1 | 1280×800 | ✅ Ready | `store-assets/screenshot-1-light.png` |
| Screenshot 2 | 1280×800 | ✅ Ready | `store-assets/screenshot-1-dark.png` |
| Screenshot 3 | 1280×800 | ⬜ Not created | Categories and a repeating stack |
| Screenshot 4 | 1280×800 | ⬜ Not created | Import preview with duplicates |
| Small Promo Tile | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Notes

Screenshots 1–2 show the panel with sample data in light and dark mode next to a short feature summary. Regenerate them after UI changes with `bash scripts/screenshots.sh` (instructions in the script). Screenshots 3–4 would show categories with a coloured stack, and the import preview; they're optional.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `sidePanel` | permissions | Countdown's whole interface is a side panel. Clicking the toolbar icon opens it beside the current page so the user can watch their countdowns while browsing. |
| `storage` | permissions | Saves the user's deadlines, events, repeat rules, categories, completion history and display settings locally on their device (`chrome.storage.local`), so they persist between sessions. Nothing is synced or sent anywhere. |
| `https://*/*` | optional_host_permissions | Not granted at install. Requested only when the user pastes a calendar link (for example a Google Calendar "Secret address in iCal format") and presses Fetch. Chrome then asks for that one site (and its subdomains, because calendar servers redirect between them, e.g. p52-caldav.icloud.com). The extension downloads that single .ics file, without cookies, to show an import preview. No other request is made to the site and no page content is read. |

Remote code: none. All JavaScript is bundled in the package; the extension never loads or evaluates remote scripts.

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No.

The items, categories and settings the user creates are stored only on their device, and the developer never receives them. Calendar links are fetched directly from the calendar server the user chose; nothing is sent to the developer or any third party.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | No | No | — | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | No | No | — | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL**
https://github.com/arjunarunprakash/countdown-extension/blob/main/PRIVACY.md

The source is [PRIVACY.md](PRIVACY.md). Keep it consistent with the Privacy & Data Use answers above; open the URL in a private window before submitting to confirm it loads.

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name** — set on your Chrome Web Store developer account (one-time US$5 registration)
**Contact Email** — mermenial@gmail.com (shown publicly; Google also sends policy notices here, so keep it monitored)
**Support URL** — https://github.com/arjunarunprakash/countdown-extension/issues
**Homepage URL** — https://github.com/arjunarunprakash/countdown-extension

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-10-22 | First release: live countdowns, repeating items, categories, import/export, themes | Draft |

## Review Notes

### Packaging
`npm run package` builds and writes `release/countdown-v<version>.zip` with `manifest.json` at its root. It refuses to package when manifest.json and package.json versions differ, or when the build contains source maps or the dev-only audit script. Bump both versions before every upload; the store rejects a version that isn't higher than the published one.

### Known Issues / Limitations
- Calendar links are imported once; there's no automatic refresh.

### Rejection History
None yet.
