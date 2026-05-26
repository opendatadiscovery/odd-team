## REFACTOR-683 — Doc-page absences across THREE feature pages: activity-feed page silent on access control + 4 tabs (`ALL/MY_OBJECTS/DOWNSTREAM/UPSTREAM`); search page silent on `/search/{searchId}` URL form + access model; relationships pages silent on visibility scoping AND overstates client-side type discrimination ("routing determined by relationship type" — every row routes to the same `/dataentities/{id}/overview`)

**Severity**: MEDIUM
**Category**: doc-side-absence-or-misleading / cross-page-doc-gap-pattern
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-01 Data Discovery, P-02 Data Modelling, P-04 Activity]

**Surfaced by**:
- `odd-platform__ts__routes__route__activity.md:docs_link_semantic.doc_drift_findings[1,2]` (MEDIUM, MEDIUM) — "The doc page does not enumerate the four tabs (`All` / `My Objects` / `Downstream` / `Upstream`) implemented at `ActivityTabs.tsx:29-51`. The page's only navigation discussion is the global-vs-per-entity split. Surface as documentation gap." + "The doc page contains NO discussion of access control / who can view the global Activity page. The page is reachable by every authenticated user (and by every caller under `auth.type=DISABLED`); an operator reading the doc would not know the global audit trail is platform-wide visible."
- `odd-platform__ts__routes__route__search.md:docs_link_semantic.doc_drift_findings[0,1]` (HIGH, MEDIUM) — "**The live doc page does NOT mention the `/search/{searchId}` URL form at all.** WebFetched 2026-05-26: the page describes free-text + faceted search and lists the 7 facets, but the entire URL-shape / session-persistence / deep-link-sharing story is undocumented. An operator reading the doc has no way to know that (a) the URL bar carries a session UUID, (b) the UUID is shareable, (c) the UUID represents a persisted server-side row, (d) tab-clicking the 'Catalog' tab drops the session." + "**The live doc page does NOT mention the access model for the Catalog page.** No statement of 'every authenticated user can search' or 'search is read-collaborative'."
- `odd-platform__ts__routes__route__relationships.md:docs_link_semantic.doc_drift_findings[3,4]` (MEDIUM, LOW) — "Doc is silent on visibility scoping for Relationships — neither the pillar page nor the per-feature page mentions who can VIEW relationships." + "Doc says 'Users can click any row to open the relationship's detail page, with routing determined by the relationship type' — the code at `RelationshipsListItem.tsx:52` always navigates to `dataEntityDetailsPath(item.id)` (the data-entity overview page), NOT to a relationship-type-specific detail URL. The doc's 'routing determined by the relationship type' phrasing is misleading — from THIS list page, every click routes to the same `/dataentities/{id}/overview` URL regardless of type."

**Description**: Three Catalog-pillar feature pages on `docs.opendatadiscovery.org` share a doc-side pattern: they describe the user-visible affordance + the data the page shows, but they OMIT the URL-shape contract + the access-control posture. The pattern is recurring enough across pillars to be tracked as a single doc-gap class:

**Page 1 — `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed`** (WebFetched 2026-05-26, status 200):
- ABSENT: enumeration of the 4 tabs (`ALL`, `MY_OBJECTS`, `DOWNSTREAM`, `UPSTREAM`).
- ABSENT: access-control statement — "who can view the global Activity feed".
- PRESENT BUT MISLEADING: "User filter" description claims "show events **performed by** one or more selected users" — see REFACTOR-567 strengthening for the LSN-020 drift this reinforces.

**Page 2 — `https://docs.opendatadiscovery.org/features/data-discovery/search`** (WebFetched 2026-05-26, status 200):
- ABSENT: `/search/{searchId}` URL form, session-UUID semantics, deep-link-sharing implications, tab-click-drops-session behaviour.
- ABSENT: access-control statement — "who can search".

**Page 3 — `https://docs.opendatadiscovery.org/features/data-modelling/relationships` + `https://docs.opendatadiscovery.org/features/data-modelling`** (both WebFetched 2026-05-26, status 200):
- ABSENT: visibility scoping — who can view relationships (the code has zero authz; the doc is silent).
- MISLEADING: "Users can click any row to open the relationship's detail page, with routing determined by the relationship type" — actually every row routes to `/dataentities/{id}/overview` regardless of type.

**Why this is route-relevant**: every UI route module's `docs_link_semantic.inferred_docs` entry WebFetched the user-facing doc page and discovered the absence + the misleading claim. The pattern is uniform across three pillars; the gap is systemic rather than per-feature.

**Operator impact**:
- Activity: operators deploying ODD with RBAC expectations don't realise the global Activity feed is platform-wide visible. Security-review surfaces this when too late.
- Search: operators don't understand URL-bar UUIDs; bookmark fragility surprises them; cross-user sharing has unintended semantic.
- Relationships: operators expect type-aware routing; get a same-URL outcome for every row.

**Evidence**:
- WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` (2026-05-26, status 200) — verbatim content captured in activity sidecar `docs_link_semantic.inferred_docs[0]`
- WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/search` (2026-05-26, status 200) — captured in search sidecar
- WebFetch `https://docs.opendatadiscovery.org/features/data-modelling/relationships` (2026-05-26, status 200) — captured in relationships sidecar
- WebFetch `https://docs.opendatadiscovery.org/features/data-modelling` (2026-05-26, status 200) — captured in relationships sidecar

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-003** (read-collaborative GET posture) — every absent access-control statement on the doc pages is consistent with this ADR; the gap is doc-side, not code-side.
- **ADR-CANDIDATE-052** (server-side search session) — the search-doc absence of URL form discussion is the operator-presentation gap; the ADR exists but the doc page doesn't reference it.
- **ADR-CANDIDATE-229 + REFACTOR-668** (two-tier permission primitive + route-mount Provider misleading) — the access-control silence on every page is the operator-visible side of the architectural choice.

**Proposed remedy**: Three layered doc additions (each page gets a small section):

**Activity page**:
- Add subsection "Tabs and View Modes" enumerating the 4 tabs + their semantics (`ALL` = cross-owner, `MY_OBJECTS` = owner-scoped, `DOWNSTREAM`/`UPSTREAM` = lineage-traversal).
- Add subsection "Access control" — "The global Activity feed is reachable by any authenticated user (and by any caller when `auth.type=DISABLED`). The feed shows cross-owner audit events including ownership changes, description edits, and tag assignments. Operators wanting per-role visibility constraints must layer a reverse proxy or extend the authorization model — the current platform does not gate the global feed."

**Search page**:
- Add subsection "URL form and session sharing" — explain `/search/{searchId}`, session-UUID semantics, deep-link-sharing implications (recipient sees session state at fetch time), bookmark fragility (session may be reaped), tab-click drops session.
- Add subsection "Access control" — "The Catalog page is reachable by any authenticated user (and by any caller when `auth.type=DISABLED`). Anyone with a session UUID has full read + update access to that session — the schema has no per-user binding."

**Relationships page** (pillar page + per-feature page):
- Add subsection "Visibility scoping" — "Relationships are catalog-global metadata reachable by any authenticated user. The graph topology is intentionally always visible; the underlying entity reads remain access-controlled. Operators in multi-tenant deployments should note that cross-tenant graph topology is visible to every authenticated user." (Composes with REFACTOR-626 DOC-DISCLOSE remedy.)
- Update "routing determined by the relationship type" claim — clarify that every row in the list routes to the source entity's overview page, where the type-specific rendering happens INSIDE that overview's relationship-card section.

**Severity rationale**: MEDIUM — doc-side gaps with three concrete operator-presentation failures; the absences leave operators making wrong assumptions about access control, URL semantics, and click routing; not data-loss / not security-hardening (the underlying code IS architecturally consistent per the existing ADRs), but operator-facing failure modes.

**Suggested backlog grouping**: `DOC sprint — Catalog pillar visibility + URL semantics` (cross-page batch — same writer can ship all three additions in one sitting).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-053 (activity exposure — doc absence is the operator-facing manifestation); REFACTOR-567 (userIds drift — doc reinforces the wrong promise); REFACTOR-626 (relationships exposure — doc absence is the actionable companion); REFACTOR-676 (searchId drift — doc absence compounds the URL-semantic gap); ADR-CANDIDATE-052 (server-side search session — doc page should reference the ADR's narrative); ADR-CANDIDATE-229 (two-tier primitive — every doc absence on access control reinforces the audit failure mode).
- SUPERSEDES: none.
- CONFLICTS: none.
