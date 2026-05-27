# SHB-183 — F-017 housekeeping clarification (sidecar grep-scoped evidence stale)

- **Category**: open
- **Seeded from**: scanner-feed/2026-05-27-SR-20260527T2330Z.yaml (docs-coverage-undocumented-features batch-11)
- **Cluster_with**: F-017, F-010 (SearchFacetsHousekeepingJob)
- **Severity**: MEDIUM (substrate hygiene — sidecar evidence is stale; the bug-class observations remain valid)

## What surfaced

F-017's `observed_vs_expected.facets[]` entry `side_effect_update_on_every_get` contains this assertion (verbatim from `lineage/odd-platform/feature-flows/detail/F-017.yaml:696-697`):

> "the `last_accessed_at` field is updated but is NEVER READ by any housekeeping job (verified by `grep search_facets V0_0_52__introduce_housekeeping.sql` — zero matches). The field is dead — written but unused."

The grep cited was scoped to **the migration file only** (`V0_0_52__introduce_housekeeping.sql`), which adds the COLUMN but does not define an eviction policy in SQL. The actual eviction policy lives in **Java code** at:

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/SearchFacetsHousekeepingJob.java:23-27`

Verified verbatim 2026-05-27 by the batch-11 scan:

```java
final int deletedSearchFacets = dslContext
    .deleteFrom(SEARCH_FACETS)
    .where(SEARCH_FACETS.LAST_ACCESSED_AT.lessOrEqual(
        DSL.currentOffsetDateTime().minus(housekeepingTTLProperties.getSearchFacetsDays())))
    .execute();
```

The job DOES delete search_facets rows by `last_accessed_at` cutoff. The `housekeepingTTLProperties.searchFacetsDays` is the F-010 Housekeeping TTL config key (default per F-010 sidecar: 30 days).

## What this means for F-017

Two F-017 facet sub-claims need amendment:

1. **`side_effect_update_on_every_get` facet** — the sub-claim "dead column" is **incorrect at HEAD**. The `GET-is-a-write` posture (the side-effect UPDATE on every read) and the row-lock contention observations REMAIN VALID; the "dead column" framing should be removed.

2. **`session_state_accumulates_forever` facet** — this facet is **incorrect at HEAD**. There IS a housekeeping TTL eviction, default 30 days per F-010. The facet should be REMOVED (or REFRAMED as: "TTL eviction at `housekeeping.ttl.searchFacetsDays` cadence; operators reconfiguring this to a high value AND deploying long-running platforms see growth").

## Why this matters methodologically

The case is a small but instructive example of grep-scope drift: a sidecar's `bugs_limitations_corner_cases` evidence cited a grep that was correct AT THE FILE SCOPE BUT NEGATIVELY MISLEADING AT THE CODEBASE SCOPE. A future grep over the broader codebase (e.g. `grep -r SEARCH_FACETS /odd-platform-api/src/main/java/`) would have found the housekeeping job's import. **Lesson**: when asserting "X is not referenced anywhere," scope the grep wide enough to cover both SQL and Java; one or the other in isolation is insufficient when both layers can implement the behaviour.

This is methodology-relevant for the grep-scoping checks called out in the case-law: any "no consumer found" or "no policy found" claim should be cross-referenced at both the SQL migration tier AND the Java code tier when the behaviour spans both.

## Recommended actions

- [ ] Amend F-017's `side_effect_update_on_every_get` facet `observed` block: remove the "dead — written but unused" sub-claim; keep the GET-is-a-write + row-lock-contention sub-claims.
- [ ] Remove (or downgrade-and-reframe) F-017's `session_state_accumulates_forever` facet.
- [ ] Cross-link F-017 to F-010 in `related_features:` (the housekeeping TTL surface that owns the eviction).
- [ ] Add a case-law note to `retrospectives/` about the grep-scoping lesson (single file vs codebase) — once one more such drift surfaces, this graduates from SHB to LSN.

## Provenance

- Scan run: SR-20260527T2330Z (`lineage/odd-platform/scanner-feed/2026-05-27-SR-20260527T2330Z.yaml`)
- Findings file: `findings/docs-coverage-undocumented-features/2026-05-27-batch-11.md#F-017d`
- Primary-source evidence: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/job/SearchFacetsHousekeepingJob.java:1-31` (read end-to-end 2026-05-27)
- Originating F-017 sidecar evidence: `lineage/odd-platform/feature-flows/detail/F-017.yaml` (facet `side_effect_update_on_every_get` + `session_state_accumulates_forever`)
- F-010 Housekeeping sidecar (the cross-link): batch-7 findings + `lineage/odd-platform/feature-flows/detail/F-010.yaml`
