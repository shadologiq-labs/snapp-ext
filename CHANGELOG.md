[✦ ShadoLogiq Labs](https://shadologiq.com) · [SNapp](https://snapp-ext.shadologiq.com/) · [README](README.md) · **CHANGELOG** · [Source](https://github.com/shadologiq-labs/snapp-ext)

---

# Changelog

## v1.0.0 (2026-05-15)

Initial public release. Manifest V3 extension for Chrome, Edge, and Firefox.

### Features

**Context-menu actions on `*.service-now.com` record forms:**
- **Copy Link — Record Only** — clean `<a href="…">ANCHOR</a>` hyperlink
- **Copy Link — Record + Description** — same link with `: short_description` appended (or truncated `description` fallback; special-case `CD Task:` appends `u_cd_git_url`)
- **Change Link: Multi Data** — full change-request summary (state, type, geography, dates, CI, requester, assignee)
- **Incident Link: Multi Data** — incident summary with priority, geography, CI, resolution lines; major-incident mode appends a Slack channel reference
- **Inject Text: Global Change Template** — prepends bullet-point templates to five `change_request` fields with re-injection guard

**Smart anchor-text selection:**
- Standard tables: `number → u_name → name → sys_id`
- Service / Business tables: `name → u_name → sys_id` (skips number)

**Geographies normalization:**
- APLA + EMEA + Greater China + North America → `GLOBAL`
- APLA + EMEA + North America (no GC) → `GLOBAL (Excl Greater China)`
- Anything else → uppercased comma-joined list

**Clipboard:** rich HTML via `execCommand` (preferred), plaintext fallback via `navigator.clipboard.writeText`.

**Privacy:** no storage of record data, no remote calls, no telemetry. All processing happens in-page.

### Permissions
- `contextMenus`
- `scripting`
- Host access: `*://*.service-now.com/*`

### Quality
- ESLint over `src/`, `scripts/`, `tests/`
- Vitest unit tests for all pure transforms in `src/lib/text.js`
- Manifest validator: version sync across `package.json` and both manifests, Chrome↔Firefox permissions parity, referenced icons exist, lib modules export properly
- GitHub Actions CI: lint → validate → test → build on every push/PR
- GitHub Actions release: builds and publishes `snapp-chrome-vX.Y.Z.zip` and `snapp-firefox-vX.Y.Z.zip` on version tags

### Architecture
- `src/background.js` — context menus, click dispatcher, badge logic, frame aggregation
- `src/lib/text.js` — pure string/URL transforms; inlined at build time, also unit-tested via CommonJS export
- Platform-specific manifests merged in by `scripts/build.js`
- Firefox uses `browser_specific_settings.gecko.id` for AMO; Chrome uses `service_worker`

---

[✦ ShadoLogiq Labs](https://shadologiq.com) · [SNapp](https://snapp-ext.shadologiq.com/) · [README](README.md) · **CHANGELOG** · [Source](https://github.com/shadologiq-labs/snapp-ext)
