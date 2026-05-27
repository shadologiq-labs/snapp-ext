// Pure helpers for linker-content.js. No DOM, no browser APIs.
// At build time these are prepended to the content script bundle.

const LINKER_LIB = {};

LINKER_LIB.DOMAIN_LABELS = {
  "github.com":    "GitHub Repo",
  "jira":          "Jira Ticket",
  "confluence":    "Wiki Page",
  "microsoft.com": "MS Document",
};

// Return a human-readable label for a URL. Falls back to hostname + "..."
// for unrecognized domains, or "External Link" when the URL is unparseable.
LINKER_LIB.getLinkLabel = function (url, domainLabels) {
  const labels = domainLabels || LINKER_LIB.DOMAIN_LABELS;
  try {
    const u = new URL(url);
    if (u.pathname.endsWith(".do")) {
      const m = u.pathname.match(/\/([a-z_]+)\.do/);
      if (m) {
        const name = m[1].replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        return "View " + name + " Record";
      }
    }
    for (const [key, label] of Object.entries(labels)) {
      if (u.hostname.includes(key)) return label;
    }
    return u.hostname.replace("www.", "") + (u.pathname.length > 1 ? "..." : "");
  } catch {
    return "External Link";
  }
};

// Extract all http/https URLs and email addresses from a plain-text string value.
// Filters out the base origin and ServiceNow nav_to.do navigation URLs.
// Returns { urls: Set<string>, emails: Set<string> }.
LINKER_LIB.extractFromText = function (text, baseOrigin) {
  const urls   = new Set();
  const emails = new Set();
  const base   = String(baseOrigin || "").replace(/[/\s]+$/, "");
  const uMatches = String(text || "").match(/(https?:\/\/[^\s,<>"]+)/g);
  if (uMatches) {
    uMatches.forEach(u => {
      const clean = u.replace(/[/\s]+$/, "");
      if (clean !== base && !u.includes("/nav_to.do")) urls.add(u);
    });
  }
  const eMatches = String(text || "").match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
  if (eMatches) eMatches.forEach(e => emails.add(e));
  return { urls, emails };
};

// Format an email local-part into a display name.
// "j.doe_smith-r" -> "J Doe Smith R"
LINKER_LIB.emailDisplayName = function (email) {
  return email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
};

/* c8 ignore next 3 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = LINKER_LIB;
}
