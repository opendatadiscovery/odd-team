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

## STRENGTHENS — Batch N (Term + Role + Tag + UserOwnerMapping — three NEW partial-unique-index migrations confirm the cross-table-consistency claim)

**Four batch-N sidecars provide primary-source confirmation that this DB-layer pattern is uniform across the platform's named-entity tables**:

1. **Term** — `term_name_namespace_unique ON term(name, namespace_id) WHERE deleted_at IS NULL` (V0_0_35__add_terms.sql:16). Note the COMPOSITE-key shape: name + namespace_id (NOT just name) — Term names are unique WITHIN a namespace, not globally. The partial-index design extends to multi-column keys without losing the soft-delete-aware uniqueness rule.
2. **Role** — `role_name_unique ON role (name) WHERE deleted_at IS NULL` (V0_0_55:42, recreated by V0_0_58 + V0_0_64:88-90). The migration history is the intent narrative: V0_0_55 introduces the index with `deleted_at IS NULL`; V0_0_58 toggled briefly to `is_deleted IS FALSE`; V0_0_64 converged BACK to `deleted_at IS NULL` and DROPPED the `is_deleted` column. The migration file V0_0_64 is named `remove_is_deleted_field` — the maintainer EXPLICITLY consolidated on `deleted_at IS NULL` as the canonical predicate.
3. **Tag** — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (V0_0_36 + V0_0_57 + V0_0_64:103-105). Three iteration migrations refined the index; the final form V0_0_64:103-105 explicitly re-creates with `WHERE deleted_at IS NULL` after the `is_deleted` column removal. The Tag-specific pattern composes with ADR-CANDIDATE-125 NEW (the `ingestData` upsert's `ON CONFLICT WHERE deleted_at IS NULL DO UPDATE` clause matches the index predicate exactly — application-side echo of the schema-side rule).
4. **user_owner_mapping** — TWO partial unique indexes per V0_0_89:9-15: `unique_deleted_at_per_owner ON (owner_id) WHERE deleted_at IS NULL` + `user_owner_mapping_oidc_username_provider_deleted_key ON (oidc_username, provider) WHERE deleted_at IS NULL`. Notably, the second index treats NULL provider as a UNIQUE VALUE — `(alice, NULL)` is one row; `(alice, 'github')` is another row — composing with ADR-CANDIDATE-130 NEW (the provider-null collapse architecture).

**Cross-table consistency reinforcement (batch N)**: The partial-unique-index pattern now has primary-source evidence at FIVE additional tables (term + role + tag-directory + tag-relation analogue + user_owner_mapping x2). The V0_0_64 migration's name (`remove_is_deleted_field`) plus the explicit DROP/CREATE INDEX statements is the strongest single intent anchor — the maintainer deliberately CONSOLIDATED the entire platform on `deleted_at IS NULL` as the soft-delete predicate. The `is_deleted` boolean column is dead schema except where it remained accidentally (REFACTOR-239 — Policy is the documented exception).

**New batch-N gap reinforcement**:
- The Administrator/User-name asymmetry (REFACTOR-189) is now confirmed at TWO mutation surfaces (PolicyServiceImpl + RoleServiceImpl). The partial-unique-index design is correct; the gap is the SERVICE-LAYER missing-name-reservation on `.create` paths combined with the index's "deleted name is freed" UX. Batch-N RoleServiceImpl strengthens the case (DRIFT-FACET-C in the sidecar).

**Severity unchanged**: MEDIUM. The cross-table evidence reinforces the codebase-wide claim; the gap surface (REFACTOR-189) is now 2-sidecar across the RBAC mutation surface with the same structural shape.

---
