# Countdown

A minimal Chrome extension that lists your deadlines and event start times in Chrome's side panel, each with a live countdown.

> **Status:** Phase 2 of 6: items are stored in `chrome.storage.local` and can be added, edited, completed and removed (with undo). Live per-second countdowns, unit cycling and the empty state arrive in Phase 3.

## Setup

Requires Node 24 LTS (ships with npm 11) and Chrome 116+.

```bash
npm ci
npm run build
```

> On older Node versions bundled with npm 10, `npm install` can fail with `Cannot read properties of null (reading 'edgesOut')` (an npm peer-dependency bug). `npm ci` still works; upgrading to Node 24 fixes it.

## Load the extension in Chrome

1. Run `npm run build`. This writes the extension to `dist/`.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Pin Countdown from the puzzle-piece menu, then click its icon to open the side panel.

After rebuilding, click the reload icon on Countdown's card in `chrome://extensions`, then reopen the panel. `npm run dev` rebuilds on every save.

**Sample data (development builds only):** with `npm run dev` running, open the panel page directly at `chrome-extension://<extension-id>/sidepanel/index.html?seed` while the list is empty to load sample items, including a recurring stack. Production builds strip this out.

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run dev` | Rebuild to `dist/` on every change |
| `npm test` | Run unit tests (Vitest) |
| `npm run typecheck` | TypeScript only |
| `npm run icons` | Regenerate `public/icons/*.png` from `scripts/make-icons.mjs` |

## Project layout

```
public/            manifest.json and icons (copied to dist/ as-is)
src/background/    MV3 service worker: makes the toolbar icon open the side panel
src/sidepanel/     side panel page and root component
src/components/    UI components
src/lib/           pure logic: dates, parsing, calendar, countdown math, item operations, storage validation (unit-tested)
src/state/         signals for items, prefs, UI state, toast and clock; actions that persist and offer undo
src/hooks/         shared hooks (Escape / click-outside dismissal)
src/styles/        tokens.css (all design tokens), base.css, components.css
tests/             Vitest unit tests
```

## Product decisions

- **Past items.** Past items move to a collapsible **Past** section at the bottom. A Due item that has passed shows "Overdue" in red; a Starts item that has passed shows "Started".
- **Countdown values.** Countdowns round down to whole units. Under one unit, the box shows `<1`. Values up to 9,999 show in full with commas; larger values are abbreviated (`12.4K`, `2.6M`). The tooltip shows the exact time left.
- **Recurring events become stacks.** Occurrences of one recurring event are grouped into a single stacked tile, headed by the next occurrence. When that occurrence is completed it disappears; when it passes, it moves to Past. Either way, the next occurrence moves to the top. Opening a stack fans it out to edit, complete or remove occurrences individually or in bulk.
- **Completing items.** "Complete" sits next to "Remove" in a tile's edit state and plays a short completion animation. Each completion is saved as its own record, so stats survive even if the item is later removed.
- **New items.** A new item defaults to tomorrow at 9:00 AM. If you leave it with an empty title, it's discarded.
- **Editing.** Changes save when the editor closes: press Escape, press Enter in the title, or click anywhere outside it. Clearing the time makes an item all-day. Typed times accept `3pm`, `3:30 p.m.`, `15:00`, `1500`, `noon` and `midnight`; a bare number such as `9` is read as 24-hour time.
- **Undo.** Removing or completing shows a toast with Undo for 5 seconds. The timer pauses while you hover over or focus the toast, and Cmd/Ctrl+Z also undoes. A new toast replaces the previous one, and the earlier change stands.
- **Open stacks.** An expanded stack spans the full row. You can rename the series, switch Due/Starts for every occurrence at once, and complete or remove occurrences one at a time or in bulk with Select all and Remove selected.
- **Dates.** Dates always display as `Thursday, 29 October 2026, 3:00 PM`; typed dates use MM/DD/YYYY. Times are stored with their UTC offset and exported in UTC.
- **All-day events.** Items imported as all-day events show no time and count down to the start of that day.
