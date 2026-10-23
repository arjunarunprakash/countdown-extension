// Colour themes ("palettes"). The panel's CSS has one :root[data-palette]
// block per palette in styles/tokens.css; this module carries the same
// colours for code that can't read CSS: the settings swatches and the
// toolbar icon the service worker draws. tests/palettes.test.ts checks the
// two stay in sync.
//
// Every palette was measured before it went in (see DESIGN.md): accent text
// stays ≥ 4.5:1 on its tinted countdown box over the worst case of its own
// glows, button text passes on the gradient, and the accent stays well away
// from the red that means Overdue.

export type PaletteId = "indigo" | "lagoon" | "fern" | "orchid" | "dune" | "graphite" | "clear";

/** An rgb triplet and its opacity in the background gradient. */
export type Glow = readonly [r: number, g: number, b: number, alpha: number];

export interface PaletteMode {
  accent: string;
  /** The 135° accent gradient: buttons, the sweep in the logo. */
  gradient: readonly [string, string];
  bg: string;
  glows: readonly [Glow, Glow, Glow];
  /** Text on the gradient, when it isn't the default (white in light, near-black in dark). */
  onAccent?: string;
}

export interface Palette {
  id: PaletteId;
  name: string;
  light: PaletteMode;
  dark: PaletteMode;
  /** Solid surfaces instead of glass. */
  solid?: boolean;
}

export const PALETTES: readonly Palette[] = [
  {
    id: "indigo",
    name: "Indigo",
    light: { accent: "#3451d1", gradient: ["#3a54d6", "#6a46d4"], bg: "#eef0f6", glows: [[122, 140, 255, 0.38], [206, 150, 255, 0.32], [110, 214, 200, 0.3]] },
    dark: { accent: "#a3b2ff", gradient: ["#8fa2ff", "#b79cff"], bg: "#0c0d12", glows: [[79, 99, 230, 0.32], [150, 80, 220, 0.24], [20, 150, 140, 0.2]] },
  },
  {
    id: "lagoon",
    name: "Lagoon",
    light: { accent: "#0a6378", gradient: ["#0b7d96", "#2f5fcf"], bg: "#ecf3f6", glows: [[80, 200, 235, 0.38], [120, 160, 255, 0.32], [110, 220, 190, 0.3]] },
    dark: { accent: "#7fd3e6", gradient: ["#7fd8ea", "#97b4ff"], bg: "#091115", glows: [[50, 124, 146, 0.32], [74, 99, 158, 0.24], [68, 136, 118, 0.2]] },
  },
  {
    id: "fern",
    name: "Fern",
    light: { accent: "#256b45", gradient: ["#2a8458", "#11737a"], bg: "#edf3ef", glows: [[120, 215, 165, 0.38], [170, 220, 130, 0.32], [110, 190, 235, 0.3]] },
    dark: { accent: "#8fd8ad", gradient: ["#8fdcae", "#7ccfd0"], bg: "#0a110d", glows: [[74, 133, 102, 0.32], [105, 136, 81, 0.24], [68, 118, 146, 0.2]] },
  },
  {
    id: "orchid",
    name: "Orchid",
    light: { accent: "#7a2ec4", gradient: ["#7a3ae6", "#b0349c"], bg: "#f3eff8", glows: [[196, 150, 255, 0.38], [255, 150, 210, 0.32], [140, 150, 255, 0.3]] },
    dark: { accent: "#d4aaff", gradient: ["#c7a3ff", "#f0a6dc"], bg: "#100c15", glows: [[122, 93, 158, 0.32], [158, 93, 130, 0.24], [87, 93, 158, 0.2]] },
  },
  {
    id: "dune",
    name: "Dune",
    light: { accent: "#8a5200", gradient: ["#e09a2c", "#c9772a"], bg: "#f6f2ec", glows: [[255, 200, 120, 0.38], [255, 160, 130, 0.32], [200, 210, 150, 0.3]], onAccent: "#1b1c1f" },
    dark: { accent: "#f2c27c", gradient: ["#f5cd86", "#f2a77a"], bg: "#120f0b", glows: [[158, 124, 74, 0.32], [158, 99, 81, 0.24], [124, 130, 93, 0.2]] },
  },
  {
    id: "graphite",
    name: "Graphite",
    light: { accent: "#3f4a5c", gradient: ["#4f5a6e", "#262d3a"], bg: "#eff0f2", glows: [[150, 165, 190, 0.38], [175, 175, 195, 0.32], [160, 185, 190, 0.3]] },
    dark: { accent: "#c8d0dc", gradient: ["#dfe4ec", "#a7b2c4"], bg: "#0c0d0f", glows: [[93, 102, 118, 0.32], [108, 108, 121, 0.24], [99, 115, 118, 0.2]] },
  },
  {
    id: "clear",
    name: "Clear",
    solid: true,
    light: { accent: "#3451d1", gradient: ["#3a54d6", "#6a46d4"], bg: "#f2f3f6", glows: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
    dark: { accent: "#a3b2ff", gradient: ["#8fa2ff", "#b79cff"], bg: "#111216", glows: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]] },
  },
];

export const DEFAULT_PALETTE: PaletteId = "indigo";

export const PALETTE_IDS = new Set<string>(PALETTES.map((p) => p.id));

export function paletteById(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
}
