## STRENGTHENS — Batch ZJ (2026-05-26 — ToolbarTabs sidecar adds tab-side anchor; en.json:115 anchors the Dictionary label at the i18n layer)

Prior REFACTOR-674 framed the Dictionary tab doc-vs-code drift as a label-vs-URL vocabulary mismatch (live doc says "list", code uses `/termsearch`). Batch ZJ adds TWO new anchors:

**New surfaced_by entries**:
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:docs_link_semantic.doc_drift_findings[1]` (MEDIUM) — "DRIFT_LABEL_VS_ROUTE: The 'Dictionary' tab navigates to `/termsearch/<id>` — the URL contains 'term' not 'dictionary' anywhere. No live doc page documents this label↔URL mapping. Code anchor: ToolbarTabs.tsx:66-69 (label) + termsRoutes.ts:6 (TERMS_SEARCH_PATH='/termsearch')."

- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:stress_findings.name_behavior_pairs.tabs[6]` (HIGH; DRIFT_NAME_VS_BEHAVIOR) — "The 'Dictionary' tab navigates to `/termsearch/<newId>` after dispatching createTermSearch — the URL contains 'term', not 'dictionary'"

- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[3]` (MEDIUM) — "**Dictionary label vs `/termsearch` URL drift (MEDIUM, DOC-GAP-300/301 instance at the i18n layer)**: The `\"Dictionary\"` entry (line 115) labels the top-level navigation tab via `ToolbarTabs.tsx:66` (`name: t('Dictionary'), link: termsSearchPath()`). The URL is `/termsearch` (`routes/termsRoutes.ts:5`). The label vocabulary ('Dictionary') and the URL vocabulary ('termsearch') disagree. Adding to the drift: `ToolbarTabs.tsx:111` does `if (tabs[idx].name === t('Dictionary'))` — a fragile string-equality check between localized strings that works only because the natural-keys pattern means `t('Dictionary') === 'Dictionary'` in every locale."

**What this strengthening adds**:

1. **i18n layer anchor** — en.json:115 is the source-of-truth for the "Dictionary" label; the natural-keys pattern means every locale renders "Dictionary" identically (no locale corrects the vocabulary mismatch). The fix at the i18n layer would be renaming the key from `"Dictionary"` to `"Term Search"` everywhere — a mechanical change.

2. **Code-side fragile equality** — ToolbarTabs.tsx:111 does `if (tabs[idx].name === t('Dictionary'))` to discriminate the Dictionary tab from other tabs. This works ONLY because of the natural-keys pattern; if any locale ever translated the key (e.g. `fr.json: "Dictionary": "Dictionnaire"`), the equality would still resolve correctly through i18next's caching but would become harder to reason about. A code-review reading the call site has no way to tell that without tracing i18next semantics.

3. **Triangulation completed** — the drift now spans:
- Live Business Glossary doc says "list" + "browse" (`https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` WebFetched 2026-05-26)
- en.json:115 carries the label `"Dictionary"`
- ToolbarTabs.tsx:66 wires the tab label
- ToolbarTabs.tsx:111 uses fragile string equality
- termsRoutes.ts:6 declares `/termsearch` as the URL
- TermSearch.tsx:70-86 renders a search-with-facets UI (NOT a list)

The fix-span widens proportionally; Path A (update the doc) requires only the doc page edit; Path C (add a separate list surface) requires the new component + the route + the doc page + (if i18n key renamed) en.json + the 5 other locales.

**Triangulation count after ZJ**: 3 sidecars (was 1 — terms route; ZJ adds ToolbarTabs + en.json).

**Severity unchanged**: MEDIUM.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-670 (bare /terms blank; if Path C is chosen for both, the `/terms/list` redirect target closes both gaps), REFACTOR-676 (`:searchId` server-side session UUID — the URL semantics this drift depends on); ADR-CANDIDATE-011 (natural-keys lock the label across locales).
- SUPERSEDES: none.
- CONFLICTS: none.

---
