import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

// Two entry points: the side panel page and the MV3 service worker.
// The worker needs a stable filename because manifest.json refers to it.
export default defineConfig({
  root: resolve(import.meta.dirname, "src"),
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [preact()],
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "chrome120",
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, "src/sidepanel/index.html"),
        "service-worker": resolve(import.meta.dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "service-worker" ? "service-worker.js" : "assets/[name]-[hash].js",
      },
    },
  },
  test: {
    root: import.meta.dirname,
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      // The logic layer; UI components are verified in the browser.
      include: ["src/lib/**", "src/state/**"],
      reporter: ["text-summary", "text"],
    },
  },
});
