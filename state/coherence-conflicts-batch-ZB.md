# Coherence conflicts — batch ZB (2026-05-21)

Rule-6 pre-emit coherence check, adr-archaeologist reducer, batch ZB (DataSourceController
endpoint-surface method-level deepening — 5 sidecars).

This file records cross-registry coherence findings that the adr-archaeologist reducer
cannot itself resolve (the conflicting artefact lives in a registry owned by a different
reducer). The maintainer / owning reducer reviews this file before the next batch fires.

---

## SUPERSEDES-1 — test-map `TEST-GAP-749` carries a stale CRITICAL atomicity-bug framing of `regenerateDataSourceToken`'s missing `@ReactiveTransactional`; the batch-ZB method-level primary-source read refutes it

**Conflicting artefact**: `lineage/odd-platform/test-map/index.yaml` — `TEST-GAP-749` (`detail/TEST-GAP-749.yaml`, `feature_id: F-020`, `test_class: missing-security`, `criticality: CRITICAL`).

**Relationship**: SUPERSEDES (Rule 6 step 4 — opposite polarity AND the new finding's evidence is strictly stronger).

**What TEST-GAP-749 asserts** (the stale framing): `DataSourceServiceImpl.regenerateDataSourceToken`
(lines 99-106) being NOT `@ReactiveTransactional` "creat[es] a split-state failure where the
operator receives a NEW token in the API response while the DB retains the OLD token." Its
step 4 claims: "the NEW TokenDto has already been emitted into the response stream if the
chain composition uses `.map(ResponseEntity::ok)` before the DB write completes ... a partial
response with the new token may reach the client before the 500 propagates." It rates the
gap **CRITICAL** on the strength of this split-state premise.

**What the batch-ZB primary source shows** (the correction): the batch-ZB
`regenerateDataSourceToken` method-level sidecar is a primary-source line-by-line read of
`DataSourceServiceImpl.java:99-106` + `TokenGeneratorImpl.java:44-52` + `ReactiveTokenRepositoryImpl.java:30-39`.
Its `stress_findings.resource_boundaries` states verbatim:

> "Because step 2 is in-memory and step 3 is one atomic statement, there is NO partial-write
> window: either the UPDATE commits (new token persisted, old gone) or it fails (old token
> entirely intact in DB). There is NO state where the old token is invalidated but the new one
> is not persisted — that failure mode the batch prompt asked about CANNOT occur with the
> current single-statement implementation. ... The missing `@ReactiveTransactional` is
> therefore a latent-risk code-smell ... NOT an active atomicity bug."

**Why TEST-GAP-749's premise is wrong**: the reactive chain is
`getDto(id) → tokenGenerator.regenerateToken(...) → tokenRepository.updateToken(...) → .map(ResponseEntity::ok)`.
The `.map(ResponseEntity::ok)` operator runs ONLY when `updateToken` emits a success value
downstream. If `updateToken` errors (transient DB failure), the `Mono` enters the error
channel — `.map` is skipped entirely and the controller returns an HTTP 500 with NO body.
There is no "partial response with the new token reaching the client." TEST-GAP-749's
step-4 split-state scenario is a misreading of WebFlux `Mono` composition: the response
`ResponseEntity` is never constructed when the upstream DB write fails. The OLD token
remains fully valid in the DB and the operator receives a clean 500; the next retry
succeeds. No old-invalidated-but-new-not-persisted window exists.

**Evidence strength comparison**: TEST-GAP-749 was authored from the batch-W
DataSourceController **class-level** sidecar (an inference about the chain composition).
The batch-ZB finding is the **method-level** sidecar — a line-by-line primary-source read
of the exact service method. The method-level read is strictly stronger evidence → SUPERSEDES,
not CONTRADICTS.

**Recommended resolution** (for the test-mapper reducer / maintainer to apply to the
test-map registry — the adr-archaeologist does not write to `test-map/`):
1. `TEST-GAP-749` criticality: **CRITICAL → LOW**. The missing `@ReactiveTransactional` is a
   code-shape inconsistency (sibling `create`/`update`/`delete` are all annotated), not an
   atomicity bug. It matches `refactoring-scopes` REFACTOR-064 (LOW, transactional-consistency).
2. Correct the `TEST-GAP-749.yaml` `behaviour` text: remove the split-state / "NEW token
   reaches the response stream while DB retains OLD" scenario (steps 4-5). The accurate
   test-gap shape is: a regression-pin asserting (a) the service method is currently NOT
   `@ReactiveTransactional`; (b) on a simulated `updateToken` DB-write failure the controller
   returns HTTP 500 with NO body and the OLD token remains valid (the no-partial-write
   property); (c) a future maintainer adding `@ReactiveTransactional` leaves behaviour
   unchanged for the single-statement shape (the annotation matters only if a second write
   is later added).
3. The `regenerateDataSourceToken` no-grace-period and plaintext-token sub-points TEST-GAP-749
   cites as "compounding" findings remain valid — they are real (REFACTOR-047, REFACTOR-062,
   TEST-GAP-750) — but they do NOT make the missing-`@ReactiveTransactional` itself CRITICAL;
   they are independent gaps with their own (HIGH / MEDIUM) ratings.

**Cross-references**:
- `refactoring-scopes/detail/REFACTOR-064.md` — the canonical (correct, LOW) framing; carries the batch-ZB strengthen + the `supersedes: [TEST-GAP-749]` annotation.
- `implicit-adrs/detail/ADR-CANDIDATE-017.md` — batch-ZB strengthen, "Co-surfaced gaps" section, REFACTOR-064 line.
- Batch-ZB sidecar: `lineage/odd-platform/understanding/odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md` — `bugs_limitations_corner_cases.[0]` + `stress_findings.resource_boundaries` + `coherence_notes` (the `refines` note on the class sidecar).

**Status**: OPEN — for the test-mapper reducer / maintainer. Batch ZB still commits; this
conflict is a signal, not a reducer failure. The `refactoring-scopes` + `implicit-adrs`
registries are internally coherent (REFACTOR-064 LOW is the correct framing); only the
`test-map` registry carries the stale CRITICAL that needs the downgrade.

---

## Summary

- CONTRADICTS surfaced (blocked from registry): 0
- SUPERSEDES surfaced (cross-registry, logged for owning reducer): 1 — TEST-GAP-749 (test-map)
- STRENGTHENS emitted (same-polarity cross-registry back-links): F-010 (feature-flows, via REFACTOR-581), the `concepts/index.yaml` NAMESPACE_CREATE-side-door invariant (via REFACTOR-584), TEST-GAP-755 (test-map, sibling of REFACTOR-581).
