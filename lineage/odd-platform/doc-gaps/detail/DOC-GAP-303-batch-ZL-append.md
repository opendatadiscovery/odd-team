## STRENGTHENS — Activity.tsx UI-COMPONENT primary source adds the FOURTH surface to the LSN-020 User-filter drift triangulation (batch ZL)

DOC-GAP-303 originally established the doc-copy-vs-UI-label-vs-SQL three-surface drift; batch ZJ added the i18n-channel (en.json) as the third surface. Batch ZL's `Activity.tsx` component sidecar surfaces the **page-root UI primary source** — the operator-visible composition where the misleading label is rendered to the user. Coverage extends from 2 → 3 sidecars; the drift is now triangulated at PAGE-ROOT + CHILD-FILTER + i18n + SQL.

### Added surfaced_by (new sidecar cited)

- `odd-platform__ts__react-component__component__Activity.md:bugs_limitations_corner_cases[0]` — **NEW PRIMARY SOURCE — PAGE-ROOT**: "The 'User' filter (Filters.tsx:93-98 — `<MultipleFilter filterName='userIds' name={t('User')} />`) is operator-misleading at the UI layer (Category F TRANSLATES_SILENTLY — LSN-020). MultipleFilter at `components/shared/elements/Activity/ActivityFilterItems/MultipleFilter/MultipleFilter.tsx:32-34` dispatches `fetchOwnersList` for any `filterName !== 'tagIds'`; MultipleFilterAutocomplete (lines 44-47) does the same. The dropdown therefore lists OWNERS, not users. Selecting an OWNER puts its ID into `queryParams.userIds`; the backend binds `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. Three operator-observable consequences: (a) users without a user-owner mapping cannot be selected at all (silent absence from dropdown); (b) reassigning a user-owner mapping retroactively rewrites which historical rows match the filter; (c) multiple users sharing an owner collapse into a single filter result. The label says 'User'; the live doc says 'performed by'; the implementation says owner-of-the-actor-via-mapping. See P-190 for the integration probe." **(severity HIGH per sidecar)**
- `odd-platform__ts__react-component__component__Activity.md:security.known_security_gaps[1]` — **NEW SECURITY-AUDIT-CLASS framing**: "The 'User' filter label is operator-misleading at this surface. An auditor using the page to investigate 'what did user X do?' is given a UI control labelled 'User', whose underlying filter is on owner-of-actor-via-mapping. The audit conclusion drawn from the filtered list is wrong in shape — the user X's actions are absent unless X has a user-owner mapping, and the actions of every other user mapped to X's owner are present. This is the operator-facing surface of LSN-020." **(severity HIGH per sidecar)**
- `odd-platform__ts__react-component__component__Activity.md:stress_findings.request_inputs[userIds]` — confirms the available-but-unused column at the FILTER-ROOT layer: "The available-but-unused column is `ACTIVITY.CREATED_BY` (the actual actor's OIDC username, read at line 221, selected at line 212, NEVER filtered)" — verbatim re-confirmation from the page-root vantage.
- `odd-platform__ts__react-component__component__Activity.md:docs_link_semantic.doc_drift_findings[0]` — re-verifies the WebFetched live doc copy on 2026-05-26 status 200: "show events **performed by** one or more selected users" — confirms the doc page continues to reinforce the wrong promise (no edit since DOC-GAP-303 was filed).
- Probe **P-190** (per Activity.tsx sidecar `stress_findings.probes_emitted[0]`) — "Verify the LSN-020 UI surface: User filter → Owners dropdown → userIds binds to OWNER_ID. Verify three operator-observable consequences (unmapped-user absence, retroactive mapping rewrite, multi-user collapse)." This is the new probe the activity-component sidecar emits — bounded to the UI layer.

### New evidence (supplementary)

- The Activity.tsx sidecar primary-source cites the FILTERS.tsx file:line `components/Activity/Filters/Filters.tsx:93-98` (the `<MultipleFilter filterName='userIds' name={t('User')} />` declaration) as the PAGE-ROOT instance of the LSN-020 surface. Combined with the en.json sidecar (i18n key file) and the ActivityController sidecar (SQL bind), the LSN-020 drift is now structurally triangulated at FOUR layers: (1) the i18n key file, (2) the page-root component file (Filters.tsx), (3) the live doc copy, (4) the SQL bind.
- The Activity.tsx sidecar's stress_findings.name_behavior_pairs at lines 172-178 verbatim restates the round-trip: "The label says 'User'; the live doc says 'performed by'; the implementation says owner-of-the-actor-via-mapping." This is the most concise three-sentence summary of the drift in the catalog so far.

### New operator-impact dimensions surfaced

1. **PAGE-ROOT visibility — operator's first encounter**: the en.json sidecar (batch ZJ) confirmed the i18n key ships the misleading label to every locale; THIS sidecar confirms the page-root COMPOSITION (Activity.tsx itself) sources the children that render the misleading label. The first operator-encounter surface is now structurally identified — operators land on `/activity` via the AppToolbar tab; the Filters child renders the User filter at xs=3 left-column position; the operator's first scan of the page surfaces the drift immediately.
2. **The cross-effect with the FIVE-query-per-filter-change performance gap**: per Activity.tsx sidecar `performance.hot_paths[0]`: "Every queryParams change triggers FIVE backend queries via the `useEffect([queryParams])` in ActivityResults.tsx:47-50". An auditor twiddling the User filter generates 5 queries per twiddle; if the filter twiddling produces audit-misleading results (the LSN-020 drift), the operator is generating cost AND getting misleading data. Combined surface: high-cost-low-quality interaction.
3. **The default `type=ALL` tab compounds the visibility scope**: per Activity.tsx sidecar `security.owner_scoping`: "BYPASSES — the component does not invoke owner scoping. The backend has no owner gate on /api/activity (default `type=ALL`). The `type=MY_OBJECTS` tab IS owner-scoped but only when the user explicitly selects it; the default landing tab is `ALL`." So the User filter operates over the FULL platform's activity by default — the LSN-020 drift compounds with the read-collaborative posture (DOC-GAP-082 META cross-link).
4. **The auditor's mental-model trap is more severe at the global page than at the per-entity Activity tab**: per Activity.tsx sidecar — operators land at `/activity` first (toolbar tab + direct URL nav); the per-entity Activity tab requires already-knowing the entity. The LSN-020 drift's primary audit surface IS the global page; the live doc reinforces the wrong promise at the canonical global-page documentation. The fix-leverage is the live doc page + the platform's User filter implementation.

### Triangulation update

DOC-GAP-303 coverage progression:
- batch ZI (original): 1 sidecar (activity route)
- batch ZJ: 1 → 2 sidecars (added en.json i18n)
- **batch ZL: 2 → 3 sidecars** (added Activity.tsx page-root component)

The drift is now structurally complete at FOUR LAYERS: i18n key file (en.json) → page-root component (Activity.tsx) → child filter component (Filters.tsx) → SQL bind (ReactiveActivityRepositoryImpl.java). The live doc page reinforces the wrong promise at the canonical operator-facing surface. Every layer agrees on the wrong promise; the right column (`activity.created_by`) is read but never filtered. **The triangulation is now sufficient for the maintainer to file a tracking issue without further substrate enrichment.**

### Proposed doc action update

The existing DOC-GAP-303 proposed action (TWO-PART — doc-side rewrite + cross-link sweep + code-side three-option ladder) STILL APPLIES; batch ZL adds NO new action items but reinforces the existing ones:

1. **Doc-side PRIMARY remains the priority**: rewrite the User filter description on `documentation/docs/features/active-platform-features/activity-feed.md` (live page). The TRIANGULATION at four layers means the fix-leverage of the doc-side correction is now the highest in the catalog — one doc page rewrite closes the operator-facing surface across every locale + every component + every URL entry-point.
2. **The i18n-quick-fix (batch ZJ) and the doc-side rewrite are now BOTH viable PARALLEL paths**: rename the en.json key to `Affected Entity Owner` (+ propagate to 5 locales) AND rewrite the doc page. Either alone is operator-relief; both together close the loop.
3. **Code-side options unchanged**: the three-option ladder (Minimum rename / Medium add createdByIds / Full fix the filter) remains. The Activity.tsx sidecar adds no new technical option but reinforces the recommended path: the FULL fix is operator-mental-model-aligning.

### Cross-references update

Add to existing DOC-GAP-303 cross-references:
- **DOC-GAP-312 NEW (batch ZL)** — Alerts All-tab OPEN-only Category B drift — sibling drift class instance (the live doc actively WRONG on a canonical alert-triage surface); both findings on canonical operator-audit surfaces.
- **DOC-GAP-317 NEW (batch ZL)** — Alerts page tab badge totals stale — sibling Alerts.tsx UI primary source; the cluster of Alerts-page UI findings (DOC-GAP-312 + DOC-GAP-317 + the existing DOC-GAP-002 / DOC-GAP-026) parallels the Activity-page UI findings (DOC-GAP-303 + existing DOC-GAP-025 / DOC-GAP-200 / DOC-GAP-202).
- **DOC-GAP-316 NEW (batch ZL)** — Spring scheduling single-thread default — cross-link via the activity-feed performance dimension: the FIVE queries per filter-twiddle compound with the housekeeping single-thread blocking pattern.

### Severity update

Severity remains **HIGH** — the four-layer triangulation reinforces the original assessment without changing the class. Batch ZL's Activity.tsx primary source adds STRUCTURAL DEPTH (the page-root composition layer) but no new severity vectors. Severity is HIGH because: (a) compliance/security audit use-cases rely on the filter at the canonical operator-audit surface; (b) the misleading label compounds across four layers (doc + i18n + page-root + child component); (c) the natural-keys i18n pattern + the absent locale corrections + the live doc's reinforcement together ship the misleading label to every operator at every locale; (d) the right column (`activity.created_by`) is read but never filtered — the drift is enforced by the absence of one SQL clause.

---

**Batch ZL contribution**: 1 NEW PRIMARY UI-COMPONENT PAGE-ROOT SOURCE (Activity.tsx sidecar); coverage 2 → 3 sidecars; four-layer LSN-020 drift triangulation now structurally complete (doc + i18n + page-root + child + SQL); 1 NEW PROBE (P-190 — UI-layer LSN-020 confirmation); severity unchanged (HIGH); proposed doc action unchanged (the existing doc-side primary remains the highest-leverage fix).
