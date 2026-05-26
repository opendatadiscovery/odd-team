# ADR-CANDIDATE-222 — Data Quality Dashboard's "Monitored Tables" ring is INTENTIONALLY scoped to TABLE-type data entities only — Views, Files, Topics, Streams are absent from BOTH "monitored" and "not-monitored" counts

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-04 Data Quality, P-01 Data Discovery (dataset sub-types)]
**Batch**: ZG (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataQualityRunsController__controller-class__DataQualityRunsController.md:implicit_adrs.[4]` (HIGH) — "**Monitored vs Not-Monitored is scoped to TABLE-only, deliberately excluding non-Table datasets.** The CTE filter `DATA_ENTITY.TYPE_ID.eq(DataEntityTypeDto.TABLE.getId())` (`ReactiveDataQualityRunsRepositoryImpl.java:179`) restricts the monitored-tables CTE to TABLE-type entities only. The decision is to make 'monitored' a TABLE-specific concept: Views, Files, Topics, Streams (all valid 'dataset' classes per `DataEntityTypeDto`) are NOT included in either bucket. The intent is operator clarity: the dashboard's 'Monitored Tables' ring labels its slices 'Monitored / Non-Monitored Tables' explicitly (`DataQualityContent.tsx:68-72, 140`), and the doc page confirms 'The Monitored vs Unmonitored framing applies specifically to Table-type datasets'."

**Decision statement**: The `getMonitoredTables` CTE filter `DATA_ENTITY.TYPE_ID.eq(DataEntityTypeDto.TABLE.getId())` (`ReactiveDataQualityRunsRepositoryImpl.java:177-179`) restricts the monitored-tables count to TABLE-type entities ONLY. Non-Table dataset sub-types (Views, Files, Topics, Streams — all valid dataset types per `DataEntityTypeDto`) are NEITHER counted in monitored NOR in not-monitored — they are silently absent from the metric entirely. The live dashboard doc page confirms the restriction verbatim ("The Monitored vs Unmonitored framing applies specifically to Table-type datasets" — WebFetch 2026-05-25 status 200).

The decision encodes a deliberate scoping choice: "monitored" is a TABLE-specific concept because the operator's mental model of "should this be tested?" applies most naturally to tables (the canonical dataset shape with stable schema). Views are derived; their quality is inherited from the underlying tables. Files are typically transient. Topics/Streams are event-shaped, not table-shaped. The maintainer chose to scope the metric rather than dilute it by counting all dataset types.

The structural anchor — the SQL CTE filter — is a literal `DataEntityTypeDto.TABLE.getId()` (not a parameter, not an extensible set). The wire-side response shape `MonitoredTablesDashboard` is named `monitoredTables` + `notMonitoredTables` — the noun "Tables" is in the contract.

**Wisdom test**: PASS. Three intent anchors:
1. **Code-level** — the SQL filter is a literal `TABLE.getId()`, not a configurable parameter; this is a deliberate scoping choice.
2. **Wire-level** — the response field names use "Tables" (not "Datasets"); the contract names the restriction.
3. **Doc-level** — the live dashboard page states the restriction verbatim ("The Monitored vs Unmonitored framing applies specifically to Table-type datasets"); the doc is consistent with the code.

Structural impact: a maintainer wanting to extend the metric to count Views (or any other dataset sub-type) would need to (a) widen the CTE filter, (b) extend the wire-side field naming, (c) update the doc page, (d) update the UI ring's label. All four sites would need coordination.

**Operator-visible consequence**:
- A deployment with 100 Views and 0 Tables shows `monitoredTables: 0, notMonitoredTables: 0` — empty ring, which may read as "nothing has DQ tests" when actually "no Tables exist".
- An operator wanting to monitor View-quality has NO surfacing in this ring. The Test Results ring still shows the View's tests, but the "what % of my datasets are tested" framing is TABLE-only.
- The trade-off: clarity (the ring is unambiguous about what it counts) over completeness (Views are silently excluded even when they DO have tests).

**Existing ADR**: closely related to **ADR-CANDIDATE-058** (Data-entity status as a settable resource property — TABLE-type entities carry the canonical lifecycle). The TABLE-only scoping here is consistent with the platform's tendency to treat TABLE as the canonical dataset shape for several metrics + lifecycle behaviours.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-600** EXISTING — the live dashboard doc is incomplete on multiple axes including Table-Health rules. The TABLE-only scoping IS documented but the operator-surprise (Views silently absent) is not surfaced.

**Proposed action**: Promote to `adrs/drafts/dq-dashboard-monitored-tables-table-only.md` (new ADR). Document:
1. The decision: "monitored" is a TABLE-specific concept; Views, Files, Topics, Streams are absent from both buckets.
2. The structural anchor: SQL CTE filter `DataEntityTypeDto.TABLE.getId()` (literal, not parameterised).
3. The wire-side contract: response field names use "Tables" (not "Datasets") — the contract names the restriction.
4. The doc commitment: live dashboard page states the restriction; deviation between code and doc would require coordinated update.
5. The trade-off: clarity vs completeness; operators with View-heavy deployments see empty rings.

**Severity rationale**: MEDIUM — feature-scoping decision affecting one metric on one ring; load-bearing for the metric's meaning but not security or data-integrity. The decision is invisible at the wire surface unless the implementer reads the SQL CTE or the doc.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-058 (TABLE as canonical dataset shape — platform-wide tendency).
- SUPERSEDES: none.
- CONFLICTS: none. The doc page is consistent with the code; the gap is operator-surprise-shaped, not doc-WRONG.

---
