// Composes the Chrome Web Store images from the panel captures in
// store-assets/scenes/ (made by scenes.mjs):
//   screenshot-1…5.png  1280×800, full bleed, square corners
//   promo-small.png     440×280 small promo tile
//   promo-marquee.png   1400×560 marquee
// Each screenshot shows one feature with a short headline and a single
// callout, per the store's listing guidance. Rendered by headless Chrome
// over a DevTools pipe at exact pixel sizes.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sweepIconSvg } from "../src/lib/drawIcon.ts";
import { paletteById } from "../src/lib/palettes.ts";

const DIR = new URL("./", import.meta.url).pathname;
const FONT = new URL("../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", import.meta.url).href;
const scene = (name) => new URL(`./scenes/${name}.png`, import.meta.url).href;
const LOGO = new URL("./logo-512.png", import.meta.url).href;

const BASE_CSS = `
@font-face { font-family: Inter; src: url("${FONT}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; }
body { font-family: Inter, system-ui, sans-serif; font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; color: #1b1c1f; }
.stage { position: relative; overflow: hidden; }
.light { background:
  radial-gradient(55% 60% at 0% 0%, rgb(122 140 255 / 0.42), transparent 70%),
  radial-gradient(45% 50% at 100% 0%, rgb(206 150 255 / 0.34), transparent 70%),
  radial-gradient(60% 55% at 70% 100%, rgb(110 214 200 / 0.32), transparent 70%), #eef0f6; }
.brand { background:
  radial-gradient(50% 70% at 10% 0%, rgb(143 162 255 / 0.55), transparent 70%),
  radial-gradient(45% 60% at 100% 100%, rgb(110 214 200 / 0.45), transparent 70%),
  linear-gradient(135deg, #3a54d6, #6a46d4); color: #fff; }
h1 { margin: 0; font-size: 46px; line-height: 1.08; letter-spacing: -0.025em; font-weight: 700; }
.sub { margin: 18px 0 0; font-size: 20px; line-height: 1.45; color: #474b54; max-width: 400px; }
.copy { position: absolute; left: 88px; top: 50%; translate: 0 -50%; width: 440px; }
.panel { position: absolute; width: 360px; border-radius: 18px; overflow: hidden; background: #eef0f6;
  box-shadow: 0 28px 70px -20px rgb(20 24 60 / 0.35), 0 0 0 1px rgb(20 24 40 / 0.08); }
.panel img { display: block; width: 360px; }
.callout { position: absolute; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px;
  background: linear-gradient(135deg, #3a54d6, #6a46d4); color: #fff; font-size: 17px; font-weight: 600; white-space: nowrap;
  box-shadow: 0 10px 24px -10px rgb(52 81 209 / 0.7); }
svg.arrows { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
`;

const page = (w, h, cls, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body><div class="stage ${cls}" style="width:${w}px;height:${h}px">${body}</div></body></html>`;

/** A curved arrow from (x1,y1) to (x2,y2) ending in a dot on the target. */
const arrow = (x1, y1, x2, y2, bend = 40) => {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - bend;
  return `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" fill="none" stroke="#3451d1" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 7"/>
    <circle cx="${x2}" cy="${y2}" r="7" fill="#3451d1" fill-opacity="0.18"/><circle cx="${x2}" cy="${y2}" r="3.5" fill="#3451d1"/>`;
};

/** The panel capture in a card, cropped to `height`, optionally starting `from` px down. */
const panel = (name, x, y, height, from = 0) =>
  `<div class="panel" style="left:${x}px;top:${y}px;height:${height}px"><img src="${scene(name)}" style="margin-top:${-from}px"></div>`;

/** A toolbar icon as Chrome draws it: the live Sweep mark plus an optional badge. */
const toolbarIcon = (palette, dark, sweep, badge, size = 32) => {
  const mode = dark ? paletteById(palette).dark : paletteById(palette).light;
  const svg = sweepIconSvg(size, { mode, dark, solid: paletteById(palette).solid, sweep });
  const b = badge
    ? `<span style="position:absolute;right:-7px;bottom:-5px;padding:0 5px;border-radius:7px;background:${mode.accent};color:${dark ? "#0d0f1a" : "#fff"};font-size:${Math.round(size * 0.38)}px;font-weight:700;line-height:${Math.round(size * 0.5)}px">${badge}</span>`
    : "";
  return `<span style="position:relative;display:inline-block;width:${size}px;height:${size}px">${svg}${b}</span>`;
};

const SHOTS = [];

// 1. The extension in Chrome: a course page with Countdown docked beside it.
SHOTS.push(page(1280, 800, "light", `
  <div class="copy" style="width:400px;left:80px">
    <h1>Every deadline, counting down</h1>
    <p class="sub">Live countdowns to your deadlines and events, docked beside whatever you're working on.</p>
  </div>
  <div style="position:absolute;left:520px;top:96px;width:720px;height:704px;border-radius:14px 14px 0 0;overflow:hidden;background:#fff;
    box-shadow:0 30px 80px -24px rgb(20 24 60 / 0.4),0 0 0 1px rgb(20 24 40 / 0.1)">
    <div style="height:40px;background:#dee3f0;display:flex;align-items:end;padding:0 12px;gap:8px">
      <span style="display:flex;gap:7px;align-self:center;margin-right:10px"><i style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:50%;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:50%;background:#28c840"></i></span>
      <span style="height:32px;width:220px;background:#fff;border-radius:10px 10px 0 0;display:flex;align-items:center;gap:8px;padding:0 12px;font-size:13px;color:#3c4043"><i style="width:14px;height:14px;border-radius:4px;background:#09616b"></i>CPSC 213: Course home</span>
    </div>
    <div style="height:46px;display:flex;align-items:center;gap:12px;padding:0 14px;border-bottom:1px solid #e3e5ea">
      <span style="flex:1;height:32px;border-radius:16px;background:#eef0f4;display:flex;align-items:center;padding:0 16px;font-size:13px;color:#5f6368">learn.example.edu/cpsc213</span>
      <span id="toolbar-icon" style="display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#e8eaf3">${toolbarIcon("indigo", false, 0.62, "2d", 20)}</span>
    </div>
    <div style="display:flex;height:618px">
      <div style="flex:1;padding:28px 26px;background:#fafbfc">
        <div style="font-size:21px;font-weight:700;color:#202124">Week 8: Pointers and memory</div>
        <div style="margin-top:10px;font-size:13px;color:#5f6368">Lectures · Labs · Assignments</div>
        ${[92, 100, 84, 96, 70].map((w) => `<div style="margin-top:14px;height:10px;width:${w}%;border-radius:5px;background:#e8eaed"></div>`).join("")}
        <div style="margin-top:26px;padding:14px;border-radius:10px;background:#fff;box-shadow:0 0 0 1px #e3e5ea">
          <div style="font-size:14px;font-weight:600;color:#202124">Assignment 3</div>
          <div style="margin-top:6px;font-size:12px;color:#5f6368">Due Sunday 11:59 PM</div>
        </div>
        ${[88, 76, 94].map((w) => `<div style="margin-top:14px;height:10px;width:${w}%;border-radius:5px;background:#e8eaed"></div>`).join("")}
      </div>
      <div style="width:360px;border-left:1px solid #e3e5ea;overflow:hidden"><img src="${scene("list")}" style="display:block;width:360px"></div>
    </div>
  </div>
  <span class="callout" style="left:806px;top:26px">Time left, right in your toolbar</span>
  <svg class="arrows" width="1280" height="800">${arrow(1080, 46, 1205, 158, -10)}</svg>
`));

// 2. Categories and drag and drop.
SHOTS.push(page(1280, 800, "light", `
  <div class="copy"><h1>Colour-coded categories</h1>
    <p class="sub">Group items by course, project or trip. Drag a tile or a whole repeating stack to move it.</p></div>
  ${panel("drag", 780, 40, 720)}
  <span class="callout" style="left:560px;top:520px">Drag to group</span>
  <svg class="arrows" width="1280" height="800">${arrow(700, 534, 921, 497, 30)}</svg>
`));

// 3. Repeating items with numbered titles.
SHOTS.push(page(1280, 800, "light", `
  <div class="copy"><h1>Repeats that number themselves</h1>
    <p class="sub">Weekly homework becomes Chapter 4, 5, 6… with one time for every occurrence.</p></div>
  ${panel("stack", 780, 40, 720)}
  <span class="callout" style="left:540px;top:590px">Every occurrence, titled</span>
  <svg class="arrows" width="1280" height="800">${arrow(770, 600, 843, 586, 12)}</svg>
`));

// 4. Calendar import with duplicate detection.
SHOTS.push(page(1280, 800, "light", `
  <div class="copy"><h1>Bring in any calendar</h1>
    <p class="sub">Import an .ics file or a Google, Apple or Outlook calendar link. Duplicates are spotted for you.</p></div>
  ${panel("import", 780, 20, 760)}
  <span class="callout" style="left:540px;top:196px">Already in your list</span>
  <svg class="arrows" width="1280" height="800">${arrow(732, 214, 922, 210, 22)}</svg>
`));

// 5. Themes and the live toolbar icon.
SHOTS.push(page(1280, 800, "light", `
  <div class="copy" style="width:380px;left:72px;top:46%"><h1>Make it yours</h1>
    <p class="sub">Seven colour themes in light and dark. The toolbar icon matches, and can sweep down as your next item gets closer.</p>
    <div style="margin-top:30px;display:flex;gap:26px;align-items:center">
      ${[["indigo", false, 0.9, "9d"], ["lagoon", false, 0.55, "3d"], ["orchid", true, 0.2, "5h"]].map(([p, d, s, b]) =>
        `<span style="display:grid;place-items:center;width:64px;height:64px;border-radius:18px;background:${d ? "#35363a" : "#fff"};box-shadow:0 0 0 1px rgb(20 24 40 / 0.08)">${toolbarIcon(p, d, s, b, 32)}</span>`).join("")}
    </div>
  </div>
  ${panel("appearance", 476, 80, 640)}
  ${panel("dark", 872, 80, 640)}
`));

const PROMO_SMALL = page(440, 280, "brand", `
  <img src="${LOGO}" style="position:absolute;left:36px;top:70px;width:140px;height:140px;filter:drop-shadow(0 16px 30px rgb(10 14 60 / 0.35))">
  <div style="position:absolute;left:202px;top:96px">
    <div style="font-size:40px;font-weight:700;letter-spacing:-0.03em;line-height:1">Countdown</div>
    <div style="margin-top:12px;font-size:16px;font-weight:500;opacity:0.92;white-space:nowrap">Deadlines, counting down</div>
  </div>
`);

const PROMO_MARQUEE = page(1400, 560, "brand", `
  <img src="${LOGO}" style="position:absolute;left:110px;top:150px;width:200px;height:200px;filter:drop-shadow(0 22px 40px rgb(10 14 60 / 0.35))">
  <div style="position:absolute;left:350px;top:180px">
    <div style="font-size:72px;font-weight:700;letter-spacing:-0.035em;line-height:1">Countdown</div>
    <div style="margin-top:18px;font-size:26px;font-weight:500;opacity:0.92">Every deadline, counting down</div>
  </div>
  <div style="position:absolute;right:80px;top:70px;width:360px;height:420px;border-radius:22px;overflow:hidden;rotate:4deg;
    box-shadow:0 40px 90px -20px rgb(10 14 60 / 0.55),0 0 0 1px rgb(255 255 255 / 0.25)"><img src="${scene("list")}" style="display:block;width:360px;margin-top:-56px"></div>
`);

// Render each page at its exact size over a DevTools pipe.
const work = mkdtempSync(join(tmpdir(), "countdown-listing-"));
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", `--user-data-dir=${join(work, "profile")}`, "--remote-debugging-pipe", "--allow-file-access-from-files", "about:blank"],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
let id = 0, buf = "";
const waiting = new Map();
chrome.stdio[4].on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\0")) >= 0) {
    const m = JSON.parse(buf.slice(0, i));
    buf = buf.slice(i + 1);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const m = { id: ++id, method, params, ...(sessionId && { sessionId }) };
  waiting.set(m.id, (r) => (r.error ? rej(new Error(`${method}: ${r.error.message}`)) : res(r.result)));
  chrome.stdio[3].write(JSON.stringify(m) + "\0");
});

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  const jobs = [
    ...SHOTS.map((html, i) => [html, 1280, 800, `screenshot-${i + 1}.png`]),
    [PROMO_SMALL, 440, 280, "promo-small.png"],
    [PROMO_MARQUEE, 1400, 560, "promo-marquee.png"],
  ];
  for (const [html, w, h, out] of jobs) {
    const file = join(work, out.replace(".png", ".html"));
    writeFileSync(file, html);
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }, s);
    await send("Page.navigate", { url: `file://${file}` }, s);
    await new Promise((r) => setTimeout(r, 900));
    const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: w, height: h, scale: 1 } }, s);
    writeFileSync(join(DIR, out), Buffer.from(data, "base64"));
    console.log(`store-assets/${out}  ${w}×${h}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const exited = new Promise((r) => chrome.once("exit", r));
  chrome.kill();
  await exited;
  rmSync(work, { recursive: true, force: true, maxRetries: 3 });
}
