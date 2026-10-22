# Countdown

A minimal Chrome extension that lists your deadlines and event start times in Chrome's side panel, each with a live countdown.

> **Status:** Phase 3 of 6: live countdowns with unit cycling, repeating items, Overdue and Completed sections, and an empty state. Export (Phase 4) and import (Phase 5) are next.

## Setup

Requires Node 24 LTS (ships with npm 11) and Chrome 123+.

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

- **Bottom sections.** Two collapsible sections sit below the upcoming list, and each remembers whether it was open:
  - **Overdue:** items whose time has passed without being completed. Due items show "Overdue" in red; Starts items show "Started". Started events go here rather than in Completed so the completion stats only count things you actually checked off.
  - **Completed:** newest first, each showing the exact time it was completed and its original date. **Mark as not done** moves an item back to the list and drops its completion record. **Clear** removes completed items from the list but keeps their records for stats. Both can be undone. The list shows 20 at a time.
- **Live countdowns.** Click the unit label (**Days → Hours → Minutes → Seconds**) to change every box at once; the choice is remembered. Boxes update every second in Seconds mode and on each minute boundary otherwise. Items move to Overdue the moment their time passes.
- **Countdown values.** Countdowns round down to whole units. Under one unit, the box shows `<1`. Values up to 9,999 show in full with commas; larger values are abbreviated (`12.4K`, `2.6M`). The tooltip shows the exact time left.
- **Repeating items.** Any item can repeat: Daily, Every weekday, Weekly, Every 2 weeks, Monthly or Annually. It can end never, on a date, or after a number of times. Occurrences are grouped into one stacked tile headed by the next occurrence, labelled with the rule (e.g. "Weekly on Monday · until 31 December").
  - The panel keeps the next 6 occurrences generated and adds more as earlier ones are completed or pass. Occurrences that fell in the past while the panel was closed are skipped rather than flooding Overdue.
  - Monthly on the 29th–31st, and Annually on 29 February, fall on the last day of shorter months. Google Calendar skips those months instead.
  - Editing an occurrence's date or time changes only that occurrence. Changing the title or type updates the series, but not past or completed occurrences. Changing the repeat rule restarts the series from the next occurrence, and "Does not repeat" keeps just that occurrence.
  - Removing one occurrence skips it. Selecting all of a stack's occurrences turns the button into **Remove series**, which stops the series (with undo).
  - Rules are a subset of iCalendar RRULE, so they map directly to .ics import and export.
- **Completing items.** "Complete" sits next to "Remove" in a tile's edit state and plays a short completion animation. Each completion is saved as its own record, so stats survive even if the item is later removed.
- **New items.** A new item defaults to tomorrow at 9:00 AM. If you leave it with an empty title, it's discarded.
- **Editing.** Changes save when the editor closes: press Escape, press Enter in the title, or click anywhere outside it. Clearing the time makes an item all-day. Typed times accept `3pm`, `3:30 p.m.`, `15:00`, `1500`, `noon` and `midnight`; a bare number such as `9` is read as 24-hour time.
- **Undo.** Removing or completing shows a toast with Undo for 5 seconds. The timer pauses while you hover over or focus the toast, and Cmd/Ctrl+Z also undoes. A new toast replaces the previous one, and the earlier change stands.
- **Open stacks.** An expanded stack spans the full row. You can rename the series, switch Due/Starts for every occurrence at once, and complete or remove occurrences one at a time or in bulk with Select all and Remove selected.
- **Look and theme.** Surfaces use a frosted-glass material (translucent fill, backdrop blur, bright hairline edge) over a soft fixed gradient. The header's theme button cycles **System → Light → Dark**; the choice is saved, and the panel cross-fades between themes. Text contrast is checked against the most saturated part of the gradient. With *Reduce transparency* turned on in the OS, surfaces become solid.
- **Dates.** Dates always display as `Thursday, 29 October 2026, 3:00 PM`; typed dates use MM/DD/YYYY. Times are stored with their UTC offset and exported in UTC.
- **All-day events.** Items imported as all-day events show no time and count down to the start of that day.
