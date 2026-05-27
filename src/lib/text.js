// Pure text transforms used by injectedDispatcher. No DOM, no browser APIs.
// These are extracted so they can be unit-tested in Node. At build time they
// are inlined back into background.js (see scripts/build.js).

const SNAPP_LIB = {};

SNAPP_LIB.escapeHtml = function (s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

SNAPP_LIB.truncateDesc = function (text) {
  const trimmed = String(text || "").trim();
  return trimmed.length > 120 ? trimmed.slice(0, 120) + "..." : trimmed;
};

// Collapse a region list into standardized labels.
// APLA + EMEA + Greater China + North America => GLOBAL
// APLA + EMEA + North America (no Greater China) => GLOBAL (Excl Greater China)
// Otherwise: the input uppercased.
SNAPP_LIB.normalizeGeographies = function (val) {
  const U = String(val || "").toUpperCase();
  const hasAPLA = U.includes("APLA");
  const hasEMEA = U.includes("EMEA");
  const hasGC = U.includes("GREATER CHINA");
  const hasNA = U.includes("NORTH AMERICA");
  if (hasAPLA && hasEMEA && hasGC && hasNA) return "GLOBAL";
  if (hasAPLA && hasEMEA && hasNA) return "GLOBAL (Excl Greater China)";
  return U;
};

// Map an incident priority raw value (1..5) to S1..S5. Returns "" for anything
// outside that set so callers can fall back to a display label.
SNAPP_LIB.priorityFromRawValue = function (v) {
  const map = { "1": "S1", "2": "S2", "3": "S3", "4": "S4", "5": "S5" };
  return map[String(v ?? "").trim()] || "";
};

// Apply the SNapp resolution-text normalization:
//  1. Preserve existing <br> tags through line-splitting via a placeholder.
//  2. Rewrite labels: "Business Impact:" -> "Impact:", "Actions Taken:" -> "Status:".
//  3. Split on newlines, drop blank lines.
//  4. HTML-escape each surviving line, join with <br>, restore <br> placeholders.
// escapeHtml is injected so this stays a pure function and tests can verify
// escaping interplay without re-wiring the helper.
SNAPP_LIB.normalizeResolution = function (resRaw, escapeHtml) {
  const BR = "___SNAPP_BR___";
  const preserved = String(resRaw || "").replace(/<br\s*\/?>/gi, BR);
  const replaced = preserved
    .replace(/Business Impact:/g, "Impact:")
    .replace(/Actions Taken:/g, "Status:");
  const lines = replaced.split(/\r\n|\r|\n/).map((l) => (l || "").trim());
  const nonEmpty = lines.filter((l) => l !== "");
  if (!nonEmpty.length) return "";
  return nonEmpty
    .map((l) => escapeHtml(l))
    .join("<br>")
    .replace(new RegExp(BR, "g"), "<br>");
};

// Decide whether an Inject Text template should be re-injected. Returns true
// if `current` already contains the template (full body match) or starts with
// the template's first line (header match used as a cheap dedupe).
SNAPP_LIB.isTemplateAlreadyApplied = function (current, template) {
  const cur = String(current || "");
  const tmpl = String(template || "");
  if (!tmpl) return true;
  if (cur.startsWith(tmpl)) return true;
  const header = tmpl.split("\n", 1)[0];
  return !!header && cur.startsWith(header);
};

// Pick the anchor text for a record per SNapp's rules. The DOM lookups are
// passed in as a `lookup` callback so this stays pure. `lookup(kind, field)`
// returns "" when missing. `kind` is one of: "number", "display", "raw", "sysId".
//  - Service/Business tables (name contains "service" or "business"):
//    name -> u_name -> sys_id (number skipped entirely).
//  - Standard tables:
//    number -> u_name -> name -> sys_id.
SNAPP_LIB.pickAnchorText = function (table, lookup) {
  const t = String(table || "").toLowerCase();
  const display = (field) => lookup("display", field) || lookup("raw", field);
  if (t.includes("service") || t.includes("business")) {
    const nameFirst = display("name");
    if (nameFirst) return nameFirst;
    const uName = display("u_name");
    if (uName) return uName;
    return lookup("sysId") || "";
  }
  const n = lookup("number");
  if (n) return n;
  const uName = display("u_name");
  if (uName) return uName;
  const name = display("name");
  if (name) return name;
  return lookup("sysId") || "";
};

// Build the canonical nav_to.do URL SNapp uses for record links.
SNAPP_LIB.buildRecordHref = function (origin, table, sysId) {
  return (
    origin +
    "/nav_to.do?uri=" +
    encodeURIComponent(
      table +
        ".do?sys_id=" +
        sysId +
        "&sysparm_userpref." +
        table +
        ".view=&sysparm_userpref." +
        table +
        "_list.view="
    )
  );
};

// Resolve a table name from a page URL string. Returns "" when no table can be
// determined. Encapsulates the URL inspection used by both the background
// script (validation) and the injected dispatcher (table resolution).
SNAPP_LIB.resolveTableFromUrl = function (pageUrl) {
  try {
    const url = new URL(pageUrl);
    const uri = url.searchParams.get("uri");
    const t = uri ? new URL(uri, url.origin) : url;
    const fromParam =
      t.searchParams.get("sysparm_table") || t.searchParams.get("table");
    if (fromParam) return fromParam;
    const m = t.pathname.match(/\/([a-z0-9_]+)\.do/i);
    return m ? m[1] : "";
  } catch (e) {
    return "";
  }
};

// Resolve a sys_id from a page URL string. Returns "" when none / "-1".
SNAPP_LIB.resolveSysIdFromUrl = function (pageUrl) {
  try {
    const url = new URL(pageUrl);
    const uri = url.searchParams.get("uri");
    const t = uri ? new URL(uri, url.origin) : url;
    const sysId =
      t.searchParams.get("sysparm_sys_id") || t.searchParams.get("sys_id");
    return sysId && sysId !== "-1" ? sysId : "";
  } catch (e) {
    return "";
  }
};

// Strip HTML from a string for the clipboard plaintext fallback.
SNAPP_LIB.htmlToPlainText = function (html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

// CommonJS export for the test runner. The build step strips this line when
// inlining into background.js (which runs as a service worker / page script
// where `module` is undefined).
/* c8 ignore next 3 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = SNAPP_LIB;
}
