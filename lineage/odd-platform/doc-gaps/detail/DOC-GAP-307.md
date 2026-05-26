---
doc_gap_id: DOC-GAP-307
severity: MEDIUM
category: broken-url
batch: ZJ
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-09"           # SPA shell + identity surface
  - "P-04"           # Navigation taxonomy — the 9 tabs are the public face of P-04
related_features: []
related_doc_gaps:
  - DOC-GAP-185      # SPA auth UX silent on enable-security pages (sibling SPA-shell coverage gap)
  - DOC-GAP-186      # Management tab visibility contradicts docs (depends on a UI-shell page existing)
  - DOC-GAP-205      # Dictionary tab UX undocumented (sibling per-tab UX gap)
  - DOC-GAP-020      # Locale Bundle / Multilingual UI missing-page (F-047)
related_retrospectives:
  - LSN-001          # operator-trap canonical (no doc home for the SPA shell)
  - LSN-011          # doc-product coherence not self-detecting
---

## DOC-GAP-307 — `/active-platform-features/ui-overview` is a 404; there is NO canonical doc page anywhere on `docs.opendatadiscovery.org` describing the SPA's chrome — the 9 primary navigation tabs (Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity), the App-Info menu, the language switcher (6 locales), the user-cluster (owner-name fallback + logout), the AppErrorPage error UI, or the application shell as a UX surface — the SPA chrome is OPERATOR-INVISIBLE at the doc-product level

**Severity**: MEDIUM
**Category**: broken-url (the inferred canonical URL 404s) compounded with missing-page (the conceptual content has no home anywhere in `documentation/docs/`)
**Page**: https://docs.opendatadiscovery.org/active-platform-features/ui-overview (404) + structurally absent across the site nav
**Last verified**: 2026-05-26 (WebFetched this session — confirmed 404; GitBook surfaced "page no longer exists" template with link-to-related-pages)

### Surfaced by

- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:docs_link_semantic.inferred_docs[0]` ("WebFetch https://docs.opendatadiscovery.org/active-platform-features/ui-overview 2026-05-26 status 404 — expected canonical home for the application-shell / navigation-chrome documentation") **(NEW batch ZJ — AppToolbar UI-shell sidecar PRIMARY SOURCE)**
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:docs_link_semantic.doc_drift_findings[0]` ("the LIVE 'ui-overview' page does not exist (404 — fetched 2026-05-26); the 9 hardcoded primary tabs are completely undocumented; an operator cannot discover from the docs that Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity are the navigation primitives") **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:docs_link_semantic.doc_drift_findings[4]` ("DRIFT_DOC_NAVIGATION_MODEL: docs.opendatadiscovery.org references 'six governance pillars' in the features overview, but ToolbarTabs renders NINE tabs. The pillar-to-tab mapping is not 1:1 — Catalog + Directory are both Data Discovery; Activity + Alerts are both 'active platform features'; Management is admin-not-pillar. No doc page maps the 9-tab UI to the 6-pillar conceptual model.") **(NEW batch ZJ — ToolbarTabs primary source)**
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:docs_link_semantic.inferred_docs[0]` (live page mentions "the App Info menu (the popup behind the information icon in the top-right toolbar)" only in `odd-platform.md` config reference — passing reference, not a UI-shell doc home) **(NEW batch ZJ)**

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/active-platform-features/ui-overview` 2026-05-26 status **404** (verbatim direct fetch this session): "This page indicates that the URL `active-platform-features/ui-overview` no longer exists. The documentation site provides alternative resources, including a list of related pages about alerting, data collaboration, activity feeds, and GenAI features, along with guidance on using the documentation query interface to find information." — no redirect target; the page was either never authored or was retired without a forwarding.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-26 status **200**: the page mentions the App Info menu in ONE passing sentence ("The platform UI surfaces them inside the App Info menu (the popup behind the information icon in the top-right toolbar).") in the context of `odd.links` configuration — but the page is a config reference, NOT a UI-shell page; it does NOT document the 9 navigation tabs, the language switcher, the user menu, or the shell layout.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` 2026-05-26 status **200** (inherited from sidecar primary source): "(No mention of: app shell, toolbar, navigation bar, logout flow, 'admin' dummy user, DISABLED mode user identity, language selection.)"
- `odd-platform-ui/src/components/App.tsx:56` — primary evidence: `<AppToolbar />` is mounted UNCONDITIONALLY above every route; it is the single application-wide chrome.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppToolbar.tsx:1-123` — 123-line component composing brand block + 9-tab ToolbarTabs + AppInfoMenu + user-cluster (language switcher + logout).
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:34-82` — the 9 tab labels: Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity, hardcoded as a literal array.
- `odd-platform-ui/src/locales/i18n.ts:30` — `fallbackLng: ['en', 'es', 'ch', 'fr', 'ua', 'hy']` — six locales the user can switch between via the language switcher in the user-cluster dropdown.
- Grep `documentation/docs/**/*.md` for "Catalog tab", "Dictionary tab", "Management tab", "language switcher", "App Info menu", "App Info" (this session) — the only hit is the `odd-platform.md` passing reference to App Info; no UI-shell page exists.

### Drift narrative

The Open Data Discovery SPA has a load-bearing chrome that every authenticated user sees on every page: a fixed-position toolbar with 9 navigation tabs, an information-icon popover (App Info menu — Documentation / Slack / Version / Feedback / operator-configured links), a user-cluster with a 6-locale language switcher and a logout link. The chrome is the platform's primary UX. The chrome is **structurally undocumented**.

The natural-fit URL — `/active-platform-features/ui-overview` — is a 404. WebFetching the site root, the features hub, and the configuration-and-deployment pages yields zero pages describing the SPA shell. The closest mention is one passing sentence in the operator-config doc page (`odd-platform.md`) about where `odd.links` surfaces. The 9-tab taxonomy is invisible. The 6-locale support is invisible (sibling DOC-GAP-020 / F-047). The user-name display fallback (`owner?.name ?? identity?.username`) is invisible (sibling DOC-GAP-185). The logout behaviour is invisible (sibling DOC-GAP-185). The AppErrorPage error UI is invisible (sibling DOC-GAP-311 NEW). The bare-base-URL dead-ends are invisible at the SPA shell layer (sibling DOC-GAP-300 / DOC-GAP-301).

An operator new to ODD reading the docs end-to-end never encounters the SPA shell as a documented surface — they encounter individual features but not the chrome that connects them. The 9-tab taxonomy is the FIRST thing an operator sees on first SPA load; it is the LAST thing the docs describe. The doc-product coherence gap is structural and high-leverage: a single new UI-shell page would home the SPA chrome's documentation surface and let downstream DOC-GAPs (185, 186, 205, 020, 027, 287, 300, 301, 311 NEW) cross-link to it instead of each one re-inventing the framing.

The 404 at `/active-platform-features/ui-overview` is the OPERATOR-INVISIBLE half of the gap — operators (or AI assistants) inferring the URL from the SPA's own UX vocabulary land on a not-found page; the missing-page half is the structural absence. Both halves close with the same fix: author a single canonical UI-shell doc page.

### Proposed doc action

**Two-part action — code-side is N/A; doc-side authoring is the canonical remediation.**

1. **Doc-side PRIMARY** — author `documentation/docs/features/ui-overview.md` (or `active-platform-features/ui-overview.md` if the GitBook nav prefers that home) as the canonical SPA-shell doc page. Recommended structure:
   - **The application shell**: brief description of the fixed-position toolbar (rendered on every authenticated page) + its three composition sites (brand block / primary navigation / info + user cluster).
   - **The 9 primary navigation tabs**: enumerate Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity. For each: one-line description + the URL family it navigates to (Catalog → /search, Dictionary → /termsearch, Data Modelling → /data-modelling/query-examples, Master Data → /master-data/lookup-tables, others match label). Cross-link to the per-pillar feature pages. **Surface the label↔URL drift** (DOC-GAP-308 NEW): "Catalog / Dictionary / Data Modelling / Master Data: tabs navigate to URLs that differ from the label text — historical artefacts of feature renames. Shared links use the URL paths."
   - **Tab visibility and permissions**: cross-link to DOC-GAP-186's proposed fix on `features/management.md` ("The Management top-level tab is visible to every signed-in user; per-button gates hide mutation affordances when the user lacks the permission. The 9-tab toolbar is NOT permission-gated at the tab level.").
   - **The App Info menu** (the information-icon popover): documentation / Slack / version display / feedback / operator-configured `odd.links` shortcuts. Cross-link to DOC-GAP-285's caveats on operator-configured-URL trust.
   - **Language selection**: list the 6 supported locales (English, Spanish, Chinese, French, Ukrainian, Armenian — `en/es/ch/fr/ua/hy`); describe the persistence mechanism (browser-localStorage key `i18nextLng`, no server-side binding); cross-link to DOC-GAP-309 NEW (the 3 untranslated primary-nav tabs caveat — Data Quality / Data Modelling / Master Data show English in every locale) + DOC-GAP-310 NEW (locale-set drift caveat); link to the locale repo for contributors who want to add a locale.
   - **The user-cluster**: explain the name display (`owner.name ?? identity.username`) — cross-link DOC-GAP-185 for the auth-mode-specific behaviour (DISABLED renders 'admin' literal; OAUTH2 may render an email). Explain Logout (full-page navigation to `/logout`; behaviour depends on backend `auth.type`; cross-link DOC-GAP-185).
   - **When things go wrong — the error page**: a small section describing AppErrorPage (HTTP status code + status-text heading + "Return to the Home Page" link); cross-link DOC-GAP-311 NEW (the BLANK-PAGE fall-through caveat for unknown URLs and uncaught React errors).
2. **Doc-side SUPPORTING — SUMMARY.md update**: add the new page under the `features/` tree as the FIRST entry (operators land on it before pillar-specific pages). Optionally add a `redirects.yml` entry mapping `/active-platform-features/ui-overview` → `/features/ui-overview` to close the 404 for the legacy URL.

The fix collapses an 11-cross-link cluster (DOC-GAP-185 / 186 / 205 / 020 / 027 / 287 / 300 / 301 / 307 / 308 / 309 / 310 / 311 — 12 once this and the siblings ship) into a single canonical home; future per-tab UX disclosures (e.g. a new Data Modelling sub-feature, a future i18n contributor guide) hang off this page rather than re-litigating the SPA-shell framing.

### Cross-references

- **DOC-GAP-185** (SPA auth UX silent on enable-security pages) — sibling SPA-shell coverage gap; this finding adds the NAVIGATION + CHROME + I18N dimension; together they form the complete operator-facing SPA UX documentation cluster
- **DOC-GAP-186** (Management top-nav tab visibility CONTRADICTS docs) — the live `features/management.md` page needs THIS UI-shell page to cross-link to for the "tab visibility model" sub-section; without this page the per-pillar pages re-invent the framing
- **DOC-GAP-205** (Dictionary tab UX structurally undocumented) — sibling per-tab UX coverage gap; the new UI-shell page would home the cross-link
- **DOC-GAP-020 + DOC-GAP-027 + F-047** (Locale Bundle / Multilingual UI missing-page) — this finding includes the locale-switcher section that closes F-047
- **DOC-GAP-285** (odd.links tabnabbing + URL-scheme + boot-immutability) — the App Info menu section cross-links here
- **DOC-GAP-287** (Data Modelling read-collaborative posture silence) — would back-link to the new UI-shell page for the navigation framing
- **DOC-GAP-300 + DOC-GAP-301 + DOC-GAP-302** (bare-base-URL dead-ends + WithPermissionsProvider META) — the new UI-shell page surfaces the URL-surface convention and the permission-model convention together
- **DOC-GAP-308 NEW** (label↔URL drift on 4 primary tabs) — this finding's section (b) hosts the explicit table
- **DOC-GAP-309 NEW** (3 primary-nav tabs missing i18n keys in every locale) — this finding's section (c) hosts the caveat
- **DOC-GAP-310 NEW** (locale-set drift + no missing-key handler) — this finding's section (c) hosts the contributor-guide pointer
- **DOC-GAP-311 NEW** (AppErrorPage scope vs blank-page fall-through) — this finding's section (g) hosts the framing
- **LSN-001 / LSN-011** — operator-trap canonical (doc-product coherence not self-detecting); the load-bearing SPA shell is the highest-leverage coherence gap surfaced by the batch ZJ UI-shell cluster

### Severity rationale

MEDIUM — the 404 itself is annoying but not load-bearing (no in-UI navigation hits the legacy URL; only AI-assistants or operators inferring the URL from the SPA UX); the missing-page half is the substantive gap. Severity is NOT HIGH because no security boundary is crossed and no data is at risk — the gap is operator-experience-quality and doc-product-coherence. Severity is NOT LOW because: (a) the missing-page surface is the LOAD-BEARING SPA chrome that every authenticated user sees on every page; (b) the gap collapses 11 sibling cross-references into one canonical home (high doc-product leverage); (c) the F-047 multilingual-UI cluster has been open since 2026-05-08 and a single UI-shell page is the natural home for it; (d) the LSN-001 + LSN-011 coherence pattern — doc-product coherence is not self-detecting — is precisely the failure mode here, and the fix is bounded (one new page + SUMMARY entry + optional redirect).

### Last verified

- 2026-05-26 — `https://docs.opendatadiscovery.org/active-platform-features/ui-overview` confirmed 404 via direct WebFetch this session; sibling URLs (configuration-and-deployment/odd-platform + enable-security/authentication) confirmed silent on UI-shell content via direct WebFetch this session.
