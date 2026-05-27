// linker-content.js — auto-injects extracted links/emails panel into SN forms
// Runs as a persistent content script on *.service-now.com pages.
// Controlled by the "linkerEnabled" key in chrome.storage.local (default: true).
// Pure helpers (getLinkLabel, extractFromText, emailDisplayName) live in
// src/lib/linker.js and are prepended by the build step as LINKER_LIB.

(function () {
  const PANEL_ID = "snapp-linker";
  const POLL_MS  = 2500;

  let enabled = true; // overridden by storage read below
  let intervalId = null;

  // -------- helpers (delegated to LINKER_LIB, injected at build time) --------

  function getLinkLabel(url) {
    return LINKER_LIB.getLinkLabel(url);
  }

  function extractFromInputs(doc) {
    const urls   = new Set();
    const emails = new Set();
    doc.querySelectorAll("input, textarea").forEach(field => {
      const { urls: u, emails: e } = LINKER_LIB.extractFromText(field.value, location.origin);
      u.forEach(x => urls.add(x));
      e.forEach(x => emails.add(x));
    });
    return { urls, emails };
  }

  // -------- panel creation --------

  function buildPanel(doc) {
    // Find or create the related-links container
    let container = doc.querySelector("ul.related_links_container");
    if (!container) {
      const wrapper = doc.createElement("div");
      wrapper.className = "related-links-wrapper";
      wrapper.innerHTML = '<ul class="related_links_container list-unstyled"></ul>';
      const anchor = doc.querySelector(".form_body") || doc.querySelector("form") || doc.body;
      anchor.appendChild(wrapper);
      container = wrapper.querySelector("ul");
    }

    const li = doc.createElement("li");
    li.id = PANEL_ID;
    // Separator styling when other items exist above
    li.style.cssText = container.children.length > 0
      ? "margin-top:12px;border-top:1px solid #e6e8ea;padding-top:8px;"
      : "margin-top:0;padding-top:0;";

    li.innerHTML =
      `<div id="${PANEL_ID}-u-s">` +
        `<h2 class="related_links h4" style="margin:0;padding:0;line-height:1.2;">Extracted Links</h2>` +
        `<div id="${PANEL_ID}-u" style="margin-top:2px;margin-bottom:12px;"></div>` +
      `</div>` +
      `<div id="${PANEL_ID}-e-s">` +
        `<h2 class="related_links h4" style="margin:0;padding:0;line-height:1.2;">Email Contacts</h2>` +
        `<div id="${PANEL_ID}-e" style="margin-top:2px;"></div>` +
      `</div>`;

    container.appendChild(li);
    return li;
  }

  // -------- panel update --------

  function renderLinks(doc) {
    if (!enabled) return;

    // Only run on form frames (gsft_main) or top-level tabs with a form
    // Only process frames that contain a ServiceNow form
    const isMainFrame   = window.name === "gsft_main";
    const isTopWithForm = window === window.top && !!doc.querySelector("form[action*='.do']");
    if (!isMainFrame && !isTopWithForm) return;

    const { urls, emails } = extractFromInputs(doc);

    // Create panel on first run
    let panel = doc.getElementById(PANEL_ID);
    if (!panel) {
      // Only create when there's actually something to show (avoids phantom panels)
      if (urls.size === 0 && emails.size === 0) return;
      panel = buildPanel(doc);
    }

    // Show/hide whole panel
    panel.style.display = (urls.size + emails.size) > 0 ? "block" : "none";

    // Link section
    const urlSection = doc.getElementById(`${PANEL_ID}-u-s`);
    const urlList    = doc.getElementById(`${PANEL_ID}-u`);
    if (urlSection && urlList) {
      urlSection.style.display = urls.size > 0 ? "block" : "none";
      urlList.innerHTML = Array.from(urls).map(u =>
        `<div style="margin:0;">` +
          `<a class="navigation_link action_context" href="${u}" target="_blank" title="${u}" ` +
            `style="display:inline-block;padding:1px 0;">${getLinkLabel(u)}</a>` +
        `</div>`
      ).join("");
    }

    // Email section
    const emailSection = doc.getElementById(`${PANEL_ID}-e-s`);
    const emailList    = doc.getElementById(`${PANEL_ID}-e`);
    if (emailSection && emailList) {
      emailSection.style.display = emails.size > 0 ? "block" : "none";
      emailList.innerHTML = Array.from(emails).map(e => {
        const name = LINKER_LIB.emailDisplayName(e);
        return (
          `<div style="margin:0;">` +
            `<a class="navigation_link action_context" href="mailto:${e}" title="Email ${e}" ` +
              `style="display:inline-block;padding:1px 0;">Email ${name}</a>` +
          `</div>`
        );
      }).join("");
    }
  }

  function removePanel(doc) {
    doc.getElementById(PANEL_ID)?.remove();
  }

  // -------- poll in all reachable frames --------

  function tick() {
    if (!enabled) return;
    try { renderLinks(document); } catch {}
    // Reach into same-origin iframes (gsft_main lives inside gsft_nav)
    for (let i = 0; i < window.frames.length; i++) {
      try { renderLinks(window.frames[i].document); } catch {}
    }
  }

  // -------- lifecycle --------

  function start() {
    if (intervalId !== null) return;
    tick(); // immediate first run
    intervalId = setInterval(tick, POLL_MS);
  }

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    // Remove any injected panels
    try { removePanel(document); } catch {}
    for (let i = 0; i < window.frames.length; i++) {
      try { removePanel(window.frames[i].document); } catch {}
    }
  }

  function applyEnabled(val) {
    enabled = !!val;
    if (enabled) start(); else stop();
  }

  // -------- storage + init --------

  // Read initial setting then start/stop accordingly
  chrome.storage.local.get({ linkerEnabled: true }, result => {
    applyEnabled(result.linkerEnabled);
  });

  // React to changes made in the options page (even in other tabs)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "linkerEnabled" in changes) {
      applyEnabled(changes.linkerEnabled.newValue);
    }
  });
})();
