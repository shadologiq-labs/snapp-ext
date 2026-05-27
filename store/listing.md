# SNapp — Store Listing Copy

## Tagline

**Working to make the tedious a snap!**

## Short description (132 chars max — used by both stores)

Right-click any ServiceNow record to instantly copy rich formatted links or inject standard change templates.

---

## Chrome Web Store — Detailed description

**SNapp — working to make the tedious a snap!**

Most ServiceNow extensions are built for admins. SNapp is built for everyone else — the people filing change requests, triaging incidents, and chasing down records all day.

**What it does**

Right-click anywhere on a ServiceNow record form to get the SNapp menu:

• **Copy Link — Record Only**
  Copies a clean `<a href="…">CHG1234567</a>` hyperlink ready to paste into Slack, Teams, or email — no manual URL construction needed.

• **Copy Link — Record with Description**
  Adds a short summary after the link: `<a href="…">CHG1234567</a>: Deploy new auth service`. Falls back gracefully when fields are empty.

• **Change Link: Multi Data**
  One-click summary of a change request — state, type, geography, dates, CI, requester, and assignee — formatted for quick pasting into chat.

• **Incident Link: Multi Data**
  Full incident summary with priority, geography, CI, and resolution notes. Major incidents get a Slack channel trailer automatically.

• **Inject Change Templates**
  Prepends standardized bullet-point templates into five change_request fields (description, reason for change, deployment plan, validation plan, backout plan). Existing content is preserved — templates are added to the top only once.

**Built to stay out of the way**

- Works only on `*.service-now.com` record form pages — not list views, not other sites.
- No storage of record data. No network calls outside the page. No telemetry.
- Badge shows `ERR` only when something actually fails; clears automatically after ~1.2 seconds.
- Minimal permissions: `contextMenus`, `scripting`, and host access to `*.service-now.com`.

**Coming soon**

- **User scripts** — run your own JavaScript snippets against the active record form to automate repetitive cleanups, fill-ins, or validations.
- **Keyboard shortcuts** — trigger the most common copy and inject actions without leaving the keyboard.

**Open source** — github.com/shadologiq-labs/snapp-ext

---

## Firefox Add-ons (AMO) — Summary (up to 250 chars)

Right-click any ServiceNow record to copy rich formatted links (with description, state, dates, CI) or inject standard change templates — in a SNapp. No storage, no telemetry.

## Firefox Add-ons (AMO) — Full description

**SNapp — working to make the tedious a snap!**

Most ServiceNow extensions are built for admins. SNapp is built for the people who use ServiceNow every day — filing change requests, triaging incidents, and chasing down records.

**Right-click menu on any record form:**

**Copy Link — Record Only**
A clean hyperlink (`<a href="…">CHG1234567</a>`) ready to paste into Slack, Teams, or email.

**Copy Link — Record with Description**
Same link with a short summary appended: `<a href="…">CHG1234567</a>: Deploy new auth service`.

**Change Link: Multi Data**
Full change summary — state, type, geography, start/end dates, CI, requester, assignee — in one paste.

**Incident Link: Multi Data**
Incident summary with priority, geography, CI, and resolution. Major incidents append a Slack channel reference automatically.

**Inject Change Templates**
Prepends bullet-point templates to five change_request fields. Existing content is preserved; templates are added once and only once.

**Coming soon**
- **User scripts** — run your own JavaScript snippets against the active record form for repetitive cleanups, fill-ins, and validations.
- **Keyboard shortcuts** — fire common copy and inject actions without leaving the keyboard.

**Privacy**
No data leaves the page. No storage, no telemetry, no external calls. Operates only on `*.service-now.com` record forms.

**Permissions used:** `contextMenus`, `scripting`, and host access to `*.service-now.com`.

Source: github.com/shadologiq-labs/snapp-ext

---

## Tags / Categories

Chrome Web Store category: **Productivity**
AMO category: **Productivity**

Suggested tags: servicenow, itsm, change management, incident, productivity, clipboard
