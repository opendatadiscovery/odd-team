## ADR-CANDIDATE-148 — Operator-curated metadata is FORWARD-COPIED across dataset-version forks — when a hash-diff creates a NEW dataset_field row, the previous row's `internalDescription` + `internalName` + INTERNAL-origin tags + INTERNAL enum values are explicitly COPIED onto the new row

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; POSITIVE-INTENT companion to ADR-CANDIDATE-147)
**Pillars affected**: [P-01-data-discovery (entity annotation + schema diff), P-10-integrations-ingestion]
**Support count**: 1 sidecar primary-source (batch R ReactiveDatasetFieldRepositoryImpl) + service-tier explicit copy-forward (DatasetFieldServiceImpl.java:308-322 + 324-335 + 352-373)
**Axes present**: services, repositories
**Batch**: R (2026-05-20)

**Surfaced by**:
- `ReactiveDatasetFieldRepositoryImpl.md:implicit_adrs.[1]` (HIGH) — "Operator-curated metadata (internal-name, internal-description, INTERNAL-origin tags, INTERNAL enum values) is preserved across dataset-version forks — when a hash-diff causes a NEW dataset_field row, the previous row's curated state is COPIED forward." — evidence: DatasetFieldServiceImpl.java:308-322 (getDatasetFieldUpdatedCopy — explicit setInternalDescription + setInternalName from lastExistingVersion) + 324-335 (copyInternalTagsToNewFieldVersion) + 352-373 (copyInternalEnumValuesToNewFieldVersion) — intent_anchor: "`DatasetFieldServiceImpl.java:315-316`: `copyNew.setInternalDescription(pair.lastExistingVersion().getInternalDescription()); copyNew.setInternalName(pair.lastExistingVersion().getInternalName());` PLUS `DatasetFieldServiceImpl.java:330-334`: `copyInternalTagsToNewFieldVersion` + `copyInternalEnumValuesToNewFieldVersion`. Explicit copy-forward of the four curated surfaces." — confidence: HIGH

**Decision statement**: When ingestion creates a NEW `dataset_field` row (because the structure-hash changed — see ADR-CANDIDATE-147), the platform explicitly COPIES the following operator-curated state from the previous-version row onto the new-version row:

1. **`internalDescription`** — operator-edited description (PUT /api/datasetfields/{id}/description). Copied at `DatasetFieldServiceImpl.java:315`.
2. **`internalName`** — operator-edited internal name (PUT /api/datasetfields/{id}/name). Copied at `DatasetFieldServiceImpl.java:316`.
3. **INTERNAL-origin tags** — tags assigned via UI (PUT /api/datasetfields/{id}/tags), NOT collector-emitted tags. Copied at `DatasetFieldServiceImpl.java:330-334` via `copyInternalTagsToNewFieldVersion`.
4. **INTERNAL-origin enum values** — enum metadata assigned via UI, NOT collector-emitted. Copied at `DatasetFieldServiceImpl.java:352-373` via `copyInternalEnumValuesToNewFieldVersion`.

The architectural commitments:
- **(a) Schema evolution does not erase operator curation.** A column rename at the source (which causes a hash-diff → new dataset_field row per ADR-CANDIDATE-147) does not lose the operator's description, internal name, tags, or enum metadata. The new row INHERITS the curated state.
- **(b) Forward-copy is ASYMMETRIC — operator state copies forward; collector state does NOT.** External-origin (collector-emitted) tags + enum values stay on their respective version-bound dataset_field rows; only operator-curated state follows the column across version-forks.
- **(c) The four curated surfaces are an EXPLICIT enumeration.** Adding a new operator-curated field to `DatasetFieldPojo` requires a deliberate decision about whether it follows the forward-copy contract. Forgetting to add the new field to `getDatasetFieldUpdatedCopy` would silently lose the curated value on every schema change.
- **(d) The forward-copy uses the `pair.lastExistingVersion()` reference** — the IMMEDIATELY-PRECEDING version, not the original / earliest. This means a column that evolved over N versions inherits its operator state from the (N-1)th version only — the curated state is REPEATEDLY copied forward at each version-fork. The intermediate copy chain is invisible at the data layer; only the latest row is materialized.

This is the POSITIVE-INTENT companion to ADR-CANDIDATE-147 (versioning-by-reference): together they describe a hidden but load-bearing design. The schema-evolution model creates orphan rows (ADR-147); the forward-copy model protects operator-curated metadata from being orphaned (ADR-148).

Trade-offs:
- **The collector cannot OVERWRITE an operator-curated internalName / internalDescription.** A collector emitting `name="cost_centre"` for a column the operator has internally-named "Cost Center (Approved)" will create a new dataset_field row whose `name` is `cost_centre` (collector-driven) but whose `internalName` is "Cost Center (Approved)" (forward-copied from operator).
- **A column rename's UI-facing label remains stable.** The operator's edits are sticky across schema changes — a subtle but important UX promise.
- **There is NO mechanism for the operator to RESET the curated state on a new version.** The forward-copy is non-optional; an operator who wants to start fresh after a schema change must explicitly DELETE the description / internal-name on the new dataset_field row.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — four explicit copy-method calls in DatasetFieldServiceImpl; not a side-effect; each surface is named in the service-tier code; the helper methods are dedicated (`copyInternalTagsToNewFieldVersion`, `copyInternalEnumValuesToNewFieldVersion`).
2. **Structural impact?** YES — every operator's expectation of "my edits survive a column rename"; every schema-evolution-driven update path; every future curated-metadata addition (forgetting to add to the copy-forward contract is a silent regression).
3. **Refactoring or structural?** STRUCTURAL — removing the forward-copy contract would break operator expectations across the entire dataset_field surface; adding new curated fields requires a deliberate decision.

**Existing ADR**: none. Companion to ADR-CANDIDATE-147 (versioning-by-reference) — together they describe the schema-evolution model + the state-preservation contract. Also cross-references ADR-CANDIDATE-142 (datasource UPSERT partial-merge) — both ADRs encode the platform's broader pattern of "protect operator state from collector overwrites" but at different surfaces (datasource for the integration boundary; dataset_field for the column metadata).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-440 NEW (description-edit not activity-logged on dataset_field — the forward-copy preserves the value but the original edit is unaudited)
- REFACTOR-439 NEW (verbatim XSS-class storage — the forward-copied descriptions inherit the storage class; F-004 family at the dataset_field surface)
- REFACTOR-218 family cross-reference (the broader stored-XSS picture)

**Proposed action**: Promote to `adrs/drafts/dataset-field-operator-metadata-forward-copy.md` (new ADR). Document the four curated surfaces + the asymmetry with collector state + the explicit enumeration + the cross-link to ADR-CANDIDATE-147. Live-doc-side: surface on `features/data-discovery/dataset-schema-diff` (today the doc-site implies schema diff handles edits gracefully but does not describe the explicit forward-copy contract).

**Severity rationale**: MEDIUM — positive-intent design choice protecting operator state; not security-critical but operationally load-bearing; non-obvious without doc coverage; latent regression vector when new curated fields are added without updating the copy-forward contract.

---
