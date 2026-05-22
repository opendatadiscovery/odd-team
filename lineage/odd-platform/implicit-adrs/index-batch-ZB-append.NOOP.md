<!--
batch-ZB append-file — implicit-adrs index

Frontmatter count deltas (orchestrator applies to index.md frontmatter):
  sidecar_count: +5  (DataSourceController 5 method-level nodes)
  total_candidates: +0  (zero new ADR candidates this batch — wisdom test sent all gap-shaped findings to refactoring-scopes)
  candidates_by_category: unchanged
  candidates_by_severity: unchanged
  Add to frontmatter:
    batch_2026_05_21ZB_summary: { added_adrs: 0, strengthened_adrs: 2, added_scopes: 10, strengthened_scopes: 8, wisdom_test_passes: 0, wisdom_test_reclassifications: 9, sidecars_consumed: 5, coherence_supersedes: 1 }

NO new "## ADR-CANDIDATE-NNN" headline lines below the marker — batch ZB minted zero ADR candidates.
The two strengthens below are recorded in the detail files (ADR-CANDIDATE-017.md, ADR-CANDIDATE-068.md);
this block is the index-level refresh note for the orchestrator's awk-merge.
-->

## Refresh note — batch ZB (2026-05-21 — DataSourceController endpoint-surface method-level deepening)

Five new method-level sidecars enriched the DataSourceController endpoint surface (batch W had enriched only the controller CLASS node): `getDataSourceList`, `registerDataSource`, `updateDataSource`, `deleteDataSource`, `regenerateDataSourceToken`. Per the Rule-0 3-question wisdom test, **zero new ADR candidates** were minted — every ADR-shaped finding in these sidecars triangulates onto an EXISTING ADR candidate, and every other finding is GAP-shaped (→ `refactoring-scopes.md`, REFACTOR-581..590 + 8 strengthens). The batch is the expected GAP-heavy shape for an endpoint-deepening pass.

**2 existing ADR candidates STRENGTHENED**:

- **ADR-CANDIDATE-017** (token-rotation / shared-secret model) — STRENGTHENED to **6-sidecar** support. `regenerateDataSourceToken`, `getDataSourceList`, `registerDataSource` surface the SAME token model — in-place-UPDATE rotation, plaintext-on-rotate/masked-on-read via `TokenDto.showToken`, plaintext `String.equals` verification — on the **DataSource** credential family. The data-source token and the collector token share ONE `token` table + ONE `TokenGeneratorImpl` + ONE `ReactiveTokenRepositoryImpl`; the ADR broadens from "Collector tokens" to "every `token` row." NEW FACET added: token-always-minted-server-side at registration (`DataSourceFormData` has no token field — the caller cannot supply one; `DataSourceServiceImpl.java:54` mints unconditionally). The decision should be re-scoped on promotion to cover both credential families.

- **ADR-CANDIDATE-068** (two-tier soft-delete inheritance taxonomy) — STRENGTHENED. `deleteDataSource` is the first method-level primary-source confirmation that `data_source` (named in bullet (a) by inference) is a genuine **base-tier** soft-delete entity — `ReactiveAbstractSoftDeleteCRUDRepository.delete` inherited, `deleted_at` timestamp, no Tier-2 status-machine override. Support now 5-sidecar. The data-source delete adds a service-tier `CascadeDeleteException` cascade-guard ON TOP of the base soft-delete — recorded as a facet of this ADR (the data_source delete precondition within the soft-delete lifecycle), NOT a thin standalone single-sidecar ADR; the cascade-guard's operator consequences are GAP-shaped (REFACTOR-581/582/583).

**Wisdom-test reclassifications (9 — all GAP-shaped, sent to `refactoring-scopes.md`)**: registerDataSource NAMESPACE_CREATE bypass; 201-not-200 status drift (register POST + update PUT); updateDataSource MapStruct SET_TO_NULL REPLACE-not-MERGE silent field-wipe; deleteDataSource orphan-token + uncleared-FTS-vector + actively-ingested-undeletable; regenerateDataSourceToken null-token-opaque-500; data_source no-optimistic-lock lost-update; data_source no-Activity-Event on register/update/delete; registerDataSource no-FTS-on-create; registerDataSource oddrn-required-vs-optional contract understatement. Each failed ≥2 of the 3 wisdom-test questions — the absence has no stated rationale and addressing it is refactoring within the existing structure (e.g. NAMESPACE_CREATE bypass is the documented Owner/Title side-channel family per ADR-CANDIDATE-065's framing; REPLACE-not-MERGE rests on a MapStruct framework default with no comment defending it).

**Borderline findings considered and NOT promoted**: (a) updateDataSource's 404-fail-fast `switchIfEmpty(NotFoundException)` guard — intentional, but the codebase is INCONSISTENT on it (`DataEntityServiceImpl.upsertDescription` deliberately omits the same guard and returns silent-200), so it is NOT a coherent architectural decision — it is a per-endpoint correctness property, recorded as a coherence observation only; (b) registerDataSource's null-username token-attribution fallback — intentional `switchIfEmpty(generate(null))`, but too local (one helper method, expected behaviour under `auth.type=DISABLED`) to be ADR- or even scope-shaped.

**Cross-batch correction (Rule 6)**: the `regenerateDataSourceToken` method-level sidecar — a primary-source line-by-line read of `DataSourceServiceImpl.java:99-106` — refutes any framing of the missing `@ReactiveTransactional` as an atomicity bug. The method does one in-memory mutation + one atomic single-statement jOOQ UPDATE; there is NO old-invalidated-but-new-not-persisted window. The missing annotation is a LOW code-shape inconsistency. The test-map registry's `TEST-GAP-749` carries a stale CRITICAL split-state framing this read refutes — logged to `state/coherence-conflicts-batch-ZB.md` as a SUPERSEDES for the maintainer / test-mapper to resolve.

<!-- NEW-HEADLINES-BELOW (batch ZB minted zero ADR candidates — none) -->
