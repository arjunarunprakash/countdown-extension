import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTES } from "../src/lib/palettes";

// styles/tokens.css and lib/palettes.ts describe the same palettes (CSS for the
// panel, TS for the toolbar icon and swatches). This keeps them identical.
const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");

/** The --p-* primitives a palette ends up with: Indigo's defaults, then its own block. */
function primitives(id: string): Record<string, string> {
  const read = (block: string) => Object.fromEntries([...block.matchAll(/(--p-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
  const root = css.match(/:root \{[^}]*--p-accent-l[^}]*\}/)![0];
  const own = id === "indigo" ? "" : [...css.matchAll(new RegExp(`:root\\[data-palette="${id}"\\] \\{([^}]*)\\}`, "g"))].map((m) => m[1]).join("");
  return { ...read(root), ...read(own) };
}
const rgba = ([r, g, b, a]: readonly number[]) => (a === 0 ? "transparent" : `rgb(${r} ${g} ${b} / ${a})`);

describe("palettes", () => {
  it.each(PALETTES.map((p) => [p.id, p] as const))("%s matches tokens.css", (id, p) => {
    const v = primitives(id);
    for (const [mode, s] of [["l", p.light], ["d", p.dark]] as const) {
      expect(v[`--p-accent-${mode}`]).toBe(s.accent);
      expect([v[`--p-grad-1-${mode}`], v[`--p-grad-2-${mode}`]]).toEqual([...s.gradient]);
      expect(v[`--p-bg-${mode}`]).toBe(s.bg);
      s.glows.forEach((g, i) => expect(v[`--p-glow-${i + 1}-${mode}`]).toBe(rgba(g)));
    }
    expect(v["--p-on-accent-l"]).toBe(p.light.onAccent ?? "#ffffff");
  });

  it("has unique ids and names", () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    expect(new Set(PALETTES.map((p) => p.name)).size).toBe(PALETTES.length);
  });
});
