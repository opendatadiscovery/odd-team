---
doc_gap_id: DOC-GAP-300
severity: LOW
category: drift
batch: ZH
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-06"           # Data Glossary — the pillar whose bare base URL has the dead-end
  - "P-06:F-001"     # Term-to-Entity Linkage
related_features:
  - F-002            # Term-search session (sibling — DOC-GAP-205 + DOC-GAP-207 cluster member)
related_doc_gaps:
  - DOC-GAP-205      # Dictionary tab UX is structurally undocumented (sibling — same /termsearch surface)
  - DOC-GAP-207      # Term-search session URLs evicted after 30 days (sibling — URL-share-ability gap)
related_retrospectives:
  - LSN-001          # operator-trap canonical (doc/code expectation mismatch)
---

## DOC-GAP-300 — Visiting bare `/terms` (the Data Glossary pillar's base URL — the `BASE_PATH` constant declared at `termsRoutes.ts:4` and the `<Route path={termsPath()}>` mount at `App.tsx:66-68`) renders a BLANK PAGE — no element, no redirect, no error fallback — yet the live `features/data-glossary/business-glossary.md` page (WebFetched 2026-05-26 status 200, verbatim: "The Dictionary tab is the catalog-wide list of all terms in the platform. From here you can: Browse terms across every namespace.") frames the Dictionary tab as a navigable list surface; an operator deducing "if Dictionary is the list, maybe `/terms` is the URL" lands on a dead-end with no signal — silent UX defect

**Severity**: LOW
**Category**: drift (URL surface bug surfaced by static analysis of the routes module; not a security/data-loss class, but operator-confusing and doc-implicitly-implied)

### Surfaced by

- `odd-platform__ts__routes__route__terms.md:bugs_limitations_corner_cases.[blank /terms]` — verbatim: *"Visiting bare `/terms` renders a blank page. App.tsx:66 declares `<Route path={termsPath()}>` as a parent with one child route (`:termId/*`) and NO `index` route, NO `element` prop on the parent itself, NO `Navigate` fallback. React Router matches the parent but has nothing to render — the operator sees an empty page beneath the toolbar with no error message and no redirect. Compare App.tsx:63 (`/termsearch/*` self-renders TermSearch)."*
- `odd-platform__ts__routes__route__terms.md:stress_findings.name_behavior_pairs.[termsPath]` (DRIFT_NAME_VS_BEHAVIOR per LSN-019 stress protocol — *"Returns the bare string `/terms`. The ONLY consumer is App.tsx:66, which mounts it as a parent route with NO element and NO index route — the URL renders a blank page. The Dictionary tab in ToolbarTabs.tsx:67 navigates to `termsSearchPath()` (i.e. `/termsearch`), NOT `termsPath()`. No code path navigates to `/terms` directly."*)
- `odd-platform__ts__routes__route__terms.md:downstream_side_effects.[blank /terms render]` — primary source for the rendering hole: cardinality = 1 blank-page render per bare-`/terms` visit
- `odd-platform__ts__routes__route__terms.md:probes_emitted.P-164` — pinned probe asking "Visiting bare `/terms` in the running SPA — what does the user see? Blank, redirect, error, or empty-list page?"
- `concepts.yaml:entities[Term]` + `:entities[Term Search Session]` (cross-link — the two concepts the bare-`/terms` URL appears to address; neither matches the rendered surface)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` 2026-05-26 status **200** (inherited from terms-route sidecar this session, within LSN-018 stale-probe window) — verbatim: *"The Dictionary tab is the catalog-wide list of all terms in the platform. From here you can: Browse terms across every namespace."* The doc names the Dictionary surface as a LIST, never a SEARCH; never names the URL path; the operator deducing "list-of-terms ⇒ /terms" is reasonable inference.
- WebFetch `https://docs.opendatadiscovery.org/features/data-glossary` 2026-05-26 status **200** (inherited from terms-route sidecar) — pillar landing page mentions "Open it from the top-level navigation Dictionary tab" but defers to business-glossary.md for detail. No URL path cited.
- `odd-platform-ui/src/routes/termsRoutes.ts:4` — `BASE_PATH = '/terms'` (the constant)
- `odd-platform-ui/src/routes/termsRoutes.ts:21-23` — `termsPath()` returns `'/terms'`
- `odd-platform-ui/src/components/App.tsx:66-68` — *primary evidence*: `<Route path={termsPath()}>` followed by `<Route path=':termId/*' element={<TermDetails />} />` (line 67) — a PARENT route with one CHILD route, NO `index` route, NO `element` prop on the parent. React Router v6 matches the parent but renders nothing because the parent has no element and no matching child. Compare `App.tsx:63` (`<Route path={`${termsSearchPath()}/*`} element={<TermSearch />} />` — a single SELF-RENDERING route) and the `/master-data` outlier (DOC-GAP-301 sibling).
- `odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:67` — the Dictionary tab in the global toolbar navigates to `termsSearchPath()` (= `/termsearch`), NOT `termsPath()`. So the operator following the in-UI navigation NEVER hits `/terms` directly; the dead-end is reachable only via address-bar typing, bookmarks, or stale shared links.

### Drift narrative

The Data Glossary pillar has TWO base paths (`BASE_PATH = '/terms'` and `TERMS_SEARCH_PATH = '/termsearch'`), declared in the same route module, exposed via the same routes barrel. Operators reading the docs see "Dictionary tab" framed as a "catalog-wide LIST of all terms" and reasonably ask: *"What's the URL of the list?"* Reading the GitHub source, they find two builders (`termsPath`, `termsSearchPath`); without running the SPA they cannot tell which one is the LIST. They guess `/terms` (semantically closer to "list of terms" than "search for terms"), type it in the address bar, and see a blank page with no error message and no redirect.

The implementation choice — bare `/terms` is a parent-route wrapper for `/terms/:termId/*` and renders nothing on its own — is deliberate (the wrapper exists only to share `termsPath()` between the App.tsx mount and the `termDetailsPath` prefix, per the terms-route sidecar's `implicit_adrs.[termsPath lock-step]`). The SIBLING `/data-modelling`, `/alerts`, `/management`, `/search`, and `/directory` bases ALL declare an explicit redirect to a canonical first tab (`<Navigate to='query-examples'/>` / `<Navigate to='all'/>` / `<Navigate to='namespaces' replace/>` etc., per the dataModelling-route sidecar's `implicit_adrs.[bare base URL is a redirect not a view]`). The `/terms` outlier is the only multi-tab pillar where the bare base is structurally a dead-end.

This is the LOW-severity end of the LSN-001-class operator-trap pattern: doc-implies-X, code-implies-not-X. The doc says "catalog-wide list" but never names a URL; the code emits the URL via `termsPath()` but doesn't render anything at it. The narrowest dependable inference would be the consistent platform-wide redirect convention (every other pillar bare base redirects); the operator who reads the source code and sees that convention assumes `/terms` is a similar redirect, and is wrong.

### Proposed doc action

**Two-part action — code-side fix is cheaper than the doc-side fix, and the convention is consistent across the rest of the routes module.**

1. **Code-side PRIMARY (recommended)** — file `/log-issue odd-platform` (single-line code edit): add a redirect at `components/App.tsx:66-68`. Two equivalent options:
   - **(a)** Add a default child route under the parent: `<Route path={termsPath()}><Route index element={<Navigate to={`${termsSearchPath()}`} replace />} /><Route path=':termId/*' element={<TermDetails />} /></Route>` — bare `/terms` redirects to `/termsearch` (the Dictionary search surface).
   - **(b)** Lift the `Navigate` to the parent's `element`: `<Route path={termsPath()} element={<Navigate to={termsSearchPath()} replace />} />` and keep `/terms/:termId/*` as a SEPARATE top-level route. Slightly more invasive but matches the `/data-modelling` pattern more directly (`DataModellingRoutes.tsx:16` is the canonical convention).
   Per platform convention (5 of 6 pillar base URLs already redirect — only `/terms` is the outlier), option (b) is more consistent. Either fix closes the dead-end.

2. **Doc-side COMPANION (if the code fix ships)** — no doc change needed; the convention is operator-invisible once the redirect lands. If the maintainer wants to make the URL surface explicit, add a one-line note to `features/data-glossary/business-glossary.md` near the "Dictionary tab" section: *"The Dictionary tab lives at `/termsearch`. Older links to `/terms` redirect to `/termsearch`."* — but this disclosure is optional; the typical operator never thinks about the URL path.

3. **Doc-side STAND-ALONE (if the code fix does NOT ship)** — add a "URL surface" sub-section to `features/data-glossary/business-glossary.md` BEFORE the action-verb enumeration: *"The Dictionary tab lives at `/termsearch` (not `/terms` — the bare `/terms` URL is a structural wrapper for per-term deep-links and renders a blank page if visited directly). Individual terms are at `/terms/{termId}/overview` (and four sibling sub-tabs: `linked-entities`, `linked-columns`, `linked-terms`, `query-examples`)."* This makes the URL surface explicit; mitigates the dead-end via documentation rather than redirect.

### Cross-references

- **DOC-GAP-205** (Dictionary tab UX structurally undocumented — five undocumented UX traits at `/termsearch`): SIBLING SURFACE — DOC-GAP-205 covers what the search UI DOES; THIS finding covers the URL-surface dead-end that confuses operators on the way to that UI. The two together cover the operator's full P-06 Dictionary onboarding experience.
- **DOC-GAP-207** (Term-search session URL eviction after 30 days): SIBLING URL-shape finding — same Data Glossary surface. The TTL-eviction half + the rendering-hole half together are a 2-vector URL-share-ability gap.
- **DOC-GAP-186** (Management top-nav tab visibility — sibling convention finding) + **DOC-GAP-287** (Data Modelling relationships visibility — sibling convention finding): not direct, but illustrate the pattern that route-module URL behaviours are systematically undocumented at the operator-facing tier.
- **LSN-001 / LSN-002**: canonical operator-trap class — doc-implies-X, code-implies-not-X. THIS finding is the lowest-impact instance (no security, no data loss; just a dead-end page).

### Severity rationale

LOW. No security boundary crossed, no data lost, no operator-impactful behaviour beyond cosmetic UX confusion. The dead-end is reachable only via address-bar typing, bookmarks, or stale shared links — the in-UI navigation always uses `/termsearch`. The asymmetry with the rest of the route module (5 other pillar bases redirect; only `/terms` doesn't) is a code-side convention break, not a doc product defect. The fix is a one-line code edit OR a single doc paragraph.

Severity is NOT MEDIUM because: (a) no operator currently reports this in user-facing channels; (b) the in-UI flow never hits the dead-end; (c) the operator-impact narrative requires the operator to actively SEEK the URL via the doc framing, find no URL path stated, infer one from convention, and arrive at the wrong inference — a multi-step misroute that is shallow. Severity is NOT LOW-trivial because: the URL-path convention IS load-bearing for shared-link share-ability across the platform (5 of 6 pillars redirect their base URL to a sensible first tab; `/terms` breaks that promise silently).

### Last verified

- 2026-05-26 — terms-route sidecar primary source at substrate commit `4ec2b20`; live WebFetch business-glossary page (200, inherited within LSN-018 stale-probe window from this session's terms-route sidecar enrichment); the routes-module + App.tsx file:line evidence verified against the local checkout.
