---
doc_gap_id: DOC-GAP-308
severity: MEDIUM
category: drift
batch: ZJ
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-01:F-001"     # Catalog / Search tab
  - "P-02:F-024"     # Dictionary tab — termsearch landing
  - "P-05:F-031"     # Data Modelling tab — Query Examples landing
  - "P-03:F-029"     # Master Data tab — Lookup Tables landing
related_features: []
related_doc_gaps:
  - DOC-GAP-205      # Dictionary tab UX (sibling — same /termsearch surface; this finding makes the label↔URL the explicit drift)
  - DOC-GAP-300      # /terms blank-page dead-end (sibling URL-surface finding)
  - DOC-GAP-301      # /master-data blank-page dead-end (sibling URL-surface finding)
  - DOC-GAP-287      # Data Modelling relationships read-collaborative posture (sibling per-pillar)
  - DOC-GAP-307      # UI-shell canonical doc page absent (the home for this finding's table)
related_retrospectives:
  - LSN-001          # operator-trap canonical (doc/code expectation mismatch)
  - LSN-020          # name-vs-implementation drift class
---

## DOC-GAP-308 — Four of nine primary navigation tabs ship with label↔URL drift visible to every operator on every login — `Catalog` → `/search/{searchId}` (never `/catalog/*`), `Dictionary` → `/termsearch/{id}` (never `/dictionary/*`), `Data Modelling` → `/data-modelling/query-examples` (lands on Query Examples specifically, not an overview), `Master Data` → `/master-data/lookup-tables` (lands on Lookup Tables specifically, not an overview) — `ToolbarTabs.tsx:34-82` hardcodes the label-to-route mapping with no doc cross-link, no comment, no ADR; the live docs reinforce the drift in TWO places: `/features/data-discovery/search` instructs operators to "select the Catalog tab" without naming `/search`, AND `/features/features` references "six governance pillars" while the toolbar renders nine tabs — the operator's mental model "label = URL = feature" is silently violated on the FIRST tab they click

**Severity**: MEDIUM
**Category**: drift (label-vs-URL operator-confusion; not security/data-loss; reinforced by docs at two surfaces)

### Surfaced by

- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:docs_link_semantic.doc_drift_findings[0]` ("DRIFT_LABEL_VS_ROUTE: The live docs (search page) instruct users to 'select the Catalog tab' — yet the tab labelled 'Catalog' navigates to `/search`, not `/catalog`. The URL the user sees in the address bar after clicking 'Catalog' is `/search/<searchId>` — no 'catalog' string appears in the URL.") **(NEW batch ZJ — ToolbarTabs sidecar PRIMARY SOURCE)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:docs_link_semantic.doc_drift_findings[1]` ("DRIFT_LABEL_VS_ROUTE: The 'Dictionary' tab navigates to `/termsearch/<id>` — the URL contains 'term' not 'dictionary' anywhere. No live doc page documents this label↔URL mapping.") **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:docs_link_semantic.doc_drift_findings[2]` ("DRIFT_LABEL_VS_ROUTE: The 'Data Modelling' tab navigates to `/data-modelling/query-examples`, NOT to a Data Modelling overview page (no such page exists; `dataModellingPath()` returns `/data-modelling` but is unused as a tab target). The user clicks 'Data Modelling' and lands on Query Examples specifically.") **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:docs_link_semantic.doc_drift_findings[3]` ("DRIFT_LABEL_VS_ROUTE: The 'Master Data' tab navigates to `/master-data/lookup-tables` — same shape as Data Modelling, no `/master-data` index page is mounted.") **(NEW batch ZJ)**
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[3]` ("Dictionary label vs `/termsearch` URL drift — The `\"Dictionary\"` entry (line 115) labels the top-level navigation tab; the URL is `/termsearch` (`routes/termsRoutes.ts:5`). The label vocabulary ('Dictionary') and the URL vocabulary ('termsearch') disagree.") **(NEW batch ZJ — en.json sidecar SECONDARY SOURCE confirming the i18n channel ships the misleading label to every locale uniformly)**

### Evidence

- `ToolbarTabs.tsx:34-82` — primary source: the 9-tab literal array. Verbatim mappings:
  - `{ name: t('Catalog'), link: searchPath() }` (lines 37-39) → `/search/{searchId}` after `createDataEntitiesSearch` dispatch (lines 121-123 + `useCreateSearch.ts:14-19`)
  - `{ name: t('Dictionary'), link: termsSearchPath(), value: 'termsearch' }` (lines 66-69) → `/termsearch/{id}` after `createTermSearch` dispatch (lines 112-117)
  - `{ name: t('Data Modelling'), link: queryExamplesPath(), value: 'data-modelling' }` (lines 50-54) → `/data-modelling/query-examples` directly
  - `{ name: t('Master Data'), link: lookupTablesPath(), value: 'master-data' }` (lines 55-59) → `/master-data/lookup-tables` directly
- `odd-platform-ui/src/routes/searchRoutes.ts:3` — `BASE_PATH = '/search'` (no `/catalog` route exists; Grep `catalogPath|/catalog` returns 0 matches per ToolbarTabs sidecar Q5 result).
- `odd-platform-ui/src/routes/termsRoutes.ts:6` — `TERMS_SEARCH_PATH = '/termsearch'` (no `/dictionary` route exists).
- `odd-platform-ui/src/routes/dataModelling/dataModelling.ts:5-7` — `dataModellingPath()` returns `/data-modelling` (exists as a route-helper export but `App.tsx:74` mounts only the `/data-modelling/*` parent; no `/data-modelling` index page).
- `odd-platform-ui/src/routes/masterDataRoutes.ts:1-4` — `BASE_PATH = '/master-data'`; the only exported helper is `lookupTablesPath()` returning `/master-data/lookup-tables`; no `masterDataPath()` export.
- WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/search` 2026-05-26 status **200** (inherited from ToolbarTabs sidecar) — verbatim: *"To get started, navigate to the main page of ODD Platform and select the Catalog tab. There you will find the Search bar and Filter options."* — the doc reinforces the LABEL ('Catalog tab') and never names the URL family (`/search`).
- WebFetch `https://docs.opendatadiscovery.org/features/features` 2026-05-26 status **200** (inherited from ToolbarTabs sidecar) — the doc references "six governance pillars" but the toolbar renders nine tabs; the doc never maps the 9-tab UI to the 6-pillar conceptual model.
- WebFetch `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` 2026-05-26 status **200** (inherited from DOC-GAP-205 + DOC-GAP-300 prior sessions) — the doc names "The Dictionary tab" but never names `/termsearch`.
- `odd-platform-ui/src/locales/translations/en.json:115` — the `"Dictionary"` key (i18n channel that ships the misleading label to every locale uniformly via the natural-keys pattern; cross-link to en.json sidecar).
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:111-117` — the click handler uses string-equality on the localized label (`if (tabs[idx].name === t('Dictionary'))`) — a fragile pattern that works only because the natural-keys i18n pattern means `t('Dictionary') === 'Dictionary'` in every locale.

### Drift narrative

Four of the nine primary navigation tabs ship with a structural disconnect between the label the user reads and the URL the browser shows after clicking. The disconnect is visible on every login: an operator clicks "Catalog" and sees `/search/<uuid>` in the address bar; clicks "Dictionary" and sees `/termsearch/<uuid>`; clicks "Data Modelling" and lands on Query Examples specifically (with no overview page); clicks "Master Data" and lands on Lookup Tables specifically (with no overview page).

The drift has three operator-visible consequences:

1. **Bookmarking and link-sharing**: a user who bookmarks the Catalog tab actually bookmarks a one-time search-id URL; sharing the URL in Slack shares the user's specific search, not a stable catalog landing. The doc's "select the Catalog tab" guidance produces a URL the docs themselves never name.

2. **URL-typing**: an operator infers from the doc framing ("Dictionary" / "Master Data" / "Data Modelling") that those labels are URL paths; typing `/dictionary`, `/master-data`, or `/data-modelling` produces (per DOC-GAP-300 / DOC-GAP-301 sibling findings) a BLANK PAGE in the case of `/master-data`; a dead-end at `/terms`; an unmounted route at `/data-modelling`; and a 404-equivalent for `/dictionary`. The label-to-URL mental model is silently wrong.

3. **Multi-feature pillar misnamings**: clicking "Data Modelling" lands on Query Examples — but Data Modelling has TWO sub-features (Query Examples + Relationships); the tab forces the user into Query Examples with no signal that Relationships exists at a sibling URL. Same shape for Master Data → Lookup Tables (today only one sub-feature; future-fragile). Operators discover Relationships only by navigating from within Query Examples or from a Data Entity Details page — never from the top-level navigation.

The i18n layer multiplies the disclosure: the `Dictionary` label persists across all 6 locales (Spanish / Chinese / French / Ukrainian / Armenian / English) under the natural-keys pattern (en.json line 115); changing the label to "Term Search" or "Glossary" requires a single en.json key rename + 5 locale propagations (per the en.json sidecar's analysis), but the URL `/termsearch` is structurally locked in.

The live docs REINFORCE the drift at TWO surfaces: the `/features/data-discovery/search` page tells the user to "select the Catalog tab" — affirming the label without disclosing the URL family; the `/features/features` page references "six governance pillars" while the toolbar renders nine tabs. The 9-tab-to-6-pillar mapping is not 1:1 (Catalog + Directory are both Data Discovery; Activity + Alerts are both "active platform features"; Management is admin-not-pillar) and is documented nowhere.

This is LSN-020-flavoured drift (name-vs-implementation) plus LSN-001-flavoured doc-product coherence (the docs reinforce the wrong promise). The drift is LOW-severity in security terms (no auth gate crossed, no data leaked) but MEDIUM in operator-experience terms (every operator hits the surprise on first login; the surprise compounds with DOC-GAP-300 + DOC-GAP-301 URL dead-ends).

### Proposed doc action

**Two-part action — code-side is preferred (a 5-line route rename closes the drift permanently); doc-side is the fallback if the code-side rename is too disruptive.**

1. **Doc-side PRIMARY (closes the operator-confusion gap without code changes)** — add a **"Tab labels and URLs"** table to DOC-GAP-307 NEW's proposed `features/ui-overview.md` page (section b). Verbatim table:

   | Label | URL on click | Notes |
   |---|---|---|
   | Catalog | `/search/{search_id}` | Each click mints a new search session; the URL captures the session id |
   | Directory | `/directory` | Matches |
   | Data Quality | `/data-quality` | Matches |
   | Data Modelling | `/data-modelling/query-examples` | Lands on Query Examples; Relationships is a sibling at `/data-modelling/relationships` |
   | Master Data | `/master-data/lookup-tables` | Lookup Tables is the only sub-feature today |
   | Management | `/management/namespaces` (via redirect) | Sub-tabs gated per-button by permissions |
   | Dictionary | `/termsearch/{search_id}` | Each click mints a new term-search session |
   | Alerts | `/alerts/all` | Lands on "all alerts"; switch via inner tabs |
   | Activity | `/activity?<5-day-window>` | The window is set when the SPA bundle loads, not at click time |

   Add a one-paragraph framing: *"The tab labels are the platform's UX vocabulary; the URLs are the route paths the SPA navigates to. The two diverge by design in places (Catalog → /search captures a search-session id; Dictionary → /termsearch follows the term-search session model). When sharing links across teams, share the URL — the labels are localized but the URLs are stable across locales."*

2. **Doc-side COMPANION on `/features/data-discovery/search`** — replace "select the Catalog tab" with "select the Catalog tab (which navigates to `/search`)" + cross-link to the new UI-overview page's tab-to-URL table.

3. **Doc-side COMPANION on `/features/features`** — clarify the 6-pillar-to-9-tab mapping; either rename "six pillars" to acknowledge the 9-tab UI breakdown OR add a small table mapping each pillar to its constituent tab(s).

4. **Code-side OPTIONAL (the lasting fix)** — file `/log-issue odd-platform` for one of two route renames:
   - **(a) Lighter touch**: rename the i18n keys to express the URL families ("Catalog" → "Search", "Dictionary" → "Term Search"); ship a one-line en.json edit + 5 locale propagations; the URL stays `/search` and `/termsearch` and the label now matches.
   - **(b) Heavier**: rename the URL families to match the labels (`/search` → `/catalog`, `/termsearch` → `/dictionary`, `/data-modelling/query-examples` → `/data-modelling`). This breaks deep-linked bookmarks AND requires a redirect mapping for old URLs; not recommended without a migration window.

   The lightweight option (a) is the natural fix and matches the platform's vocabulary as currently used in the docs.

### Cross-references

- **DOC-GAP-205** (Dictionary tab UX undocumented — 5 traits including URL-share-ability) — sibling Dictionary-tab finding; this finding is the LABEL-VS-URL drift dimension specifically
- **DOC-GAP-300** (`/terms` blank-page dead-end) — same Data Glossary pillar; the operator-confusion narrative compounds (Dictionary label → /termsearch URL + `/terms` typed in addressbar → blank page)
- **DOC-GAP-301** (`/master-data` blank-page dead-end + Lookup Tables permissions gap) — same Master Data pillar; the operator-confusion narrative compounds (Master Data label → /master-data/lookup-tables URL + `/master-data` typed in addressbar → blank page)
- **DOC-GAP-287** (Data Modelling relationships read-collaborative posture silence) — same Data Modelling pillar; the operator-confusion narrative compounds (Data Modelling label → Query Examples landing + Relationships sub-feature undiscoverable from top-nav)
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — this finding's tab-to-URL table belongs there
- **DOC-GAP-309 NEW** (3 primary-nav tabs missing i18n keys) — sibling i18n surface; both findings affect the same 9-tab toolbar
- **DOC-GAP-303** (Activity Feed User-filter LSN-020) — sibling LSN-020 instance at the toolbar i18n channel; both gaps ship to every locale uniformly via the natural-keys pattern
- **LSN-020** (name-vs-implementation canonical) — this finding is LSN-020 at the UI navigation surface
- **LSN-001** (operator-trap canonical) — this finding is the doc-product coherence half (docs reinforce the wrong promise at `/features/data-discovery/search`)

### Severity rationale

MEDIUM — operator-experience gap with specific repeated failure modes (URL-bookmarking + link-sharing + addressbar-typing across 4 of 9 primary tabs). Severity is NOT HIGH because no security boundary is crossed and the in-UI navigation works (operators click the tabs and reach functional pages); the gap is in URL-share-ability + addressbar-discoverability. Severity is NOT LOW because: (a) the surface is the FIRST thing every operator sees on every login (the 9-tab toolbar); (b) the docs REINFORCE the wrong promise verbatim at two surfaces (`/features/data-discovery/search` says "select the Catalog tab" without disclosing the URL; `/features/features` references "six pillars" but the UI has nine tabs); (c) the drift uniformly ships across all 6 locales via the natural-keys i18n pattern (no locale corrects it); (d) the fix is bounded — one new table on the UI-overview page + two cross-link sentences on existing pages.

### Last verified

- 2026-05-26 — ToolbarTabs sidecar (PRIMARY SOURCE) + en.json sidecar (SECONDARY SOURCE) at substrate commit 4ec2b20; live WebFetch verification for `/features/data-discovery/search` + `/features/features` + `/features/data-glossary/business-glossary` inherited from the ToolbarTabs sidecar's session-cached fetches (all 200, all 2026-05-26).
