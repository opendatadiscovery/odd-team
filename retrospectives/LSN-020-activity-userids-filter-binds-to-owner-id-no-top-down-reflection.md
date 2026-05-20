---
id: LSN-020
title: Activity Feed `userIds` query parameter binds to `OWNER_ID`; methodology had no per-parameter Category-F interrogation AND no top-down feature reflection
date: 2026-05-21
domain: ontology / feature-anchored-synthesis
severity: high
gates_informed:
  - .claude/agents/file-analyser.md (Category F added to Stress Protocol, rev 5)
  - .claude/agents/feature-reflector.md (new Layer 4b subagent, rev 5)
  - APPROACH.md sections 2, 3, 5 (Failure D added; Layer 4b added; rules 13-15 updated/added)
  - APPROACH.md section 14 (Category F added to Stress Protocol)
  - APPROACH.md section 15 (new — Top-down product-owner reflection)
status: closed
---

# LSN-020: Activity Feed `userIds` filter binds to `OWNER_ID` — methodology had no per-parameter interrogation AND no top-down reflection

## What happened

The maintainer reported a well-known issue with the Activity Feed user-filter:

> On the Activity tab (from the main page or on each Data Entity) there is a possibility to filter out Activities made by users. User name is recorded to the underlying audit table. There is a filter to find records by user name by for now it looks for Owners and filters out records changed by the associated Owners. It leads to some issues:
> - If user does not have an association with Owner we could not filter out records by the user.
> - If Owner — User association is changed during the time filter mistakenly filters records for wrong users.
> Proposed solution: use values from the audit table for Users directly.

The bug is in `ReactiveActivityRepositoryImpl.java:272-273`:

```java
if (CollectionUtils.isNotEmpty(userIds)) {
    conditions.add(USER_OWNER_MAPPING.OWNER_ID.in(userIds));
}
```

The query parameter is named `userIds` (controller: `ActivityController.java:30-31`); the service forwards it (`ActivityServiceImpl.java` — eight call sites, all preserving the parameter name); the repository binds it to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. The audit column `activity.created_by` (a text column carrying the actual actor's username — `OIDC_USERNAME`) is READ in the LEFT JOIN at lines 220-222 and SELECTED in the result mapping, but ABSENT from WHERE. The filter the parameter name promises (filter by who-performed-the-action) is NOT what the SQL does (filter by owner-of-entity via the user-owner mapping).

The methodology at rev 4 had already enriched the `ActivityController` sidecar 3+ times (`session-2026-05-20-T01`, `T02`, `T03`) with `file-analyser/0.4.0` running the Stress Protocol's five categories on each pass. The sidecar:

- **Flagged** "User-id and owner-id enumeration" as a security concern (sidecar's `tests_coverage_semantic` block, `bugs_limitations_corner_cases` block).
- **Described** the LEFT JOIN on USER_OWNER_MAPPING correctly (downstream_side_effects block).
- **Documented** the provider-null cross-mode-bleed pattern (security.known_security_gaps block — based on the JOIN being `OIDC_USERNAME`-only without provider qualifier).
- **Captured** the SizeParam REQUIRED-IN-SPEC vs NULLABLE-IN-JAVA drift via Category F's predecessor reasoning under STRESS_A1.

But it did NOT ask the question "the parameter is named `userIds`, the SQL filters by `OWNER_ID` — does the parameter NAME match the COLUMN it binds to, and if not, what does a caller see?". The sidecar shipped with `confidence: HIGH` and `prompt_version: file-analyser/0.4.0` — three times.

Meanwhile, the F-021 (Activity Feed) feature-flow detail had been refreshed across batches R + T + U + V + VAL-LSN-019-B, accumulating 14+ drift_class facets covering audit-silence patterns, cross-mode bleed, cursor pagination, etc. — but none of those drift classes named the user-filter-vs-owner-id mismatch as a facet. The methodology had no top-down pass asking "what does this feature PROMISE users, and does the assembled chain DELIVER it?". The feature-flow-builder composed the chain mechanically; reducers aggregated facts about the chain mechanically; no layer stepped back to ask the user-facing question.

The maintainer caught the bug not via the ontology, not via any probe, not via any reducer, but by knowing the codebase and remembering an outstanding issue. The ontology was silent on the user-visible failure mode.

## Why it slipped

Structural cause, not personal. Two compounding gaps:

### Gap 1 — per-file: Stress Protocol Category B catches METHOD-name drift but no category catches PARAMETER-name drift

`tagService.listMostPopular` was caught by Category B (LSN-019): method name promises ordering by popularity, SQL has no `ORDER BY count`, drift surfaced. Category B's trigger list: *method names whose verbs promise observable behavior, endpoint annotations, javadocs / comments making behavioral claims*. Parameter names are NOT in the trigger list.

Yet parameters carry promises too. `userIds` says "user ids"; `ownerIds` says "owner ids"; `entityName` says "entity name". When the implementation translates the parameter into a different column or scope without explanation, the caller has no way to know — the API surface and the docs both reflect the parameter name. The translation is silent.

The Activity Feed sidecar's Stress Protocol passes had **5 Category-A tunable entries, 3 Category-B name-behavior entries (on METHOD names: `getActivity`, `getActivityCounts`, the validation `Mono.just(Flux.error())` shape), 4 Category-C ordering entries, 5 Category-D auth-gate entries, 1 Category-E resource-boundary entry** — and **zero questions about whether `userIds` filters by what its name promises**. The parameter was mentioned in security findings (id enumeration), in performance findings (no upper bound), and in the SQL trace (LEFT JOIN on USER_OWNER_MAPPING) — but never interrogated for name-vs-implementation alignment.

The fix per-file: **Category F — request-input naming alignment**. Every named query parameter / request DTO field / path variable / header fires a fixed question list: what does the input NAME promise? what does the implementation USE it for (traced through the chain)? does the actual scope MATCH the promise (MATCHES / TRANSLATES_LEGITIMATELY / TRANSLATES_SILENTLY / UNRESOLVED)? for TRANSLATES_SILENTLY drift — what does a caller see when their assumption is wrong? is there an available-but-unused column that DOES match the input name? See file-analyser.md Rule 9 + APPROACH.md section 14.

### Gap 2 — cross-file: no top-down pass asks "what does the assembled feature PROMISE users?"

Even if Category F had existed at rev 4, it would have caught the per-file drift inside `ReactiveActivityRepositoryImpl`'s SQL. But the broader semantic failure — the FEATURE called "Activity Feed" promises an audit-trail filter by user, the chain delivers an ownership-derived filter — is a cross-file question. Per-file interrogation catches it locally; top-down reflection frames it as the user encounters it AND ensures the question gets asked at all.

The rev-4 architecture had Layer 4a (feature-flow-builder) for bottom-up composition: thread the chain, compute amplification factors, classify drift into known classes. It did NOT have a Layer 4b for top-down reflection: step back from the assembled chain, write the product-owner narrative, generate falsifiable user-facing hypotheses, validate each by tracing the chain.

A senior engineer reviewing the Activity Feed would naturally do both: read the code (bottom-up) AND step back to ask "if I were a user, what would I expect?" (top-down). The methodology at rev 4 only did the first.

The fix cross-file: **Layer 4b — feature-reflector subagent**. For each composed feature flow, write a 3-5 paragraph product-owner narrative; generate 5-15 falsifiable hypotheses derived from eight seed sources (endpoint shape / response shape / view-mode dispatches / UI labels / pillar mission / cross-pillar promises / doc claims / negative-space); validate each by tracing the implementation chain; surface contradictions as bug-candidates with operator-visible failure modes. See `.claude/agents/feature-reflector.md` + APPROACH.md section 15.

### Why neither gap was caught at the rev-4 design review

Rev 4 was designed in response to LSN-019 (`listMostPopular` drift), which is a method-name-vs-implementation case. Method names are the most visible "name carries a promise" signal — the rev-4 design correctly focused on them. The parameter-name surface is more numerous (each controller has 5-15 parameters; method names per controller are 2-5) and the bug class is structurally identical, but it did not appear in the LSN-019 case and was therefore not designed against. Similarly, the bottom-up composition discipline at Layer 4a was sufficient to surface the F-006 audit-silence pattern (because reducer aggregation across 9+ sidecars surfaced the cross-cutting drift class), but NOT sufficient to surface a single-feature semantic mismatch that requires asking "what does the user expect?" rather than "what does the code do across files?".

The lesson: **interrogation at one layer does not propagate to another**. The Stress Protocol at Layer 2 closes the per-file transcription gap; an analogous discipline at Layer 4 is needed to close the per-feature reflection gap. Both gaps shipped with `confidence: HIGH` for weeks; both required the maintainer's empirical knowledge to catch.

## Rule that emerged

Two complementary additions, both non-negotiable:

### Rule A (file-analyser / 0.5.0) — Stress Protocol Category F: request-input naming alignment

Every named path parameter / query parameter / request body DTO field / header fires a fixed question list. Plus inverse-direction triggers on the implementation side: every SQL WHERE predicate where the variable and column names diverge semantically; every column read in JOIN/SELECT but absent from WHERE where the column name suggests the user expected to filter by it. Five questions per trigger; verdicts MATCHES / TRANSLATES_LEGITIMATELY / TRANSLATES_SILENTLY / UNRESOLVED. TRANSLATES_SILENTLY routes a HIGH-severity entry into `bugs_limitations_corner_cases` AND a doc-drift entry into `docs_link_semantic.doc_drift_findings`. **No triggered question may be skipped.** A sidecar with `stress_findings.request_inputs == []` on a controller / handler / route is REJECTED.

### Rule B (feature-reflector / 0.1.0) — Layer 4b: top-down product-owner reflection

For every composed feature flow, a feature-reflector pass runs after feature-flow-builder. Output: a 3-5 paragraph product-owner narrative (each claim cited) + 5-15 falsifiable user-facing hypotheses (each from one of eight seed sources) + per-hypothesis verdicts (confirmed / contradicted / partial / probe-needed). Contradictions enumerate operator-visible failure modes and route to bug-candidate or caveat-candidate. Probe-needed verdicts emit probe-skeletons (`emitted_by: feature-reflector`, `status: pending-reflection-verification`). Documentation is a cross-reference, never the source of intent — intent is reasoned from code-internal signals (endpoint shape, DTO names, UI labels, pillar mission, available-but-unused data).

The reflector runs on every feature flow on substantive refresh; maintainer-curated hypotheses survive across refreshes; superseded contradictions move into a `superseded_by_refresh` block so the audit trail survives.

## Forcing question

> "When a user passes `userIds=[42]` to `GET /api/activity`, does the response contain activity rows where the user with id 42 PERFORMED the action — or does it contain activity rows where the entities involved are OWNED by an owner derived from id 42 via the user-owner mapping?"

The Stress Protocol at rev 4 had no path to generate this question. The rev-5 file-analyser fires Category F on `userIds` automatically; the rev-5 feature-reflector generates the hypothesis automatically as part of its endpoint-shape seed pass. Either layer catches the bug; both layers running provides defence in depth.

## References

- ReactiveActivityRepositoryImpl.java:272-273 — the bug (line confirmed 2026-05-20 via grep)
- ReactiveActivityRepositoryImpl.java:220-222 — the LEFT JOIN that READs `OIDC_USERNAME` from the audit row but never filters on it
- ActivityController.java:30-31 — the controller surface declaring `userIds: List<Long>`
- ActivityServiceImpl.java:81-272 — the 8+ call sites that forward `userIds` unchanged from controller to repository
- lineage/odd-platform/understanding/odd-platform__java__ActivityController__controller-class__ActivityController.md (rev 0.4.0, session-2026-05-20-T03) — the sidecar that flagged "user-id enumeration" but never interrogated user-vs-owner naming
- lineage/odd-platform/feature-flows/detail/F-021.yaml — the feature flow that accumulated 14+ drift facets but never surfaced the user-filter-vs-owner-id mismatch as a facet
- LSN-019 — the rev-4 case-law (method-name drift). Category B catches METHOD-name drift; Category F (rev 5) is the structural analogue for PARAMETER-name drift.
- LSN-017 — the rev-2 case-law (per-node scan cannot see cross-layer effects). Bottom-up composition at Layer 4a closed part of that gap; top-down reflection at Layer 4b closes the rest.
- APPROACH.md sections 2 (Failure D), 3 (Layer 4b row in architecture table), 5 (Rules 13-15), 14 (Category F row in Stress Protocol table), 15 (full top-down reflection section).
- .claude/agents/file-analyser.md rev 0.5.0 — Stress Protocol Rule 9 / Category F section + schema additions.
- .claude/agents/feature-reflector.md rev 0.1.0 — the new subagent's system prompt.
- .claude/skills/reflect-feature/SKILL.md — the maintainer-facing /reflect-feature slash command.
