#!/usr/bin/env node

// Validates SNapp's static assets before build. Catches the kinds of mistakes
// that won't surface until the extension is loaded into a browser:
//   - manifest versions drift between manifest.chrome.json,
//     manifest.firefox.json, and package.json
//   - host_permissions / permissions arrays diverge between Chrome and Firefox
//   - referenced icon files are missing on disk
//   - src/lib/*.js is missing the CommonJS export tail (would break tests)

const fs = require("fs");
const path = require("path");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function collectIcons(manifest) {
  const out = [];
  if (manifest.icons) out.push(...Object.values(manifest.icons));
  if (manifest.action && manifest.action.default_icon) {
    const di = manifest.action.default_icon;
    if (typeof di === "string") out.push(di);
    else out.push(...Object.values(di));
  }
  return out;
}

function validateAll({ root }) {
  const errors = [];
  const warn = (msg) => console.warn("  warn: " + msg);

  const pkg = readJson(path.join(root, "package.json"));
  const chromeManifest = readJson(path.join(root, "manifest.chrome.json"));
  const firefoxManifest = readJson(path.join(root, "manifest.firefox.json"));

  // Version sync across the three authoritative files.
  const versions = {
    "package.json": pkg.version,
    "manifest.chrome.json": chromeManifest.version,
    "manifest.firefox.json": firefoxManifest.version,
  };
  const unique = new Set(Object.values(versions));
  if (unique.size > 1) {
    errors.push(
      "Version mismatch across files: " +
        Object.entries(versions)
          .map(([k, v]) => k + "=" + v)
          .join(", ")
    );
  }

  // Permissions parity between Chrome and Firefox manifests. The two are
  // allowed to differ in `background.*` (service_worker vs scripts) and in
  // browser_specific_settings, but permissions and host_permissions must match.
  const arrEq = (a, b) =>
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((v, i) => v === b[i]);
  if (!arrEq(chromeManifest.permissions, firefoxManifest.permissions)) {
    errors.push("permissions[] differs between Chrome and Firefox manifests");
  }
  if (!arrEq(chromeManifest.host_permissions, firefoxManifest.host_permissions)) {
    errors.push("host_permissions[] differs between Chrome and Firefox manifests");
  }

  // Icon files referenced by each manifest must exist relative to src/.
  for (const [label, m] of [
    ["manifest.chrome.json", chromeManifest],
    ["manifest.firefox.json", firefoxManifest],
  ]) {
    for (const icon of collectIcons(m)) {
      const iconPath = path.join(root, "src", icon);
      if (!fs.existsSync(iconPath)) {
        errors.push(label + " references missing icon: " + icon);
      }
    }
  }

  // src/lib must exist and every .js module must export via CommonJS so the
  // test runner can load it. The build step strips this tail for the bundle.
  const libDir = path.join(root, "src", "lib");
  if (!fs.existsSync(libDir)) {
    errors.push("src/lib/ directory is missing");
  } else {
    const libFiles = fs.readdirSync(libDir).filter((f) => f.endsWith(".js"));
    if (libFiles.length === 0) {
      warn("src/lib/ is empty");
    }
    for (const f of libFiles) {
      const contents = fs.readFileSync(path.join(libDir, f), "utf8");
      if (!/module\.exports\s*=/.test(contents)) {
        errors.push("src/lib/" + f + " is missing a CommonJS module.exports");
      }
    }
  }

  if (errors.length) {
    console.error("\nValidation failed:");
    for (const e of errors) console.error("  - " + e);
    throw new Error("Validation failed (" + errors.length + " error(s))");
  }
  console.log("Validation passed (version " + pkg.version + ").");
}

if (require.main === module) {
  try {
    validateAll({ root: path.resolve(__dirname, "..") });
  } catch (e) {
    process.exit(1);
  }
}

module.exports = { validateAll };
