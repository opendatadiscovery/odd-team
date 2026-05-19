## REFACTOR-328 — No housekeeping-job ordering contract — `List<HousekeepingJob>` injection order is Spring-discovered, not explicitly declared; a future sixth job added to the package would run in an undefined position

**Severity**: LOW
**Category**: observability (undefined-order behaviour)
**Pillars affected**: [P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:bugs_limitations_corner_cases.[7]` (LOW) — "No housekeeping-job ordering contract — the `List<HousekeepingJob>` injection at line 23 receives beans in Spring's discovered order, which is not explicitly declared anywhere. A future job with cross-job dependencies (e.g. 'a new TermHousekeepingJob must run BEFORE DataEntityHousekeepingJob to avoid stale FK references') would silently inherit whatever order Spring picks. No `@Order` annotations, no `@DependsOn`, no explicit list ordering in the manager. Today's five jobs operate on disjoint table sets so order is irrelevant, but the contract is fragile to extension."

**Description**: Same shape as REFACTOR-310 (Notifications sender iteration order) but for housekeeping jobs. `HousekeepingJobManager.java:23` declares `private final List<HousekeepingJob> housekeepingJobs;` — Spring injects all `@Component`-registered `HousekeepingJob` beans into the list. Spring's bean-collection order is class-scan-order in practice (package layout + naming + conditional registration). There is NO `@Order` annotation on any of the five jobs, NO `@DependsOn`, NO explicit sort.

**Failure mode**: A maintainer adds `TermHousekeepingJob` to the `housekeeping/job/` package, expecting it to run AFTER `DataEntityHousekeepingJob` (so that term-link rows reference still-existing data-entity rows). Spring picks an order putting Term first (e.g. alphabetically). The first cycle after deploy: TermHousekeepingJob fires, DataEntityHousekeepingJob fires, and the term-link deletions reference data-entities that DataEntityHousekeepingJob then also deletes — a sequence the maintainer didn't anticipate. The dependency is order-dependent and silent.

**Primary source citations**:
- `HousekeepingJobManager.java:23` (`private final List<HousekeepingJob> housekeepingJobs;`)
- `housekeeping/job/AlertHousekeepingJob.java + .../SearchFacetsHousekeepingJob.java + .../DataEntityHousekeepingJob.java + .../ActivityEmptyPartitionsHousekeepingJob.java + .../MessageEmptyPartitionsHousekeepingJob.java` (no @Order annotations on any of the five)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-101 (per-job failure isolation) frames the failure-handling stance — operates on the per-job loop; the order is below the framing layer.

**Proposed remedy**: Add `@Order(N)` on each `HousekeepingJob` `@Component` with N chosen for the desired sequence. Document the ordering contract in the housekeeping package's package-info.java or in a comment block on `HousekeepingJobManager`. The fix is O(5) lines.

**Severity rationale**: LOW — latent fragility; today's five jobs operate on disjoint tables so order is irrelevant; a future job with cross-job dependencies could regress silently.

**Suggested backlog grouping**: `Housekeeping safety sprint` (small code-hygiene item)

---
