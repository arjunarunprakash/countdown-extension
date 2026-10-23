// Packages dist/ as the ZIP to upload to the Chrome Web Store.
// Run with `npm run package` (it builds first); output goes to release/.
// Refuses to package a build that would be rejected or shouldn't ship:
// mismatched versions, source maps, or the dev-only axe audit script.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const problems = [];
if (manifest.version !== pkg.version) {
  problems.push(`manifest.json version ${manifest.version} doesn't match package.json ${pkg.version}`);
}
if (manifest.description.length > 132) problems.push("manifest description is over 132 characters");

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(relative(dist, path));
  }
};
walk(dist);
for (const file of files) {
  if (file.endsWith(".map")) problems.push(`source map in build: ${file}`);
  if (file === "axe.min.js") problems.push("dev-only axe.min.js in build (run a production build)");
  if (file.endsWith(".DS_Store")) problems.push(`stray file: ${file}`);
}
for (const size of ["16", "32", "48", "128"]) {
  if (!existsSync(join(dist, manifest.icons[size]))) problems.push(`missing icon ${manifest.icons[size]}`);
}

if (problems.length) {
  console.error(`Not packaged:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}

mkdirSync(join(root, "release"), { recursive: true });
const zip = join(root, "release", `countdown-v${manifest.version}.zip`);
rmSync(zip, { force: true });
// -X leaves out macOS extra attributes; paths are relative to dist/ so
// manifest.json sits at the ZIP's root, as the store requires.
execFileSync("zip", ["-r", "-X", "-q", zip, "."], { cwd: dist });
const kb = Math.round(statSync(zip).size / 1024);
console.log(`Packaged ${relative(root, zip)} (${files.length} files, ${kb} KB)`);
