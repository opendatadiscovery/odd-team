- **DOC-GAP-060**: Housekeeping docs frame the subsystem as "three cleanup tasks" but code has 5 HousekeepingJob beans — `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` are undocumented
  - **Category**: drift
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md:docs_link_semantic.doc_drift_findings.[1]` **(NEW batch D)**
    - `concepts.yaml:entities[Housekeeping TTL]`
    - **NEW batch K**: `odd-platform__java__service__service__HousekeepingJobManager.md:docs_link_semantic.doc_drift_findings.[0]` (severity MEDIUM per sidecar — orchestrator primary-source confirmation of the 3-vs-5 framing) + `:bugs_limitations_corner_cases.[0]` ("Doc-drift: docs claim 'three cleanup tasks', code defines five") + `:concepts.invariants.[6]` (verbatim live-doc quote re-verified this session)
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-19 status 200 (verified this session) — verbatim: "iterates through three cleanup tasks: resolved alerts, search-facet history, and soft-deleted data entities." Quote re-confirmed against the same live page in this batch.
    - HousekeepingTTLProperties.md verifies code reality: `HousekeepingJobManager` iterates `List<HousekeepingJob>` — Spring autowires FIVE implementations: `AlertHousekeepingJob`, `SearchFacetsHousekeepingJob`, `DataEntityHousekeepingJob`, plus `ActivityEmptyPartitionsHousekeepingJob` and `MessageEmptyPartitionsHousekeepingJob` (both extend `EmptyPartitionsHousekeepingJob`). The two empty-partitions jobs run on the same 15-minute schedule and drop empty past partitions for the activity / message tables.
    - **NEW batch K**: HousekeepingJobManager sidecar primary-source confirms the mechanical pickup: `HousekeepingJobManager.java:23` (`private final List<HousekeepingJob> housekeepingJobs;`) is the Spring `@RequiredArgsConstructor`-injected collection; per sidecar's `dependencies_semantic.requires-feature.[0]`: "Spring's component-scan finds every `@Component` implementing the interface" — picking up all five mechanically without any registration ceremony the docs could be referencing as "three". The orchestrator has no `@Order`, no `@Qualifier`, no explicit list-construction; the five-job count is structural truth.
  - **Proposed doc action**: Update the housekeeping section's enumeration to "five cleanup tasks" — three row-by-age DELETE jobs (alerts / search-facets / data-entities) plus two empty-partitions DROP jobs (activity / message). Cross-link the empty-partitions jobs to the partition-period config keys (`odd.activity.partition-period`, `datacollaboration.message-partition-period`) and clarify that empty-partition-drop ≠ row-by-age retention (the partitions must be already empty — see DOC-GAP-041, DOC-GAP-061).
  - **Cross-references**: DOC-GAP-041 (activity retention claim drift); DOC-GAP-061 (message retention gap); LSN-001 class (partial-coverage docs).
    - **NEW batch K**: DOC-GAP-148 (per-job transaction-handling asymmetry — `SearchFacetsHousekeepingJob` runs in auto-commit; the others wrap in `DSL.transaction(...)`) — sibling housekeeping doc-completeness finding
  - **Severity rationale**: MEDIUM — operators reading the housekeeping section cannot learn that the same scheduler also drops empty activity/message partitions; the gap is incomplete-coverage rather than incorrect-content.

#### Batch 2026-05-19-K STRENGTHENS — orchestrator-tier primary source

- HousekeepingJobManager sidecar (3rd sidecar on the 3-vs-5 framing; first ORCHESTRATOR-tier primary-source) confirms:
  - the mechanical Spring `List<HousekeepingJob>` injection at `HousekeepingJobManager.java:23` PICKS UP all five jobs; no registration ceremony the docs could be naming as "three".
  - the per-cycle behaviour at `HousekeepingJobManager.java:32-35` iterates the full list sequentially on one shared JDBC connection — all five jobs DO run per cycle.
  - the live-doc quote was re-verified at status 200 in this session; the drift is current as of 2026-05-19.
- 3-sidecar triangulation: HousekeepingTTLProperties (config layer) + HousekeepingJobManager (orchestrator layer) + live doc page. Doc-side action stands; the framing fix is a one-paragraph update.
