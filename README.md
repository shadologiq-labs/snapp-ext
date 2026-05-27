[✦ ShadoLogiq Labs](https://shadologiq.com) · [SNapp](https://snapp-ext.shadologiq.com/) · **README** · [CHANGELOG](CHANGELOG.md) · [Source](https://github.com/shadologiq-labs/snapp-ext)

---

> 👉 **Looking for the SNapp product page?** Visit **[snapp-ext.shadologiq.com](https://snapp-ext.shadologiq.com/)** — the friendlier intro to what SNapp does.
>
> This README is for contributors and folks self-building from source. SNapp is currently in rebrand under ShadoLogiq Labs; a public release is on the way.

# SNapp

Context-aware browser extension for ServiceNow: right-click any record form to copy richly formatted links or inject standard change templates. Automatically surfaces extracted links and email contacts from form fields in the Related Links panel.

**Supports:** Chrome, Edge, Firefox (Manifest V3)

## Features

### Extracted Links & Email Contacts (automatic)
Scans all input and textarea fields on a ServiceNow form every 2.5 seconds and injects a panel into the Related Links area listing any discovered URLs and email addresses.

- **Extracted Links** — clickable links that open in a new tab. Labels are inferred from the URL: GitHub, Jira, Confluence, Microsoft links get friendly names; ServiceNow `.do` record links are labeled as "View \<Table\> Record"; other URLs show the hostname.
- **Email Contacts** — `mailto:` links for each discovered email, labeled by display name (e.g. `jdoe@example.com` → "Email Jdoe").
- Panel sections hide automatically when no matching content is present. The entire panel is hidden when there is nothing to show.
- Controlled via the extension **Settings** page (enabled by default). Access it from the browser's extension manager or by right-clicking the extension icon → **Options**.

Right-click inside any ServiceNow record form (on an instance matching `*.service-now.com`) to access the SNapp context menu:

### Copy Link — Record Link Only
Generates a hyperlink using the canonical `nav_to.do` pattern:
```
<a href="https://<instance>/nav_to.do?uri=<table>.do?sys_id=<sys_id>">ANCHOR_TEXT</a>
```

### Copy Link — Record Link: Description
Appends a colon and the record summary:
```
<a href="…">ANCHOR_TEXT</a>: SHORT_OR_TRUNCATED_DESCRIPTION
```
Description selection order:
1. `short_description` or `u_short_description`
2. Else `description` or `u_description` (truncated to 120 chars + `...`)
3. If the chosen short description equals `CD Task:` then append the Git URL from `u_cd_git_url`.

### Change Link: Multi Data (change_request only)
Outputs state, type, geography, description, dates, CI, requested_by, assigned_to:
```
<a href="…">ANCHOR_TEXT</a> - STATE TYPE - GEOGRAPHIES: DESCRIPTION ― START → END` [For: CI] @REQUESTED_BY @ASSIGNED_TO
```
Notes:
- The literal backtick before the second segment is intentional (visual delimiter in chat tools).
- Dates use first 10 chars of `start_date` and `end_date` (YYYY-MM-DD). Missing values show `?`.
- `state` and `type` are uppercased; `requested_by` and `assigned_to` have whitespace stripped (so `Jane Doe` becomes `JaneDoe`) for `@mention` use in Slack.
- If the record has no description and no dates, only the anchor + second segment is emitted.

### Incident Link: Multi Data (incident only)
Two modes:

1. **Major Incident** (`u_major_incident_short_descrip` present):
```
<a href="…">ANCHOR_TEXT</a> - STATE PRIORITY - GEOGRAPHIES: MAJOR_INCIDENT_SHORT [For: CI]<br>RESOLUTION_LINES<br>Slack Channel: #<anchor-lowercased>*
```
The `Slack Channel: #...*` trailer is appended only when resolution content is present. The channel name is the anchor text lowercased, suffixed with `*`.

2. **Normal incident** (no `u_major_incident_short_descrip`):
```
<a href="…">ANCHOR_TEXT</a> - STATE PRIORITY - GEOGRAPHIES: DESCRIPTION [For: CI] @AFFECTED_USER
```
Falls back to anchor only when no description is available.

Priority mapping: `priority` raw values `1`–`5` are rendered as `S1`–`S5` when a display label is not already provided by the form.

Resolution handling:
- Takes `u_resolution_description`, drops blank lines, preserves existing `<br>` tags, joins remaining lines with `<br>`.
- Label rewrites applied before line splitting: `Business Impact:` → `Impact:`, `Actions Taken:` → `Status:`.
- Resolution block is appended after the header, separated by a single `<br>`.

### Inject Text: Global Change Template (change_request only)
Prepends standardized bullet-point templates to five `change_request` fields. Existing content is preserved — templates are added to the top, not used as replacements.

| Form field (id)                        | Template purpose                                       |
|----------------------------------------|--------------------------------------------------------|
| `change_request.description`           | Change narrative, scope, leaders, reviewers, impact    |
| `change_request.u_reason_for_change`   | Business / scheduling justification, resiliency, risks |
| `change_request.test_plan`             | Deployment plan (despite the field name)               |
| `change_request.change_plan`           | Validation plan (despite the field name)               |
| `change_request.backout_plan`          | Backout / rollback plan                                |

`test_plan` and `change_plan` are intentionally mapped to deployment and validation content; this matches the org's process labels, not the ServiceNow field names.

**Re-injection guard:** injection is skipped if the field already starts with the full template or its first line (the header). To force re-injection, clear the first line of the field.

Templates are oriented toward a specific org's change-management process. Edit `InjectText.templates` in `src/background.js` to customize.

## Anchor Text Selection
The extension chooses a stable identifier rather than always using the record number:

- **Standard tables:** `number` → `u_name` → `name` → `sys_id`
- **Service / Business tables** (name contains "service" or "business"): `name` → `u_name` → `sys_id` (number intentionally skipped)

## Settings
Access via the browser's extension manager (Chrome: right-click icon → **Options**; Firefox: `about:addons` → SNapp → **Preferences**).

| Setting | Default | Description |
|---------|---------|-------------|
| Extracted Links & Email Contacts | Enabled | Toggle the automatic link/email panel on all ServiceNow forms |

Settings persist via `chrome.storage.local` and take effect immediately in all open tabs — no page reload needed.

## Permissions
Minimal MV3 permissions:
- `contextMenus`
- `scripting`
- `storage` — persists user settings locally; no sync or external transmission
- Host access: `*://*.service-now.com/*`

Clipboard writes use `execCommand` for rich HTML (preferred) with fallback to `navigator.clipboard.writeText` (plaintext). No external network calls; no data exfiltration.

## Installation

### Chrome / Edge
Install from the **Chrome Web Store** (link coming) or load unpacked for development — see [Development](#development) below.

### Firefox
Install from **Firefox Add-ons / AMO** (link coming). Store installation is required for persistence; temporary add-ons loaded via `about:debugging` are removed when the browser closes.

### Microsoft Edge
Use the Chrome Web Store listing or the Chrome build.

## Runtime Behavior
- Context-menu features operate only on record form pages — not list views.
- The linker panel runs on all frames matching `*.service-now.com`; it self-limits to frames containing a ServiceNow form (`gsft_main` or a top-level page with a `.do` form action).
- Badge shows `ERR` only when a real error occurs (ignores benign "no table/sys_id" results from non-form frames). No success badge.
- Badge auto-clears after ~1.2s per tab.

## Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| Badge stuck on ERR | Real error in frame execution | Open DevTools (F12), check console; retry on a form page |
| Missing anchor text | Table lacks number/name/u_name | Falls back to `sys_id`; confirm record is loaded |
| Description empty | All description fields blank | Add `short_description` or `description` to the record |
| HTML formatting lost | Clipboard API fallback used | Expected; plaintext preserves content without tags |
| No injected templates | Header already present | Clear the first line of the field to force re-injection |
| Firefox add-on disappears | Loaded as temporary add-on | Install via AMO for persistence |
| Linker panel not appearing | Feature disabled or no links/emails in fields | Check Settings; panel only shows when content is found |
| Linker panel shows stale data | Poll hasn't fired yet | Updates every 2.5s; wait one tick after editing a field |

## Development

### One-time setup
```bash
git clone https://github.com/shadologiq-labs/snapp-ext && cd snapp-ext
npm install
```

### Build
```bash
npm run build
```
Produces `build/chrome/` and `build/firefox/`. Run after any edit to `src/`.

### Load for testing

**Chrome/Edge:**
1. `chrome://extensions` → enable **Developer mode**
2. Click **Load unpacked** → select `build/chrome/`
3. After edits: `npm run build`, then click the refresh icon on the extension card.

**Firefox:**
1. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on**
2. Navigate to `build/firefox/` and select `manifest.json`
3. After edits: `npm run build`, then click **Reload** in `about:debugging`

Note: Firefox temporary add-ons are removed when the browser closes. For persistent testing, install the signed build from AMO.

### Testing on ServiceNow
1. Navigate to any `*.service-now.com` instance and open a record **form** (not a list view).
2. Right-click anywhere on the form.
3. Choose an item under **SNapp** in the context menu.
4. For copy actions, paste into Slack or any rich-text target to verify formatting.

### Quality commands
| Command              | What it does                                                  |
|----------------------|---------------------------------------------------------------|
| `npm run check`      | Lint + validate + test — run before every commit              |
| `npm run lint`       | ESLint over `src/`, `scripts/`, `tests/`                      |
| `npm run lint:fix`   | Auto-fix what ESLint can                                      |
| `npm run validate`   | Verify manifests, version sync, icon files, lib exports       |
| `npm run test`       | Run unit tests once                                           |
| `npm run test:watch` | Watch mode — reruns affected tests on save                    |
| `npm run test:coverage` | Tests + coverage report                                    |

### Adding a new menu item
1. In `src/background.js`:
   - Add a `MENU_*` id constant at the top.
   - Add a `chrome.contextMenus.create()` call in the `onInstalled` listener.
   - Map the menu id to a mode string in the `onClicked` listener.
   - Add a mode branch in `injectedDispatcher`.
   - If table-specific, update the `onShown` enable/disable block and the click-time validation block.
2. If the mode introduces new pure logic (parsing, normalization, formatting), add it to `src/lib/text.js`, attach it to `SNAPP_LIB`, and add tests in `tests/text.test.js`. The lib is inlined at build time — no runtime import needed.
3. `npm run check` then `npm run build`, reload extension.

### Updating the version
Bump the version in all three places, then rebuild:
- `package.json`
- `manifest.chrome.json`
- `manifest.firefox.json`

Then update `CHANGELOG.md`, tag, and push:
```bash
git tag vX.Y.Z && git push --tags
```
Pushing a tag triggers `release.yml`, which builds and attaches `snapp-chrome-vX.Y.Z.zip` and `snapp-firefox-vX.Y.Z.zip` to a GitHub release automatically.

## Repository Structure
```
snapp/
├── src/
│   ├── background.js         # Extension entry: menus, click handler, injected dispatcher
│   ├── linker-content.js     # Content script: auto-inject extracted links/email panel
│   ├── options.html          # Settings page UI
│   ├── options.js            # Settings page logic (reads/writes chrome.storage.local)
│   ├── lib/
│   │   └── text.js           # Pure transforms inlined into background.js at build time
│   └── icons/                # Extension icons
├── tests/
│   ├── text.test.js          # Vitest unit tests for src/lib/text.js
│   └── linker.test.js        # Vitest unit tests for linker extraction logic
├── scripts/
│   ├── build.js              # Validates, then bundles lib + background.js for each browser
│   └── validate.js           # Manifest/icon/version-sync validator (runs as part of build)
├── build/                    # Generated output (gitignored)
│   ├── chrome/
│   └── firefox/
├── .github/workflows/
│   ├── ci.yml                # Lint → validate → test → build on every push/PR
│   └── release.yml           # Builds and publishes zips on version tags
├── manifest.chrome.json      # Chrome/Edge manifest
├── manifest.firefox.json     # Firefox manifest (includes browser_specific_settings)
├── vitest.config.js
├── .eslintrc.json
└── package.json
```

## Architecture

`background.js` (service worker / background script):
- Registers context menus on install
- On click: probes the active tab for table type, validates the mode, then executes `injectedDispatcher` in all frames
- Aggregates frame results for badge logic (ERR badge auto-clears per tab after 1.2s)

`injectedDispatcher` (runs in the page via `chrome.scripting.executeScript`):
- Resolves table + sys_id from the form DOM and URL
- Builds anchor text per the rules above
- Generates HTML for the selected copy action or injects templates
- Copies via `execCommand` (rich HTML) with `navigator.clipboard.writeText` fallback (plaintext)

`linker-content.js` (persistent content script, all frames):
- Declared in `content_scripts`; runs on `document_idle` for every page on `*.service-now.com`
- Self-limits to frames that contain a ServiceNow form (`gsft_main` or top-level `.do` form)
- Polls every 2.5s: scans all `input` / `textarea` values for URLs and email addresses
- Injects or updates a panel in `ul.related_links_container` (creates the list if absent)
- Reads `linkerEnabled` from `chrome.storage.local` on startup and reacts to `onChanged` events; toggles off/on without a page reload

`options.html` / `options.js` (settings page):
- Single toggle for the linker panel feature
- Writes `linkerEnabled` to `chrome.storage.local`; the content script picks up the change immediately

`src/lib/text.js` (build-time inline):
- Pure string/URL transforms with no DOM dependency
- Inlined ahead of `background.js` at build time; exposed as the `SNAPP_LIB` global
- The only tested code — `tests/text.test.js` covers all exported functions

## Field Logic Summary
| Purpose | Fields (order) |
|---------|----------------|
| Anchor (standard) | number → u_name → name → sys_id |
| Anchor (service/business) | name → u_name → sys_id |
| Short / Desc | short_description → u_short_description → description → u_description |
| Change multi extra | state, type, start_date, end_date, cmdb_ci, requested_by, assigned_to, u_geographies |
| Incident major | u_major_incident_short_descrip, priority, state, u_geographies, cmdb_ci, u_resolution_description |

### Geographies normalization
`u_geographies` is read from (in order): the non-edit list element, the select element, or the display input. The combined region list is uppercased and collapsed:

| Selected regions | Rendered as |
|---|---|
| APLA + EMEA + Greater China + North America | `GLOBAL` |
| APLA + EMEA + North America (no Greater China) | `GLOBAL (Excl Greater China)` |
| Anything else | Uppercased comma-joined list |

## Security & Privacy
No storage of record data outside the immediate copy action. No remote calls. All processing occurs in the page context.

## Contributing
1. Open an issue describing the enhancement or bug.
2. Keep patches focused; include before/after examples when formatting changes.
3. Run `npm run check` before submitting a PR.
4. Follow existing style: plain ES2022+, no runtime dependencies.

## Roadmap
- Optional copy as Markdown or Slack-native formatting
- Configurable truncation length
- User-defined templates via extension storage
- Next Experience (UI16) selector fallbacks
- Expand linker: configurable domain labels, click-to-copy email address

## License
MIT — see `LICENSE`.

---

[✦ ShadoLogiq Labs](https://shadologiq.com) · [SNapp](https://snapp-ext.shadologiq.com/) · **README** · [CHANGELOG](CHANGELOG.md) · [Source](https://github.com/shadologiq-labs/snapp-ext)
