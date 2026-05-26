## STRENGTHENS — ToolbarTabs + en.json sidecars supply Dictionary tab label↔URL provenance (batch ZJ)

DOC-GAP-205 documents 5 undocumented UX traits of the Dictionary tab (`/termsearch`) — filter sidebar, free-text search, infinite-scroll pagination, URL-backed deep-link share-ability, read-collaborative posture. Batch ZJ adds the **TOOLBAR-LAYER PRIMARY SOURCE**: the ToolbarTabs sidecar establishes the LABEL↔URL drift specifically (Dictionary → /termsearch — the URL and the label share no vocabulary). DOC-GAP-308 NEW is the dedicated finding for the cross-tab label↔URL drift cluster; DOC-GAP-205 is the per-feature Dictionary-tab UX gap. This append adds the toolbar-layer primary-source citations + reinforces DOC-GAP-205's framing with the new substrate.

### Added surfaced_by (new sidecars cited)

- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:docs_link_semantic.doc_drift_findings[1]` — **NEW PRIMARY SOURCE**: "DRIFT_LABEL_VS_ROUTE: The 'Dictionary' tab navigates to `/termsearch/<id>` — the URL contains 'term' not 'dictionary' anywhere. No live doc page documents this label↔URL mapping. Code anchor: ToolbarTabs.tsx:66-69 (label) + termsRoutes.ts:6 (TERMS_SEARCH_PATH='/termsearch')." **(NEW batch ZJ — ToolbarTabs sidecar PRIMARY SOURCE — the LABEL ORIGIN)**
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:stress_findings.request_inputs[Dictionary]` (TRANSLATES_SILENTLY drift) — verbatim Q "Does the implementation's actual scope MATCH the name's promise?" / A "TRANSLATES_SILENTLY — label says 'Dictionary'; URL says 'termsearch'. Live docs at /features/features call this feature 'Dictionary terms' (combined noun), aligning with the LABEL but not the URL." **(NEW batch ZJ)**
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[3]` — **NEW i18n-LAYER SOURCE**: "Dictionary label vs `/termsearch` URL drift (MEDIUM, DOC-GAP-300/301 instance at the i18n layer): The `\"Dictionary\"` entry (line 115) labels the top-level navigation tab via `ToolbarTabs.tsx:66`... `ToolbarTabs.tsx:111` does `if (tabs[idx].name === t('Dictionary'))` — a fragile string-equality check between localized strings that works only because the natural-keys pattern means `t('Dictionary') === 'Dictionary'` in every locale. If a locale ever translates the key (e.g. `fr.json: \"Dictionary\": \"Dictionnaire\"`), the equality check still works because both sides resolve through the same i18next instance — but a code-review reading the call site has no way to tell that without tracing the i18next semantics." **(NEW batch ZJ — en.json sidecar SECONDARY SOURCE — the LOCALIZATION CHANNEL)**

### New evidence (supplementary)

- `ToolbarTabs.tsx:66-69` (verbatim full Read this session): the Dictionary tab declaration — `{ name: t('Dictionary'), link: termsSearchPath(), value: 'termsearch' }`. The label vocabulary ('Dictionary') and the URL vocabulary ('termsearch') diverge AT THE TOOLBAR LAYER.
- `ToolbarTabs.tsx:111-117` (verbatim): the Dictionary click handler dispatches `createTermSearch` BEFORE navigation; on success navigates to `/termsearch/<id>` — the click handler uses string-equality on the localized label (`if (tabs[idx].name === t('Dictionary'))`), a fragile cross-locale pattern that works only because the natural-keys i18n contract enforces `t('Dictionary') === 'Dictionary'` in every locale (DOC-GAP-310 NEW context).
- `odd-platform-ui/src/routes/termsRoutes.ts:6` (per ToolbarTabs sidecar): `TERMS_SEARCH_PATH = '/termsearch'` — the URL helper that the Dictionary tab consumes.
- `odd-platform-ui/src/locales/translations/en.json:115` (per en.json sidecar): the `"Dictionary"` key declared in the canonical English bundle. The i18n layer SHIPS the misleading label to every locale uniformly (verified absent from any localized translation — every locale's "Dictionary" entry reads "Dictionary" or is missing entirely).
- Live WebFetch `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` 2026-05-26 status **200** (inherited from prior session) — verbatim: "The Dictionary tab is the catalog-wide list of all terms in the platform. From here you can: Browse terms across every namespace." — the doc CONSISTENTLY uses 'Dictionary' vocabulary; the URL family `/termsearch` is never mentioned.

### New operator-impact dimensions surfaced

1. **TOOLBAR-LAYER PRIMARY SOURCE FOR LABEL ORIGIN**: DOC-GAP-205 originally surfaced 5 UX-trait gaps at `/termsearch` but did not explicitly anchor the LABEL ORIGIN. Batch ZJ's ToolbarTabs sidecar IS the originating layer — the 9-tab literal array at `ToolbarTabs.tsx:34-82` is the structural source for the "Dictionary" label. The Dictionary↔/termsearch drift is anchored at this toolbar-layer source.
2. **CROSS-LOCALE UNIFORMITY**: the Dictionary label is enforced as `"Dictionary"` in EVERY locale via the natural-keys i18n pattern (en.json line 115 + 5 non-English bundles all carry the same key with value=key OR the key is missing). No locale corrects the drift — even in Ukrainian / Chinese / Armenian, the tab reads "Словник" / "字典" / etc. while the URL is `/termsearch`. The drift ships uniformly to every localized deployment.
3. **STRING-EQUALITY FRAGILITY**: the click handler at `ToolbarTabs.tsx:111` uses a localized-string comparison (`tabs[idx].name === t('Dictionary')`) — a code smell that becomes fragile if any locale ever translates the key (e.g. `fr.json: "Dictionary": "Dictionnaire"` would still work because both sides resolve through i18next, but the call site reads as if the comparison is literal). The handler-vs-i18n coupling is undocumented; a future contributor renaming the key in en.json without updating the handler comparison would break navigation silently.

### Triangulation update

DOC-GAP-205 was originally surfaced by 6 sources (5 doc_drift_findings + 1 invariant — all from the TermSearch sidecar). Batch ZJ adds 2 NEW PRIMARY-LAYER SOURCES:
- ToolbarTabs sidecar (the LABEL ORIGIN at the toolbar layer — the structural source for "Dictionary")
- en.json sidecar (the LOCALIZATION CHANNEL — the i18n key that ships the misleading label uniformly to every locale)

**Coverage: 6 → 8 sources. The LABEL ORIGIN layer is now triangulated (toolbar + i18n bundles + TermSearch consumer).**

### Proposed doc action update

The original DOC-GAP-205 5-part proposed action (rewrite the Dictionary-tab section to enumerate the 5 UX traits + add cross-links + ensure api-reference enumerates the 4 search endpoints + meta cross-link to read-collaborative posture) STILL APPLIES; batch ZJ adds two sub-bullets to part (1) — the rewrite of the `features/data-glossary/business-glossary.md` Dictionary-tab section:

- **Add a "URL path and tab label vocabulary" sub-paragraph** (immediately after the section heading):
  > "**URL path**: the Dictionary tab navigates to `/termsearch/{session_id}` — the URL family uses 'termsearch' rather than 'dictionary'. The discrepancy is historical (the underlying API endpoints and routing are organized around term-search sessions). When sharing links across teams, share the URL — the labels are localized but the URLs are stable across locales. **A label-vs-URL operator-confusion finding is tracked at DOC-GAP-308 NEW (batch ZJ).**"

- **Add a cross-reference to the new UI-shell page** (in the cross-link block):
  > "For the platform-wide label-to-URL mapping table across all 9 primary navigation tabs, see [UI overview — Tab labels and URLs](../ui-overview.md#tab-labels-and-urls)."

### Cross-references update

Add to existing DOC-GAP-205 cross-references:
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — the platform-wide tab-to-URL table belongs there; this finding (DOC-GAP-205) is the per-feature Dictionary-tab UX gap that cross-links to the platform-wide table
- **DOC-GAP-308 NEW** (label↔URL drift on 4 primary tabs) — the dedicated cross-tab label↔URL drift cluster; the Dictionary tab is ONE of the 4 affected tabs
- **DOC-GAP-310 NEW** (locale-set drift + no missing-key handler) — explains why the Dictionary label persists uniformly across all 6 locales (the natural-keys + no missing-key-handler pattern)

### Severity update

Severity remains **MEDIUM** — the 8-source triangulation reinforces the original assessment. Batch ZJ widens the SOURCE LAYERS (toolbar + i18n + TermSearch consumer all triangulated) without changing the operator-impact class. Severity is MEDIUM because: (a) the 5 UX-trait gaps are operator-experience-quality; (b) the label↔URL drift compounds the operator-confusion narrative but doesn't escalate it to HIGH (no security boundary crossed); (c) the fix is bounded — single-section rewrite + 2 sub-paragraphs added + cross-links.

---

**Batch ZJ contribution**: 2 NEW PRIMARY-LAYER SOURCES (ToolbarTabs + en.json sidecars supplying the LABEL ORIGIN + LOCALIZATION CHANNEL); coverage 6 → 8 sources; the LABEL ORIGIN layer is now triangulated; severity unchanged (MEDIUM); proposed doc action extended with two sub-paragraphs in the recommended Dictionary-tab rewrite.
