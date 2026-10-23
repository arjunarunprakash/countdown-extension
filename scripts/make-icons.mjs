// Renders the static icons (extensions page, Chrome Web Store, and the toolbar
// icon before the service worker first draws its own) as PNGs: the Sweep mark
// in Indigo, resting at three quarters. Same geometry as the live toolbar icon
// (src/lib/drawIcon.ts), rasterised by headless Chrome.
// Run with `npm run icons` (macOS Chrome path; set CHROME to override).
// Output goes to public/icons/.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sweepIconSvg } from "../src/lib/drawIcon.ts";
import { PALETTES } from "../src/lib/palettes.ts";
import { RESTING_SWEEP } from "../src/lib/toolbarIcon.ts";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const out = new URL("../public/icons/", import.meta.url).pathname;
const indigo = PALETTES[0].light;
// Chrome's guidance: the 128px store icon is 96px of art with 16px of clear space.
const SIZES = [
  [16, 0],
  [32, 0],
  [48, 2],
  [128, 16],
];

const work = mkdtempSync(join(tmpdir(), "countdown-icons-"));
try {
  for (const [size, padding] of SIZES) {
    const page = join(work, `icon-${size}.html`);
    const svg = sweepIconSvg(size, { mode: indigo, dark: false, sweep: RESTING_SWEEP }, padding);
    writeFileSync(page, `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
    const profile = join(work, `profile-${size}`);
    execFileSync(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`,
      `--window-size=${size},${size}`, "--force-device-scale-factor=1", "--default-background-color=00000000",
      `--screenshot=${join(out, `icon-${size}.png`)}`, `file://${page}`,
    ], { stdio: "ignore" });
    const png = readFileSync(join(out, `icon-${size}.png`));
    console.log(`public/icons/icon-${size}.png  ${png.readUInt32BE(16)}×${png.readUInt32BE(20)}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
