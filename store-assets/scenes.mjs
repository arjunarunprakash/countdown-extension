// Captures the side panel in the states the store screenshots show. Each
// scene loads realistic data into the panel (served by `vite preview` on
// :4173), performs a real interaction (opening a stack, dropping a calendar
// file, dragging a tile, opening Appearance) and saves a 2× PNG to
// store-assets/scenes/. scripts/screenshots.sh then composes them into the
// 1280×800 store screenshots. Motion is reduced so nothing is caught mid-fade.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.PANEL_URL ?? "http://localhost:4173/sidepanel/index.html";
const OUT = new URL("./scenes/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Runs in the page: builds the scene's data relative to now and stores it the
// way the panel does outside the extension (localStorage, "countdown:" keys).
const seed = (opts) => `(() => {
  const opts = ${JSON.stringify(opts)};
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  const iso = (d) => { const o = -d.getTimezoneOffset();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":00" + (o >= 0 ? "+" : "-") + pad(Math.trunc(o / 60)) + ":" + pad(o % 60); };
  const now = new Date();
  const at = (days, h, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return iso(d); };
  const nextWeekday = (wd, h, m = 0) => { const d = new Date(now); d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7 || 7)); d.setHours(h, m, 0, 0); return iso(d); };
  const stamp = iso(new Date(now.getTime() - 5 * 864e5));
  const item = (id, title, type, dateTime, categoryId) => ({ id, title, type, dateTime, createdAt: stamp, updatedAt: stamp, source: "manual", ...(categoryId && { categoryId }) });
  const categories = [
    { id: "cs", name: "CPSC 213", color: "teal" },
    { id: "math", name: "MATH 200", color: "violet" },
    { id: "life", name: "Personal", color: "orange" },
  ];
  const series = [
    { id: "hw", epoch: 0, start: nextWeekday(5, 23, 59), rule: { freq: "WEEKLY", interval: 1 }, end: { type: "never" },
      template: { title: "Chapter {n} Homework", type: "due" }, nextIndex: 0, categoryId: "math", numberFrom: 4 },
    { id: "lab", epoch: 0, start: nextWeekday(2, 14), rule: { freq: "WEEKLY", interval: 1 }, end: { type: "never" },
      template: { title: "Lab {n}", type: "starts" }, nextIndex: 0, categoryId: "cs", numberFrom: 3 },
  ];
  const items = [
    item("a3", "Assignment 3", "due", at(2, 23, 59), "cs"),
    item("mid", "Midterm", "starts", at(8, 18, 30), "cs"),
    item("ps5", "Problem set 5", "due", at(4, 17), "math"),
    item("concert", "Concert presale", "starts", at(6, 10), "life"),
    item("flight", "Flight to Lisbon", "starts", at(12, 7, 45), opts.flightUncategorized ? undefined : "life"),
    item("passport", "Passport renewal", "due", at(34, 12), "life"),
    item("books", "Return library books", "due", at(-1, 18)),
  ];
  localStorage.clear();
  const set = (k, v) => localStorage.setItem("countdown:" + k, JSON.stringify(v));
  set("schemaVersion", 1); set("items", items); set("series", series); set("categories", categories); set("completions", []);
  set("prefs", { unit: "days", theme: opts.theme ?? "system", palette: opts.palette ?? "indigo", liveIcon: true, overdueCollapsed: false, completedCollapsed: true });
  localStorage.setItem("countdown-palette-cache", opts.palette ?? "indigo");
  localStorage.setItem("countdown-theme-cache", opts.theme ?? "system");
  return true;
})()`;

// An .ics file for the import scene: two new events, one already in the list,
// one past. Built in the page, so its times follow the browser's time zone
// rules exactly like the items the scene seeds.
const ICS = `(() => {
  const d = (days, h, m = 0) => { const t = new Date(); t.setDate(t.getDate() + days); t.setHours(h, m, 0, 0); return t.toISOString().replace(/[-:]/g, "").replace(/\\.\\d{3}/, ""); };
  const ev = (uid, title, start, type = "starts") =>
    "BEGIN:VEVENT\\r\\nUID:" + uid + "\\r\\nDTSTAMP:" + d(0, 0) + "\\r\\nDTSTART:" + start + "\\r\\nSUMMARY:" + title + "\\r\\nX-COUNTDOWN-TYPE:" + type + "\\r\\nEND:VEVENT";
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Example//Course calendar//EN",
    ev("1@ex", "Midterm", d(8, 18, 30)), ev("2@ex", "Project proposal", d(10, 23, 59), "due"), ev("3@ex", "Guest lecture", d(15, 13)),
    ev("4@ex", "Final exam", d(45, 9)), ev("5@ex", "Orientation", d(-20, 10)), "END:VCALENDAR"].join("\\r\\n");
})()`;

const SCENES = [
  { name: "list", height: 760, seed: {} },
  { name: "drag", height: 760, seed: { flightUncategorized: true }, act: `
      const head = [...document.querySelectorAll(".category")].find((s) => s.textContent.includes("Personal"));
      // Start with MATH 200's header just under the sticky header, which keeps
      // the drag mid-panel (near an edge the panel auto-scrolls).
      const math = [...document.querySelectorAll(".category")].find((c) => c.textContent.includes("MATH 200"));
      scrollTo(0, math.getBoundingClientRect().top + scrollY - 58);
      await new Promise((r) => setTimeout(r, 100));
      const tile = [...document.querySelectorAll(".tile")].find((t) => t.textContent.includes("Flight to Lisbon"));
      const a = tile.getBoundingClientRect(), b = head.getBoundingClientRect();
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + 120, y1 = b.top + 130;
      const pe = (type, el, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0, pointerType: "mouse", isPrimary: true }));
      pe("pointerdown", tile, x0, y0);
      for (let i = 1; i <= 10; i++) { pe("pointermove", document, x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await new Promise((r) => setTimeout(r, 16)); }` },
  { name: "stack", height: 760, seed: {}, act: `
      const stack = [...document.querySelectorAll(".row--stack .tile")].find((t) => t.textContent.includes("Homework"));
      stack.click(); await new Promise((r) => setTimeout(r, 400));
      // MATH 200's header just under the sticky header.
      const math = [...document.querySelectorAll(".category")].find((c) => c.textContent.includes("MATH 200"));
      scrollTo(0, math.getBoundingClientRect().top + scrollY - 58);` },
  { name: "import", height: 760, seed: {}, act: `
      document.querySelector('[aria-label="Import"]').click(); await new Promise((r) => setTimeout(r, 300));
      const input = document.querySelector('input[type="file"]');
      const dt = new DataTransfer(); dt.items.add(new File([${ICS}], "CPSC 213 schedule.ics", { type: "text/calendar" }));
      input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 500));
      // Show the preview rows: new events with their Import badge, and the duplicate.
      const first = document.querySelector(".row--candidate");
      scrollTo(0, first.getBoundingClientRect().top + scrollY - 110);` },
  { name: "appearance", height: 640, seed: { palette: "lagoon", theme: "light" }, act: `
      document.querySelector('[aria-label="Appearance"]').click();` },
  { name: "dark", height: 640, seed: { palette: "orchid", theme: "dark" }, scheme: "dark" },
];

const profile = mkdtempSync(join(tmpdir(), "countdown-scenes-"));
const chrome = spawn(process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", `--user-data-dir=${profile}`, "--remote-debugging-pipe", "about:blank"],
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId: s } = await send("Target.attachToTarget", { targetId, flatten: true });
  const run = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }, s);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  };
  await send("Page.navigate", { url: BASE }, s);
  await sleep(1000);
  for (const scene of SCENES) {
    await send("Emulation.setDeviceMetricsOverride", { width: 360, height: scene.height, deviceScaleFactor: 2, mobile: false }, s);
    await send("Emulation.setScrollbarsHidden", { hidden: true }, s);
    await send("Emulation.setEmulatedMedia", { features: [
      { name: "prefers-color-scheme", value: scene.scheme ?? "light" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ] }, s);
    await run(`return ${seed(scene.seed)}`);
    await send("Page.navigate", { url: BASE }, s);
    await sleep(1500);
    if (scene.act) await run(scene.act);
    await sleep(900);
    const { data } = await send("Page.captureScreenshot", { format: "png" }, s);
    writeFileSync(join(OUT, `${scene.name}.png`), Buffer.from(data, "base64"));
    console.log(`store-assets/scenes/${scene.name}.png`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const exited = new Promise((r) => chrome.once("exit", r));
  chrome.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
}
