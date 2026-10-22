// Renders the toolbar/store icons as PNGs with no image dependencies:
// an accent rounded square with a white countdown ring (270° arc) and a center dot.
// Run with `npm run icons`; output goes to public/icons/.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const ACCENT = [52, 81, 209]; // --accent-600 (#3451D1)
const WHITE = [255, 255, 255];
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersamples per axis

function shapeAt(x, y) {
  // Coordinates in a 0..1 unit square.
  const r = 0.22;
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;

  const dx = x - 0.5;
  const dy = y - 0.5;
  const dist = Math.hypot(dx, dy);
  const ringR = 0.27;
  const stroke = 0.085;
  // Angle measured clockwise from 12 o'clock, 0..360.
  const angle = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  const onRing = Math.abs(dist - ringR) <= stroke / 2 && angle <= 270;
  const capAt = (deg) => {
    const a = (deg * Math.PI) / 180;
    return Math.hypot(dx - ringR * Math.sin(a), dy + ringR * Math.cos(a)) <= stroke / 2;
  };
  if (onRing || capAt(0) || capAt(270) || dist <= 0.06) return WHITE;
  return ACCENT;
}

function render(size) {
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shapeAt((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const o = 1 + px * 4;
      if (a) { row[o] = r / a; row[o + 1] = g / a; row[o + 2] = b / a; }
      row[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
    rows.push(row);
  }
  return png(size, Buffer.concat(rows));
}

function png(size, raw) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const size of SIZES) writeFileSync(`public/icons/icon-${size}.png`, render(size));
console.log(`Wrote ${SIZES.map((s) => `icon-${s}.png`).join(", ")}`);
