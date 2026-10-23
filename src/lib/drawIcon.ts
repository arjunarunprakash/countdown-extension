// The Sweep mark: a frosted tile with the palette's glows, a disc, and a
// gradient wedge for the time left. One geometry, two renderers: canvas (the
// service worker draws the live toolbar icon) and SVG (scripts/make-icons.mjs
// renders the static PNGs from it). Kept free of runtime imports so Node can
// load it directly.
import type { PaletteMode } from "./palettes";

/** Proportions of the artwork, as fractions of its width. */
export const GEOMETRY = {
  tileRadius: 0.27,
  disc: 0.345,
  /** Faint accent ring around the disc, so it separates from the tile at 16px. */
  discRing: 0.035,
  wedge: 0.285,
  hub: 0.075,
  /** Glow centres (x, y) and radius, matching the panel's background gradient. */
  glows: [
    [0.15, 0.1, 0.8],
    [0.9, 0.05, 0.75],
    [0.9, 0.95, 0.8],
  ],
} as const;

export interface IconLook {
  mode: PaletteMode;
  dark: boolean;
  /** Solid tile, no glows (the Clear palette). */
  solid?: boolean;
  /** Wedge size, 0–1. */
  sweep: number;
}

const colors = ({ dark }: IconLook) => ({
  tile: dark ? "#1a1c24" : "#f6f7fb",
  disc: dark ? "#0f1016" : "#ffffff",
  edge: dark ? "rgb(255 255 255 / 0.14)" : "rgb(20 24 40 / 0.12)",
  glowAlpha: dark ? 0.55 : 0.6,
});

/** Draws the mark filling `size`×`size` at the canvas origin. */
export function drawSweepIcon(ctx: OffscreenCanvasRenderingContext2D, size: number, look: IconLook): void {
  const c = colors(look);
  const [g1, g2] = look.mode.gradient;
  const mid = size / 2;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * GEOMETRY.tileRadius);
  ctx.clip();
  ctx.fillStyle = c.tile;
  ctx.fillRect(0, 0, size, size);
  if (!look.solid) {
    look.mode.glows.forEach(([r, g, b], i) => {
      const [x, y, rad] = GEOMETRY.glows[i]!;
      const grad = ctx.createRadialGradient(x * size, y * size, 0, x * size, y * size, rad * size);
      grad.addColorStop(0, `rgb(${r} ${g} ${b} / ${c.glowAlpha})`);
      grad.addColorStop(1, `rgb(${r} ${g} ${b} / 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    });
  }
  ctx.restore();

  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, size - 1, size - 1, size * GEOMETRY.tileRadius - 0.5);
  ctx.strokeStyle = c.edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mid, mid, size * GEOMETRY.disc, 0, Math.PI * 2);
  ctx.fillStyle = c.disc;
  ctx.fill();
  ctx.strokeStyle = `color-mix(in srgb, ${g1} 30%, transparent)`;
  ctx.lineWidth = Math.max(0.75, size * GEOMETRY.discRing);
  ctx.stroke();

  const accent = ctx.createLinearGradient(0, 0, size, size);
  accent.addColorStop(0, g1);
  accent.addColorStop(1, g2);
  const top = -Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(mid, mid);
  ctx.arc(mid, mid, size * GEOMETRY.wedge, top, top + Math.PI * 2 * Math.min(1, look.sweep));
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(mid, mid, size * GEOMETRY.hub, 0, Math.PI * 2);
  ctx.fillStyle = c.disc;
  ctx.fill();
}

/** The same mark as SVG, with optional transparent padding (the store icon is 96px of art in 128). */
export function sweepIconSvg(size: number, look: IconLook, padding = 0): string {
  const c = colors(look);
  const [g1, g2] = look.mode.gradient;
  const s = size - padding * 2;
  const at = (f: number) => padding + f * s;
  const mid = at(0.5);
  const angle = Math.min(0.9999, look.sweep) * Math.PI * 2;
  const end = [mid + Math.sin(angle) * s * GEOMETRY.wedge, mid - Math.cos(angle) * s * GEOMETRY.wedge];
  const r = s * GEOMETRY.wedge;
  const glows = look.solid
    ? ""
    : look.mode.glows
        .map(([red, g, b], i) => {
          const [x, y, rad] = GEOMETRY.glows[i]!;
          return `<radialGradient id="g${i}" gradientUnits="userSpaceOnUse" cx="${at(x)}" cy="${at(y)}" r="${rad * s}"><stop offset="0" stop-color="rgb(${red},${g},${b})" stop-opacity="${c.glowAlpha}"/><stop offset="1" stop-color="rgb(${red},${g},${b})" stop-opacity="0"/></radialGradient>`;
        })
        .join("");
  const tile = `x="${padding}" y="${padding}" width="${s}" height="${s}" rx="${s * GEOMETRY.tileRadius}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs>${glows}<linearGradient id="a" gradientUnits="userSpaceOnUse" x1="${padding}" y1="${padding}" x2="${padding + s}" y2="${padding + s}"><stop offset="0" stop-color="${g1}"/><stop offset="1" stop-color="${g2}"/></linearGradient></defs>
<rect ${tile} fill="${c.tile}"/>
${look.solid ? "" : [0, 1, 2].map((i) => `<rect ${tile} fill="url(#g${i})"/>`).join("")}
<rect x="${padding + 0.5}" y="${padding + 0.5}" width="${s - 1}" height="${s - 1}" rx="${s * GEOMETRY.tileRadius - 0.5}" fill="none" stroke="${c.edge}"/>
<circle cx="${mid}" cy="${mid}" r="${s * GEOMETRY.disc}" fill="${c.disc}" stroke="${g1}" stroke-opacity="0.3" stroke-width="${Math.max(0.75, s * GEOMETRY.discRing)}"/>
<path d="M${mid} ${mid}L${mid} ${mid - r}A${r} ${r} 0 ${angle > Math.PI ? 1 : 0} 1 ${end[0]} ${end[1]}Z" fill="url(#a)"/>
<circle cx="${mid}" cy="${mid}" r="${s * GEOMETRY.hub}" fill="${c.disc}"/>
</svg>`;
}
