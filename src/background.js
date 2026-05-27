// background.js — modular features
// Groups: "Copy Link*", "Inject Text"

const MENU_ROOT            = "snapp-root";
const MENU_COPY_PARENT     = "snapp-copy-parent";
const MENU_COPY_LINK       = "snapp-copy-link";
const MENU_COPY_DESC       = "snapp-copy-desc";
const MENU_SEP_1           = "snapp-sep-1";
const MENU_COPY_CHANGE     = "snapp-copy-change";
const MENU_SEP_2           = "snapp-sep-2";
const MENU_COPY_INCIDENT   = "snapp-copy-incident";
const MENU_INJECT_TEXT = "snapp-inject-text";

const SNAPP_DEBUG = false; // set true to enable verbose console logging
const badgeTimeouts = new Map(); // tabId -> timeoutId

chrome.runtime.onInstalled.addListener(async () => {
  try { await chrome.contextMenus.removeAll(); } catch {}

  // Root Menu
  chrome.contextMenus.create({
    id: MENU_ROOT,
    title: "SNapp",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });

  // Copy Link submenu
  chrome.contextMenus.create({
    id: MENU_COPY_PARENT,
    parentId: MENU_ROOT,
    title: "Copy Link",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });
  chrome.contextMenus.create({
    id: MENU_COPY_LINK,
    parentId: MENU_COPY_PARENT,
    title: "Record Link Only",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });
  chrome.contextMenus.create({
    id: MENU_COPY_DESC,
    parentId: MENU_COPY_PARENT,
    title: "Record Link: Description",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });
  chrome.contextMenus.create({
    id: MENU_SEP_1,
    parentId: MENU_COPY_PARENT,
    type: "separator",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });
  chrome.contextMenus.create({
    id: MENU_COPY_CHANGE,
    parentId: MENU_COPY_PARENT,
    title: "Change Link: Multi Data",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });
  chrome.contextMenus.create({
    id: MENU_SEP_2,
    parentId: MENU_COPY_PARENT,
    type: "separator",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });
  chrome.contextMenus.create({
    id: MENU_COPY_INCIDENT,
    parentId: MENU_COPY_PARENT,
    title: "Incident Link: Multi Data",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });

  // Inject Text submenu
  chrome.contextMenus.create({
    id: MENU_INJECT_TEXT,
    parentId: MENU_ROOT,
    title: "Inject Text: Global Change Template",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.service-now.com/*"]
  });
});

// Shared executor for context menu clicks
async function performMode(tab, mode, info) {
  if (!tab?.id || !mode) return;
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      world: "MAIN",
      func: injectedDispatcher,
      args: [mode, info?.pageUrl || null]
    });
  } catch (err) {
    // If execution failed (e.g., disconnected port), do not display a badge.
    return;
  }
  // Only show an error badge when there is a real error from at least one frame.
  // Ignore benign "no table/sys_id" negatives from non-form frames.
  const frames = results?.map(x => x.result).filter(r => r && typeof r === "object") || [];
  const anyErr = frames.some(r => r.ok === false && r.reason !== "no table/sys_id");
  if (chrome.action?.setBadgeText) {
    const text = anyErr ? "ERR" : "";
    // setBadgeText rejects if the tab was closed before this fires; swallow.
    chrome.action.setBadgeText({ tabId: tab.id, text }).catch(() => {});
    if (text) {
      clearTimeout(badgeTimeouts.get(tab.id));
      badgeTimeouts.set(tab.id, setTimeout(() => {
        badgeTimeouts.delete(tab.id);
        chrome.action.setBadgeText({ tabId: tab.id, text: "" }).catch(() => {});
      }, 1200));
    }
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  const t = badgeTimeouts.get(tabId);
  if (t) {
    clearTimeout(t);
    badgeTimeouts.delete(tabId);
  }
});

// Dynamically enable/disable menu items based on current table
// Chrome MV3 support for onShown is limited but we try anyway
if (chrome.contextMenus?.onShown) {
  chrome.contextMenus.onShown.addListener(async (info, tab) => {
    if (!tab?.id) return;
    
    try {
      const probe = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false }, // Single frame only for speed
        world: "MAIN",
        func: () => {
          const url = new URL(location.href);
          const uri = url.searchParams.get("uri");
          const t = uri ? new URL(uri, url.origin) : url;
          return t.searchParams.get("sysparm_table") ||
                 t.searchParams.get("table") ||
                 ((m) => (m ? m[1] : ""))(t.pathname.match(/\/([a-z0-9_]+)\.do/i)) || null;
        }
      });
      const table = probe?.[0]?.result || null;
      
      // Update menu items - both visible and enabled for better Chrome compatibility
      chrome.contextMenus.update(MENU_COPY_LINK, { enabled: !!table });
      chrome.contextMenus.update(MENU_COPY_DESC, { enabled: !!table });
      chrome.contextMenus.update(MENU_COPY_CHANGE, { enabled: table === "change_request" });
      chrome.contextMenus.update(MENU_COPY_INCIDENT, { enabled: table === "incident" });
      chrome.contextMenus.update(MENU_INJECT_TEXT, { enabled: table === "change_request" });
      
      chrome.contextMenus.refresh();
    } catch (err) {
      // onShown not fully supported in Chrome - fallback to validation on click
    }
  });
}

// Main click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  let mode = null;
  if (info.menuItemId === MENU_COPY_LINK)        mode = "copy.link";
  if (info.menuItemId === MENU_COPY_DESC)        mode = "copy.desc";
  if (info.menuItemId === MENU_COPY_CHANGE)      mode = "copy.change";
  if (info.menuItemId === MENU_COPY_INCIDENT)    mode = "copy.incident";
  if (info.menuItemId === MENU_INJECT_TEXT)      mode = "inject.text";
  if (!mode) return;
  
  // Validate table type before executing (Chrome workaround for missing onShown support)
  try {
    const probe = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      world: "MAIN",
      func: () => {
        const url = new URL(location.href);
        const uri = url.searchParams.get("uri");
        const t = uri ? new URL(uri, url.origin) : url;
        const table =
          t.searchParams.get("sysparm_table") ||
          t.searchParams.get("table") ||
          ((m) => (m ? m[1] : ""))(t.pathname.match(/\/([a-z0-9_]+)\.do/i));
        return table || null;
      }
    });
    const table = probe?.[0]?.result || null;
    
    // Validate mode matches table
    if (mode === "copy.change" && table !== "change_request") return;
    if (mode === "copy.incident" && table !== "incident") return;
    if (mode === "inject.text" && table !== "change_request") return;
  } catch (err) {
    // Proceed anyway if validation fails
  }
  
  await performMode(tab, mode, info);
});


// ---------------- Injected code: dispatcher + modules ----------------
async function injectedDispatcher(mode, pageUrl) {
  // -------- Shared Helpers --------
  // Pure transforms (HTML escaping, geography normalization, anchor selection,
  // resolution parsing, etc.) live in src/lib/text.js and are inlined ahead of
  // this file at build time as the global SNAPP_LIB. The dispatcher only owns
  // the DOM-touching glue here.
  const pageHref = pageUrl || location.href;

  const escapeHtml = SNAPP_LIB.escapeHtml;

  const copy = async (html) => {
    // Prefer rich HTML via execCommand; fallback to plain text clipboard API if that fails.
    let success = false;
    let div, sel;
    try {
      div = document.createElement("div");
      div.contentEditable = "true";
      div.style.position = "fixed";
      div.style.left = "-9999px";
      div.innerHTML = html;
      document.body.appendChild(div);
      const r = document.createRange();
      r.selectNodeContents(div);
      sel = getSelection();
      sel.removeAllRanges(); sel.addRange(r);
      const ok = document.execCommand("copy");
      success = ok;
    } catch (e) {
      // execCommand can throw in some contexts
    } finally {
      try { sel?.removeAllRanges(); } catch {}
      try { div?.remove(); } catch {}
    }
    // If execCommand failed, try plain-text clipboard as last resort
    if (!success && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(SNAPP_LIB.htmlToPlainText(html));
        success = true;
      } catch (e) {
        // clipboard.writeText can fail due to permissions
      }
    }
    return success;
  };

  // ServiceNow DOM access and manipulation functions
  const snDom = {

    // Resolve the current table name from g_form, hidden inputs, or URL

    getTable: () => {
      const byIdVal = id => document.getElementById(id)?.value || "";
      return (
        byIdVal("sys_target") ||
        (typeof window.g_form?.getTableName === "function" ? window.g_form.getTableName() : "") ||
        SNAPP_LIB.resolveTableFromUrl(pageHref) || ""
      );
    },

  // Get the current record sys_id
    getSysId() {
      const v = document.getElementById("sys_uniqueValue")?.value;
      if (v && v !== "-1") return v;
      const form = document.querySelector('form[action*=".do"]');
      const f = form?.querySelector('input[name="sys_id"]')?.value;
      if (f && f !== "-1") return f;
      return SNAPP_LIB.resolveSysIdFromUrl(pageHref || location.href);
    },

  // Get the record number
  // Note: not every table has a number; callers should provide fallbacks.
    getNumber(table) {
      if (typeof window.g_form?.getValue === "function") { 
        try {
          const n = g_form.getValue("number");
          if (n) return n;
        } catch (e) {
          if (SNAPP_DEBUG) console.warn("[SNapp] g_form.getValue(number) failed:", e);
        }
      }
      const ro = document.querySelector(`#sys_readonly\\.${CSS.escape(table)}\\.number`);
      if (ro?.textContent?.trim()) return ro.textContent.trim();
      const inpt = document.querySelector('input[name="number"], #number');
      if (inpt?.value?.trim()) return inpt.value.trim();
      const anyRo = document.querySelector('[id^="sys_readonly."][id$=".number"]');
      if (anyRo?.textContent?.trim()) return anyRo.textContent.trim();
      return "";
    },

  // Get raw field value
    getRaw(table, field) {
      if (typeof window.g_form?.getValue === "function") {
        try {
          const v = g_form.getValue(field);
          if (v) return v;
        } catch (e) {
          if (SNAPP_DEBUG) console.warn(`[SNapp] g_form.getValue(${field}) failed:`, e);
        }
      }
      let el = document.querySelector(`input[name="${field}"], textarea[name="${field}"], #${field}`);
      if (el?.value?.trim()) return el.value.trim();
      el = document.querySelector(`#sys_readonly\\.${CSS.escape(table)}\\.${field}`);
      if (el?.textContent?.trim()) return el.textContent.trim();
      return "";
    },

    // Get display value for choice fields
    // Handles both editable selects and readonly displays.
    getChoiceDisplay(table, field) {
      try {
        const selects = Array.from(document.querySelectorAll("select"));
        for (const s of selects) {
          const id = s.id || "";
          const name = s.name || "";
          if (
            name === field ||
            id === `${table}.${field}` ||
            id.endsWith(`.${field}`) ||
            id === field
          ) {
            const opt = s.querySelector("option[selected], option:checked")
              || (s.selectedIndex >= 0 ? s.options[s.selectedIndex] : null);
            if (opt?.textContent?.trim()) return opt.textContent.trim();
          }
        }
      } catch (e) {}
      try {
        const ro = document.querySelector(`#sys_readonly\\.${CSS.escape(table)}\\.${field}`);
        if (ro?.textContent?.trim()) return ro.textContent.trim();
      } catch (e) {}
      return "";
    },

    // Get field display value
    getDisplay(table, field) {
      const el1 = document.querySelector(`#sys_display\\.original\\.${CSS.escape(table)}\\.${field}`);
      if (el1?.value?.trim()) return el1.value.trim();
      const el2 = document.querySelector(`#sys_display\\.${CSS.escape(table)}\\.${field}`);
      if (el2?.value?.trim()) return el2.value.trim();
      if (typeof window.g_form?.getDisplayValue === "function") {
        try {
          const dv = g_form.getDisplayValue(field);
          if (dv) return dv;
        } catch (e) {
          if (SNAPP_DEBUG) console.warn(`[SNapp] g_form.getDisplayValue(${field}) failed:`, e);
        }
      }
      try { const cd = this.getChoiceDisplay(table, field); if (cd) return cd; } catch {}
      return this.getRaw(table, field) || "";
    },

  // Get short description or description (truncated to 120 chars if using description)
  // Order: short_description or u_short_description, then description or u_description
    getShortOrDescription(table) {
      const truncateDesc = SNAPP_LIB.truncateDesc;

      const appendGitUrlIfCDTask = (shortDesc) => {
        if (String(shortDesc || "").trim() === "CD Task:") {
          const gitUrl = this.getRaw(table, "u_cd_git_url") || "";
          return gitUrl ? `${shortDesc} ${gitUrl}` : shortDesc;
        }
        return shortDesc;
      };

      // List-view fallback removed; rely on form fields only

      // Try g_form short_description then description (truncated)
      if (typeof window.g_form?.getValue === "function") {
        try {
          const sd = g_form.getValue("short_description") || g_form.getValue("u_short_description");
          if (sd) return appendGitUrlIfCDTask(sd);
        } catch (e) {
          if (SNAPP_DEBUG) console.warn("[SNapp] g_form.getValue(short_description) failed:", e);
        }
        try {
          const desc = g_form.getValue("description") || g_form.getValue("u_description");
          if (desc) return truncateDesc(desc);
        } catch (e) {
          if (SNAPP_DEBUG) console.warn("[SNapp] g_form.getValue(description) failed:", e);
        }
      }

      // Read readonly short_description then textarea/input
      const ro =
        document.querySelector(`#sys_readonly\\.${CSS.escape(table)}\\.short_description`) ||
        document.querySelector(`#sys_readonly\\.${CSS.escape(table)}\\.u_short_description`);
      if (ro?.textContent?.trim()) return appendGitUrlIfCDTask(ro.textContent.trim());
      const el =
        document.querySelector('textarea[name="short_description"], #short_description') ||
        document.querySelector('textarea[name="u_short_description"], #u_short_description');
      if (el?.value?.trim()) return appendGitUrlIfCDTask(el.value.trim());

      // Fallback to description field in DOM (readonly then textarea/input) - truncated
      try {
        const roDesc =
          document.querySelector(`#sys_readonly\\.${CSS.escape(table)}\\.description`) ||
          document.querySelector(`#sys_readonly\\.${CSS.escape(table)}\\.u_description`);
        if (roDesc?.textContent?.trim()) return truncateDesc(roDesc.textContent.trim());
      } catch (e) {}
      const elDesc =
        document.querySelector('textarea[name="description"], #description') ||
        document.querySelector('textarea[name="u_description"], #u_description');
      if (elDesc?.value?.trim()) return truncateDesc(elDesc.value.trim());

      return "";
    },

    // Get priority value, falling back to S1-S5 mapping on the raw value.
    getPriority(table) {
      const sel = document.getElementById(`${table}.priority`);
      if (sel && sel.tagName === "SELECT") {
        const opt = sel.querySelector("option[selected]") || sel.querySelector("option:checked") ||
                    (sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null);
        if (opt?.textContent?.trim()) return opt.textContent.trim();
        return SNAPP_LIB.priorityFromRawValue(sel.value);
      }
      return "";
    },

    // Read u_geographies from the form DOM, then collapse to a standardized
    // regional label. See README "Geographies normalization".
    getGeographies(table) {
      const normalize = SNAPP_LIB.normalizeGeographies;
      const nonedit = document.getElementById(`${table}.u_geographies_nonedit`);
      if (nonedit) {
        const toks = Array.from(nonedit.querySelectorAll("a")).map(a => a.textContent?.trim()).filter(Boolean);
        if (toks.length) {
          return normalize(toks.join(", "));
        }
      }
      const sel = document.getElementById(`select_0${table}.u_geographies`);
      if (sel) {
        const toks = Array.from(sel.options).map(o => o.textContent?.trim()).filter(Boolean);
        if (toks.length) {
          return normalize(toks.join(", "));
        }
      }
      const disp = document.getElementById(`sys_display.${table}.u_geographies`);
      if (disp?.value?.trim()) {
        return normalize(disp.value.trim());
      }
      return "";
    },

    // Generate href for record
    hrefFor(table, sysId) {
      return SNAPP_LIB.buildRecordHref(window.location.origin, table, sysId);
    },

    // Determine best anchor text. Rules live in SNAPP_LIB.pickAnchorText; this
    // wrapper supplies the DOM-backed lookups.
    getAnchorText(table) {
      const self = this;
      return SNAPP_LIB.pickAnchorText(table, (kind, field) => {
        if (kind === "sysId") return self.getSysId();
        if (kind === "number") return self.getNumber(table);
        if (kind === "display") return self.getDisplay(table, field);
        if (kind === "raw") return self.getRaw(table, field);
        return "";
      });
    }

  };


  // -------- Feature Modules --------

  // 1) Copy Link
  const CopyLink = {

    link({ text, href }) {
      const anchor = `<a href="${href}">${escapeHtml(text)}</a>`;
      return { html: anchor };
    },

    desc({ table, text, href }) {
      const anchor = `<a href="${href}">${escapeHtml(text)}</a>`;
      const base = snDom.getShortOrDescription(table);
      const html = base ? `${anchor}: ${escapeHtml(base)}` : anchor;
      return { html };
    },

    change({ table, text, href }) {
      const anchor = `<a href="${href}">${escapeHtml(text)}</a>`;
      if (table !== "change_request") {
        const base = snDom.getShortOrDescription(table);
        const html = base ? `${anchor}: ${escapeHtml(base)}` : anchor;
        return { html };
      }
      const base   = snDom.getShortOrDescription(table) || "";
      const sd10   = (snDom.getRaw(table, "start_date") || "").slice(0, 10);
      const ed10   = (snDom.getRaw(table, "end_date")   || "").slice(0, 10);
      const stateV = snDom.getChoiceDisplay(table, "state");
      const typeV  = snDom.getChoiceDisplay(table, "type");
      const geos   = snDom.getGeographies(table);
      const ciV    = snDom.getDisplay(table, "cmdb_ci");
      const reqBy  = snDom.getDisplay(table, "requested_by").replace(/\s+/g, "");
      const asgTo  = snDom.getDisplay(table, "assigned_to").replace(/\s+/g, "");
      const dateSeg = (sd10 || ed10) ? ` ― ${sd10 || "?"} → ${ed10 || "?"}` : "";
      const first = base 
        ? `${anchor} - ${String(stateV).toUpperCase()} ${String(typeV).toUpperCase()} - ${escapeHtml(geos)}: ${escapeHtml(base)}${dateSeg}`
        : `${anchor}${dateSeg}`;
      // Preserve literal backtick at start of second segment as allows easy code formatting on dates in Slack post.
      const second = `\` [For: ${escapeHtml(ciV)}] @${escapeHtml(reqBy)} @${escapeHtml(asgTo)}`;
      const html = first + second;
      return { html };
    },

    incident({ table, text, href }) {
      const anchor  = `<a href="${href}">${escapeHtml(text)}</a>`;
      if (table !== "incident") {
        const base = snDom.getShortOrDescription(table);
        const html = base ? `${anchor}: ${escapeHtml(base)}` : anchor;
        return { html };
      }
      const user    = snDom.getDisplay(table, "u_affected_user").replace(/\s+/g, "");
      const stateV  = snDom.getChoiceDisplay(table, "state");
      const pr      = snDom.getPriority(table);
      const geos    = snDom.getGeographies(table);
      const miShort = snDom.getRaw(table, "u_major_incident_short_descrip") || "";
      const ciV     = snDom.getDisplay(table, "cmdb_ci");
      const resRaw  = snDom.getRaw(table, "u_resolution_description") || "";
      const resHTML = SNAPP_LIB.normalizeResolution(resRaw, escapeHtml);
      // If no major incident short description, fall back to just anchor + (optional) base description.
      if (!miShort) {
        const base = snDom.getShortOrDescription(table); // already truncated if using description fallback
        const html = base ? `${anchor} - ${String(stateV).toUpperCase()} ${escapeHtml(pr)} - ${escapeHtml(geos)}: ${escapeHtml(base)} [For: ${escapeHtml(ciV)}] @${escapeHtml(user)}` : anchor;
        return { html };
      }
      // Full major-incident format
      const html =
        `${anchor} - ${String(stateV).toUpperCase()} ${escapeHtml(pr)} - ${escapeHtml(geos)}: ${escapeHtml(miShort)} [For: ${escapeHtml(ciV)}]` +
        (resHTML ? `<br>${resHTML}<br>Slack Channel: #${String(text).toLowerCase()}*` : "");
      return { html };
    }

  };

  // 2) Inject Text
  const InjectText = {
    
    templates: {
      description: "Summarize the change activity and scope in clear, business-friendly language\n• Change Narrative : \n• Domain Leader (where change work is occurring) : \n• Lead Implementer : \n• Who has peer reviewed the work? : \n• Who/Domain requested the work? : \n• Potentially affected Users/Domains? : \n• Is the potentially affected users/domains aligned with the timing of the change? : \n• Are the affected users engaged and planned to be in the meeting during the change? : \n\n\n",
      justification: "Business Justification\n• What is the benefit of this change to Nike (i.e. financial, functional consumer, security, etc include data) : \n\nScheduling Justification\n• Why is the change scheduled for this time? : \n• For changes scheduled during any RCW/Freeze periods : \n\t▪ Why does this change need to be deployed now? : \n\t▪ What is the impact of deferring the change? : \n\nResiliency\n• How has this change been scaled to support high peak traffic? : \n• Explain the resiliency inherent in the service to limit impact? : \n\nSummary of Risks & Known Impacts\n• Risk rating and why it was selected - Low, Medium, High : \n• What risks to systems/operations could this change create? : \n• If there are impacts to support, has the necessary front line support teams been engaged and completed KT? : \n• What are the upstream and downstream dependencies? : \n\n\n",
      deploymentPlan: "Technical explanation of the change activity\n• Describe how this change will be deployed (scripts, commands, physical installs) : \n• Rollout schedule of tasks, dependencies, and communications : \n\n\n",
      validationPlan: "• What type of service validation is done before and after the change? : \n• If additional teams are needed to validate the change, please list the team name(s) and point(s) of contact : \n• Success criteria : \n• Monitoring plans : \n\n\n",
      backoutPlan: "• If the change does not go according to plan, how long before the Rollback plan is implemented? : \n• Describe how this change will be rolled back (scripts, commands, physical uninstall)? : \n• How long is the rollback plan expected to take to execute? : \n\n\n"
    },
    
    targets: [
      { id: "change_request.description",              key: "description"   },
      { id: "change_request.u_reason_for_change",      key: "justification" },
      { id: "change_request.test_plan",                key: "deploymentPlan" },
      { id: "change_request.change_plan",              key: "validationPlan" },
      { id: "change_request.backout_plan",             key: "backoutPlan"   }
    ],
    
    getVal(fullId) {
      const fld = fullId.split(".")[1];
      if (window.g_form?.getValue) { try { return String(g_form.getValue(fld) ?? ""); } catch {} }
      return document.getElementById(fullId)?.value
          || document.querySelector(`textarea[name="${fld}"]`)?.value
          || "";
    },
    
    setVal(fullId, val) {
      const fld = fullId.split(".")[1];
      let ok = false;
      if (window.g_form?.setValue) { try { g_form.setValue(fld, val); ok = true; } catch {} }
      const el = document.getElementById(fullId) || document.querySelector(`textarea[name="${fld}"]`);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        ok = true;
      }
      return ok;
    },
    
    run(table) {
      if (table !== "change_request") return { ok:false, reason:"not change_request" };
      let updated = 0;
      for (const { id, key } of this.targets) {
        const tmpl = this.templates[key];
        const cur  = this.getVal(id) || "";
        if (!SNAPP_LIB.isTemplateAlreadyApplied(cur, tmpl) && this.setVal(id, tmpl + cur)) {
          updated++;
        }
      }
      return { ok: updated > 0, updated };
    }

  };

  // -------- Dispatcher --------
  // Wait for page to be fully ready (especially for Firefox on first use)
  if (document.readyState !== "complete") {
    await new Promise(resolve => {
      if (document.readyState === "complete") {
        resolve();
      } else {
        window.addEventListener("load", resolve, { once: true });
        // Fallback timeout in case load never fires
        setTimeout(resolve, 100);
      }
    });
  }
  
  // Give g_form a moment to initialize if present
  if (typeof window.g_form !== "undefined" && !window.g_form.isInitialized?.()) {
    await new Promise(r => setTimeout(r, 50));
  }
  
  const table = snDom.getTable();
  const sysId = snDom.getSysId();
  if (!table || !sysId) return { ok:false, reason:"no table/sys_id" };
  const text = snDom.getAnchorText(table);
  if (!text) return { ok:false, reason:"no anchor text" };
  const href = snDom.hrefFor(table, sysId);

  if (mode === "copy.link") {
    const { html } = CopyLink.link({ table, text, href });
    return { ok: await copy(html), mode };
  }

  if (mode === "copy.desc") {
    const { html } = CopyLink.desc({ table, text, href });
    return { ok: await copy(html), mode };
  }

  if (mode === "copy.change") {
    const { html } = CopyLink.change({ table, text, href });
    return { ok: await copy(html), mode };
  }

  if (mode === "copy.incident") {
    const { html } = CopyLink.incident({ table, text, href });
    return { ok: await copy(html), mode };
  }

  if (mode === "inject.text") {
    const res = InjectText.run(table);
    return { ok: !!res.ok, updated: res.updated ?? 0, mode };
  }

  return { ok:false, reason:"unknown mode" };

}
