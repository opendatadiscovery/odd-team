---
probe_id: P-LSN019-createRelationsWithTerm-tx-propagation
source_node: odd-platform java service:TagServiceImpl
source_finding: S-E-1 (iv) (Stress Protocol Category E — resource boundaries, TX propagation)
related_lsn: LSN-019
status: skeleton-emitted
---

# P-LSN019-createRelationsWithTerm-tx-propagation

## What we're testing

`TagServiceImpl.createRelationsWithTerm(termId, tags)` (`TagServiceImpl.java:136-142`) carries `@ReactiveTransactional` (`:137`) despite being a SINGLE-statement method (calls `reactiveTagRepository.createTermRelations(termId, ids)` once). The empirical claim under test: the annotation is present for TX PROPAGATION — the caller (e.g. `TermServiceImpl.upsertTags`) issues a `getOrCreateTagsByName` (which may mint new tag rows) immediately followed by this method, and the two writes must be in the SAME TX so that the term-tag binding is atomic with the tag-directory creation.

Static evidence:
- Line 137: `@ReactiveTransactional` on a single-statement method.
- The caller pattern (per the existing repository sidecar's audiences entry for TermServiceImpl): `TermServiceImpl.upsertTags` calls `getOrCreateTagsByName(...)` to mint tags then `createRelationsWithTerm(termId, tags)` to bind them.
- The `@ReactiveTransactional` propagation default is REQUIRED (Spring's default propagation joins the existing TX if one is active in the caller).

## Setup

1. Code-walk / decompile test — read the bytecode or use `javap` to confirm the `@Transactional("reactiveTransactionManager")` annotation is preserved post-compile.
2. Spring Boot test environment with `TermServiceImpl` + `TagServiceImpl` + Testcontainers Postgres.

## Procedure

### Procedure A — Confirm the annotation propagates

1. Add a test that throws an `IllegalStateException` mid-flight in `createRelationsWithTerm` (e.g. mock `reactiveTagRepository.createTermRelations` to return `Mono.error(...)`).
2. The test wraps the call chain `getOrCreateTagsByName(['novel-name']) → createRelationsWithTerm(termId, [created tags])` within `TermServiceImpl.upsertTags`.
3. After the test, query the `tag` table: `SELECT name FROM tag WHERE name = 'novel-name' AND deleted_at IS NULL`.
4. Expected: ZERO rows (the TX rolled back the tag creation because the relation-bind failed).

### Procedure B — Confirm removing the annotation breaks atomicity

1. Locally remove `@ReactiveTransactional` from `createRelationsWithTerm` (in a branch).
2. Repeat Procedure A.
3. Expected: the `tag` row IS present (the TX rolled back only the failed relation INSERT; the tag-creation INSERT was committed because the caller's TX no longer propagates).

## Expected behaviour (per static reading)

- The presence of `@ReactiveTransactional` makes the TX propagate from the caller (`TermServiceImpl.upsertTags` which carries `@ReactiveTransactional` itself, OR the controller that wraps the service call).
- Removing it would NOT change THIS method's behaviour IF the caller already has an active TX (the default propagation REQUIRED would join the existing TX).
- BUT: if the caller does NOT have a `@ReactiveTransactional` (which is the case if `TermServiceImpl.upsertTags` were ever refactored to drop the annotation), the absence here would mean each statement runs in its own TX — and `getOrCreateTagsByName` + `createRelationsWithTerm` would commit independently.

## Pass / fail criteria

- **Procedure A PASSES (current behaviour)**: the rollback covers both the tag-creation and the relation-bind. The annotation is doing TX-propagation work as inferred.
- **Procedure B PASSES (counterfactual)**: removing the annotation breaks atomicity ONLY IF the caller chain itself lacks `@ReactiveTransactional`. If the caller also has `@ReactiveTransactional`, the default propagation still joins. This nuance is the "subtle" finding called out in S-E-1 (iv).

## On confirmation

The annotation placement is a defence-in-depth — it ensures atomicity even if a future refactor drops `@ReactiveTransactional` from the caller. A maintainer reading this method might be tempted to remove the annotation as "redundant for a single statement"; the probe + this sidecar's S-E-1 (iv) note are the evidence chain that the annotation is intentional.

Refactoring scope: none required; this probe is a regression guard. Recommend adding a comment to line 137: `// @ReactiveTransactional preserved for TX-propagation with caller's multi-step tag-create+bind sequence`.

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:136-142`
- Annotation definition: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/annotation/ReactiveTransactional.java:1-13`
- Spring `@Transactional` propagation default: `REQUIRED` (joins existing TX or starts new one)
