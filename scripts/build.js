#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { validateAll } = require("./validate.js");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const LIB = path.join(SRC, "lib");
const BUILD = path.join(ROOT, "build");

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

// Inline a lib module into a single bundled string. Strips the CommonJS
// `module.exports` tail so the file runs cleanly in a browser context where
// `module` is undefined.
function readLibModule(filename) {
  const raw = fs.readFileSync(path.join(LIB, filename), "utf8");
  return raw.replace(
    /\/\* c8 ignore next \d+ \*\/\s*\n?if \(typeof module[\s\S]*$/m,
    ""
  ).trimEnd() + "\n";
}

// Bundle src/lib/*.js + src/background.js into a single string. Lib modules
// run first so SNAPP_LIB is populated before background.js evaluates.
function bundleBackground() {
  const libFiles = fs
    .readdirSync(LIB)
    .filter((f) => f.endsWith(".js"))
    .sort();
  const libCode = libFiles.map(readLibModule).join("\n");
  const bgCode = fs.readFileSync(path.join(SRC, "background.js"), "utf8");
  const header =
    "// SNapp bundled background script. Source: src/background.js + src/lib/*.\n" +
    "// Do not edit build output; edit src/ and run npm run build.\n\n";
  return header + libCode + "\n" + bgCode;
}

function writeBundle(destDir) {
  fs.writeFileSync(path.join(destDir, "background.js"), bundleBackground());
}

// Bundle src/lib/linker.js + src/linker-content.js into a single content script.
// linker.js defines LINKER_LIB which the content script uses at runtime.
function bundleLinkerContent() {
  const linkerLib = readLibModule("linker.js");
  const contentCode = fs.readFileSync(path.join(SRC, "linker-content.js"), "utf8");
  const header =
    "// SNapp bundled content script. Source: src/linker-content.js + src/lib/linker.js.\n" +
    "// Do not edit build output; edit src/ and run npm run build.\n\n";
  return header + linkerLib + "\n" + contentCode;
}

// Files copied verbatim from src/ into each build target directory
const STATIC_FILES = ["options.html", "options.js"];

function buildTarget(name, manifestSource) {
  console.log("Building " + name + " version...");
  const dir = path.join(BUILD, name);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  writeBundle(dir);
  fs.writeFileSync(path.join(dir, "linker-content.js"), bundleLinkerContent());
  copyDir(path.join(SRC, "icons"), path.join(dir, "icons"));
  for (const f of STATIC_FILES) {
    fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
  }
  fs.copyFileSync(path.join(ROOT, manifestSource), path.join(dir, "manifest.json"));
  console.log(name + " build complete: build/" + name + "/");
}

console.log("Building SNapp for Chrome and Firefox...\n");

// Validate source/manifests before producing build output. validateAll throws
// on any error and writes a report to stdout.
validateAll({ root: ROOT });

buildTarget("chrome", "manifest.chrome.json");
buildTarget("firefox", "manifest.firefox.json");

console.log("\nBuild complete. Load extensions from:");
console.log("   Chrome:  build/chrome/");
console.log("   Firefox: build/firefox/");
