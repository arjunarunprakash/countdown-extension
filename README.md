# Countdown

A minimal Chrome extension that lists your deadlines and event start times in Chrome's side panel, each with a live countdown.

> **Status:** Phase 5 of 6: import from `.ics` files and calendar links, with a preview and duplicate detection. The accessibility pass, tests review and final docs (Phase 6) are next.

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
- **Custom dates.** Repeat › **Custom dates…** replaces the date button with chips for the chosen days, plus a calendar where clicking toggles a day and Shift-click adds a range. You can also type a date and press Enter. Past days can't be chosen. Every occurrence uses the item's time, and the stack reads "On N custom dates".
- **Ends.** The Ends menu offers **Never ends**, **Until a date** (inclusive) and **After a number of times**.
- **Numbered titles.** When an item repeats, **# Number each occurrence** inserts `{n}` into the title, e.g. "Chapter {n} Homework" becomes Chapter 1, 2, 3… Hand-picked dates work too.
  - Select a number in the title first and the button replaces it and starts counting from it. You can also change **Numbered from** directly.
  - A live preview shows the next titles.
  - Numbers follow schedule position, so removing Chapter 2 leaves Chapter 3 as Chapter 3.
  - Editing a numbered series edits its template, and every upcoming occurrence is renumbered. Changing the rule restarts the series from the next occurrence, which keeps its number.
  - Custom-date and numbered series export as separate events, because one RRULE can't carry hand-picked days or changing titles. An endless numbered series exports its next 104.
- **Completing items.** "Complete" sits next to "Remove" in a tile's edit state and plays a short completion animation. Each completion is saved as its own record, so stats survive even if the item is later removed.
- **New items.** A new item defaults to tomorrow at 9:00 AM. If you leave it with an empty title, it's discarded.
- **Editing.** Changes save when the editor closes: press Escape, press Enter in the title, or click anywhere outside it. Clearing the time makes an item all-day. Typed times accept `3pm`, `3:30 p.m.`, `15:00`, `1500`, `noon` and `midnight`; a bare number such as `9` is read as 24-hour time.
- **Undo.** Removing or completing shows a toast with Undo for 5 seconds. The timer pauses while you hover over or focus the toast, and Cmd/Ctrl+Z also undoes. A new toast replaces the previous one, and the earlier change stands.
- **Open stacks.** An expanded stack spans the full row. You can rename the series, switch Due/Starts for every occurrence at once, and complete or remove occurrences one at a time or in bulk with Select all and Remove selected.
- **Selection and export.** The Export button enters selection mode: a checkbox column slides in, Select all appears beside the unit label, and a bottom sheet slides up. Cancel, Done, Escape or the Export button again leave it.
  - Upcoming items and overdue items can be selected. A repeating stack is selected as a whole series. Completed items can't be selected.
  - **Google Calendar:** for one selected entry, opens Google's prefilled "new event" page. For several, it downloads an `.ics` file and links to Google's import page, because Google's link can only create one event.
  - **Download .ics:** works with Apple Calendar, Outlook and any RFC 5545 calendar.
  - **Remove:** removes the selected items, and whole series, with a single Undo.
  - **Share link:** a disabled "Soon" placeholder; it needs a backend.
- **Importing.** Import opens selection mode with an import sheet. Drop an `.ics` file anywhere on the panel, use **browse**, or paste a calendar link (`webcal://` or `https://`; Google's "Secret address in iCal format", Apple's public calendar link, Outlook's published `.ics`).
  - Countdown asks for permission to read a link's site only when you fetch it, covering that host and its parent domain's subdomains, since calendar servers often redirect, e.g. to `pNN-caldav.icloud.com`. Plain `http://` links are upgraded to `https://`.
  - Upcoming events appear in the list, pre-checked, with an **Import** badge. Past events are hidden and counted. **Add selected** imports them with one Undo; Cancel or Escape discards the preview.
  - **Duplicates:** an event with the same title (ignoring case and spacing) and the same moment, or the same calendar UID, shows greyed out as **Already added**, unchecked. The UID check also catches re-importing a file this app exported.
  - **Times:** time zones defined in the file (Outlook) are applied exactly. Standard zone names without a definition (often Google) are converted using the browser's time-zone data. Common Windows zone names are mapped to standard ones.
  - Events become Starts items, to-dos with a due date become Due items, and Countdown's own exports restore Due vs. Starts.
  - **Repeating events:** a rule the app can represent (daily, weekdays, weekly on chosen days, monthly, yearly, with an end) becomes a real series that keeps generating. Skipped and moved occurrences are honoured for the imported occurrences. Other rules, such as "second Tuesday", become a fixed stack of their next 6 occurrences.
  - **Series from another time zone:** these follow that zone's clock, so a 9:30 IST meeting stays at 9:30 IST through your daylight-saving changes. They export with a `TZID` plus a generated `VTIMEZONE`.
  - Calendars up to 10 MB, showing the first 300 upcoming events.
- **Exported files.** Valid RFC 5545: CRLF line endings, lines folded at 75 bytes, a UID and DTSTAMP on every event.
  - Deadlines and start times are points in time, so events have no end time. All-day items are exported as all-day events.
  - One-off times are written in UTC. Repeating series use floating local time, so "10:00 every Monday" stays at 10:00 across daylight-saving changes. Due vs. Starts is kept in an `X-COUNTDOWN-TYPE` property so a later re-import can restore it.
  - A series exports as one repeating event from its next occurrence. Removed occurrences become `EXDATE`s, and moved occurrences become separate events.
  - Month-end rules use the simplest, most widely supported form. The 31st becomes "last day of the month" and 29 February becomes "last day of February", both exact. For the 29th or 30th, other calendars skip months without that day, whereas the app uses the last day.
- **Look and theme.** Surfaces use a frosted-glass material (translucent fill, backdrop blur, bright hairline edge) over a soft fixed gradient. The header's theme button cycles **System → Light → Dark**; the choice is saved, and the panel cross-fades between themes. Text contrast is checked against the most saturated part of the gradient. With *Reduce transparency* turned on in the OS, surfaces become solid.
- **Dates.** Dates always display as `Thursday, 29 October 2026, 3:00 PM`; typed dates use MM/DD/YYYY. Times are stored with their UTC offset and exported in UTC.
- **All-day events.** Items imported as all-day events show no time and count down to the start of that day.
