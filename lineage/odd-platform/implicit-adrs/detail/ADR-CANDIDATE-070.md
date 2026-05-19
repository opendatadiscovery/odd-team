## ADR-CANDIDATE-070 — Partial unique index `(name) WHERE deleted_at IS NULL` is the DB-layer enforcement that enables soft-delete-aware name recreation across `policy`, `role`, `owner`, `data_source`, `collector`, `namespace`, `tag`, `term`, `data_entity` — every named entity in the platform

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (this batch — Policy) + cross-migration evidence (the parallel index on `role_name_unique`)
**Axes present**: repositories, schema

**Surfaced by**:
- `ReactivePolicyRepositoryImpl.md:implicit_adrs[1]` (the partial unique index pattern, explicit V0_0_55 evidence)
- `ReactivePolicyRepositoryImpl.md:concepts.invariants[3]` (the "soft-delete + recreation" UX behaviour the index enables)
- Cross-batch evidence: batch-E PolicyController/RoleController sidecars (the live operator-facing behaviour that depends on this index)

**Decision statement**: ODD's named-entity tables enforce name uniqueness via a **partial unique index** filtered by `WHERE deleted_at IS NULL`. The canonical example is the policy table:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS policy_name_unique
  ON policy (name) WHERE deleted_at IS NULL;
```

(`V0_0_55__add_policies_and_roles.sql:30`). The parallel pattern repeats at `role_name_unique` (line 42 of the same migration) and at every other named-entity table in the schema (verified via grep of migration files for `WHERE deleted_at IS NULL`).

The decision composes the two-tier soft-delete (ADR-CANDIDATE-068) with the platform's name-uniqueness contract:
- **(a)** Names are unique among LIVE rows. A `policy` with name `'Administrator'` cannot collide with another live `policy` of the same name.
- **(b)** Soft-deleted rows are "parked" — their names are EXCLUDED from the uniqueness check. After a policy is soft-deleted, a new policy with the same name CAN be created; the partial index excludes the parked row.
- **(c)** The newly-created policy is a NEW row with a NEW id. Historical references to the original id (in audit logs, in any preserved relations) are NOT remapped. The soft-delete is reversible to its own id; the recreate-with-same-name path produces a different id.

The architectural choice avoids three alternatives that would otherwise be necessary:
- (alt1) Permanently reserve names of soft-deleted entities ("names are unique forever") — would force admins to choose distinct names for every recreated policy / owner / etc.; bad UX for "delete + recreate" workflows.
- (alt2) Add a generation suffix to soft-deleted rows ("Administrator_deleted_20250101_123456") — would distort the audit trail and require recovery code to interpret the mangling.
- (alt3) Separate live and deleted tables — would double the schema surface and force every read to UNION across both tables.

The partial-index design picks the cleanest path: ONE table, ONE name column, ONE index that recognises the live-vs-deleted distinction. Postgres's planner handles the index efficiently for both INSERT (uniqueness check excludes parked rows) and SELECT-by-name (when paired with the same `deleted_at IS NULL` filter).

The decision pairs with the **centralised error-translation** (ADR-CANDIDATE-071 — NEW): `ExceptionUtils.translateDatabaseException` maps the SQLSTATE-23505 violation on each named partial-unique-index to a per-constraint friendly message (e.g. `"Policy with this name already exists"` at `ExceptionUtils.java:60-62`). The two ADRs together describe the create-with-name flow: the DB-layer enforces, the translation layer surfaces the user-resolvable error.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the explicit `WHERE deleted_at IS NULL` predicate in the CREATE UNIQUE INDEX statement is the SQL-syntactic affirmation of the design. The pattern repeats verbatim at `role_name_unique` (and at every other named-entity table); the cross-table consistency is the intent anchor.
2. *Structural impact?* YES — affects every named-entity table's schema, every create-with-name endpoint's error surface, every operator's mental model of "what happens when I delete and recreate by name?", and the `ExceptionUtils.translateDatabaseException` per-constraint translation table.
3. *Refactoring or structural?* STRUCTURAL — switching to (alt1)/(alt2)/(alt3) above would require schema rewrites, code rewrites, and UX changes. The partial-index choice is architectural.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactivePolicyRepositoryImpl.md` says: "Policy-name uniqueness is enforced VIA A PARTIAL UNIQUE INDEX FILTERED BY `WHERE deleted_at IS NULL`, allowing the same name to be re-used after soft-delete. The combination is intentional: the soft-delete pattern would otherwise either (a) trap unique names forever after deletion, or (b) require a separate 'undeleted' table. The partial-index design splits the difference — names are unique among live rows, soft-deleted rows are 'parked' but their names are freed."
- `V0_0_55__add_policies_and_roles.sql:30` — `CREATE UNIQUE INDEX IF NOT EXISTS policy_name_unique ON policy (name) WHERE deleted_at IS NULL;`
- `V0_0_55__add_policies_and_roles.sql:42` — the parallel `role_name_unique` index

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-068** (NEW — two-tier soft-delete taxonomy) — this ADR is the DB-layer enforcement that makes -068's soft-delete model usable for named entities.
- **ADR-CANDIDATE-071** (NEW — centralised DB-error translation) — the translation layer that surfaces the partial-unique-index violations as HTTP-friendly errors.
- ADR-CANDIDATE-058 (existing — closed five-member status enum + soft-delete-as-state) — data_entity's lifecycle uses status-machine instead of `deleted_at`, but the `external_name` uniqueness on data_entity follows a slightly different shape (verified per the sidecar) — this ADR primarily covers tables that use the `deleted_at` timestamp.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-230 (`getRolesPolicies` returns soft-deleted policies — the partial-unique-index ALONE doesn't prevent orphan role_to_policy bindings; the application-layer must add the soft-delete filter on custom JOINs).
- REFACTOR-189 (cross-batch, batch E — Administrator-name reservation create-vs-update asymmetry; the partial-unique-index permits recreating "Administrator" if the seed row is ever soft-deleted, and the create path has no name-reservation defence).

**Proposed action**: Promote to `adrs/drafts/partial-unique-index-soft-delete-name-recreation.md` (new ADR). Document:
- The pattern (CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL).
- The cross-table consistency (policy, role, owner, data_source, collector, namespace, tag, term — every named-entity table).
- The UX consequence (delete + recreate by name produces a new id; historical references are NOT remapped).
- The companion error-translation (ADR-CANDIDATE-071).
- The gap discussion (REFACTOR-189 — the partial-unique-index permits recreating reserved names if the seed row is ever soft-deleted; service-layer name-reservation is the missing defence).

Cross-link with the housekeeping subsystem ADRs (ADR-CANDIDATE-045/-046) — the soft-deleted-and-parked row's lifetime is governed by the housekeeping TTL.

**Severity rationale**: MEDIUM — DB-layer pattern that affects every named-entity table. Less load-bearing than ADR-CANDIDATE-068 (the soft-delete taxonomy itself) but the partial-unique-index is the structural element that enables -068's soft-delete to be operator-friendly. Without this ADR, future maintainers might "fix" the partial-index (e.g. drop the `WHERE deleted_at IS NULL` clause "to enforce uniqueness everywhere") and silently break the recreate-after-delete UX.

---
