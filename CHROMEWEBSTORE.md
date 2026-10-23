# Chrome Web Store Listing — Countdown

> Last Updated: 2026-10-23

Everything the Chrome Developer Dashboard asks for, ready to copy.

## Store Listing

**Extension Name**
Countdown

**Short Description** (matches manifest.json's description; 122 of 132 characters)
Live countdowns to your deadlines and events in Chrome's side panel, with categories, repeating items and calendar import.

**Detailed Description** (plain text; the store strips Markdown)

```
Countdown keeps every deadline and event in Chrome's side panel with a live countdown, so you can see how long you have left without leaving the page you're on. Group things by course, project or trip, let weekly work repeat itself, and bring in the calendars you already use. Everything stays on your device.

FEATURES
• Live countdowns in days, hours, minutes or seconds, for deadlines (Due) and events (Starts)
• Colour-coded categories: drag items and whole repeating series between them
• Repeating items, from daily to yearly or on dates you pick, with numbered titles like "Chapter 4 Homework"
• Import .ics files or Google, Apple and Outlook calendar links, with a preview that spots duplicates
• Export to Google Calendar or any calendar app
• Seven colour themes in light and dark, and a toolbar icon that can show the time left until your next item
• Undo for every change, full keyboard support, and screen reader friendly

HOW TO USE
1. Pin Countdown and click its toolbar icon to open the side panel.
2. Click + to add a deadline or event, or Import to bring in a calendar.
3. Use the arrow next to + to create categories, then drag items into them.

PRIVACY
Everything you add stays on your device. Countdown has no account, server, analytics or tracking.

PERMISSIONS
Countdown asks for no access to websites when you install it. If you paste a calendar link and press Fetch, Chrome asks whether Countdown may read that one site so it can download the calendar.

SUPPORT
Questions or bugs: https://github.com/arjunarunprakash/countdown-extension/issues
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
| Screenshot 1 | 1280×800 | ✅ Ready | `store-assets/screenshot-1.png` |
| Screenshot 2 | 1280×800 | ✅ Ready | `store-assets/screenshot-2.png` |
| Screenshot 3 | 1280×800 | ✅ Ready | `store-assets/screenshot-3.png` |
| Screenshot 4 | 1280×800 | ✅ Ready | `store-assets/screenshot-4.png` |
| Screenshot 5 | 1280×800 | ✅ Ready | `store-assets/screenshot-5.png` |
| Small Promo Tile | 440×280 | ✅ Ready | `store-assets/promo-small.png` |
| Marquee Promo Tile | 1400×560 | ✅ Ready | `store-assets/promo-marquee.png` |

### Screenshot Notes

Following the store's [listing guidance](https://developer.chrome.com/docs/webstore/best-listing): five full-bleed 1280×800 images with square corners, one feature each, a short headline and one line of text, a single callout pointing at the feature, and branding that matches the icon. Every panel image is a real capture of the current build, not a mock-up. Upload them in this order:

1. **Every deadline, counting down.** The panel docked beside a course page in Chrome, with the toolbar icon's "2d" badge called out.
2. **Colour-coded categories.** Mid-drag: "Flight to Lisbon → Personal", with the Personal section lit as the drop target.
3. **Repeats that number themselves.** A weekly "Chapter {n} Homework" series open, listing Chapter 4–9 with their dates.
4. **Bring in any calendar.** An import preview: three new events marked Import and one greyed out as Already added.
5. **Make it yours.** Lagoon (light) with Appearance open beside Orchid (dark), and three toolbar icons sweeping from 9d to 5h.

The promo tile and marquee use the saturated accent gradient (not white or light grey), the logo and name, and little text, so they read at half size.

**Regenerating** after UI changes: with a build served by `vite preview --port 4173`, run `bash scripts/screenshots.sh`. `store-assets/scenes.mjs` loads each scene's data into the real panel and performs the interaction; `store-assets/render.mjs` composes the final images.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `sidePanel` | permissions | Countdown's whole interface is a side panel. Clicking the toolbar icon opens it beside the current page so the user can watch their countdowns while browsing. |
| `storage` | permissions | Saves the user's deadlines, events, repeat rules, categories, completion history and display settings locally on their device (`chrome.storage.local`), so they persist between sessions. Nothing is synced or sent anywhere. |
| `https://*/*` | optional_host_permissions | Not granted at install. Requested only when the user pastes a calendar link (for example a Google Calendar "Secret address in iCal format") and presses Fetch. Chrome then asks for that one site (and its subdomains, because calendar servers redirect between them, e.g. p52-caldav.icloud.com). The extension downloads that single .ics file, without cookies, to show an import preview. No other request is made to the site and no page content is read. |
| `alarms` | permissions | Redraws the toolbar icon at the moment its badge or countdown sweep should next change (for example when "3d" becomes "2d"), even while the side panel is closed. No data leaves the device. |
| `offscreen` | permissions | Extension background scripts can't read whether Chrome is in light or dark mode, so a small hidden page (offscreen reason MATCH_MEDIA) reports it, letting the toolbar icon match the toolbar it sits on. The page does nothing else and makes no network requests. |

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
| 1.0.0 | 2026-10-23 | First release: live countdowns, repeating items, categories, import/export, seven colour themes, live toolbar icon | Draft |

## Review Notes

### Packaging
`npm run package` builds and writes `release/countdown-v<version>.zip` with `manifest.json` at its root. It refuses to package when manifest.json and package.json versions differ, or when the build contains source maps or the dev-only audit script. Bump both versions before every upload; the store rejects a version that isn't higher than the published one.

### Known Issues / Limitations
- Calendar links are imported once; there's no automatic refresh.

### Rejection History
None yet.
