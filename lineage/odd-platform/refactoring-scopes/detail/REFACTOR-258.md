## REFACTOR-258 — Silent metadata-delete-on-absence: re-ingesting an entity with partial metadata silently DELETES the omitted fields with NO operator-visible signal

**Severity**: HIGH
**Category**: silent-destructive-operation
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[0]`
- `IngestionService.md:security.known_security_gaps[1]`
- co-surfaced ADR: ADR-CANDIDATE-082 (replace-not-merge collector contract)

**Description**: `MetadataIngestionRequestProcessor.process` (lines 36-82) implements the REPLACE-NOT-MERGE collector contract (per ADR-CANDIDATE-082) for custom metadata. The processor:
1. Loads the entity's EXISTING metadata bindings (line 65-66: `metadataFieldValueRepository.getDtosByDataEntityIds(...)`).
2. Computes `bindingsToDelete = existingMetadataBindings.difference(currentBindings).toSet()` (lines 72-74).
3. Issues `metadataFieldValueRepository.delete(bindingsToDelete)` (lines 76-80) INSIDE the same transaction.

The fields previously bound but NOT present in the new payload are HARD-DELETED. No `log.warn` is emitted on the delete branch (verified: `MetadataIngestionRequestProcessor.java:30` declares `@Slf4j` but lines 72-80 have NO `log.*` call). No activity event is emitted (no `@ActivityLog` annotation anywhere in the metadata-ingestion path — per REFACTOR-264 family).

The operator-facing consequence:
- A collector that occasionally emits incomplete metadata (network flake, OOM, code bug, transient parser failure) silently DESTROYS metadata fields the operator carefully curated.
- The DB transaction succeeds; the platform returns 200 OK; the activity feed shows nothing; the application log shows nothing.
- Operators discover the loss when they GET the entity and find fields missing — sometimes hours or days after the deletion, with no audit trail.

This is the CONSEQUENCE side of the ADR-CANDIDATE-082 architectural decision. The ADR codifies the REPLACE semantic; this scope codifies the OPERATOR-VISIBILITY gap that the ADR's design does NOT defend.

Compounding factors:
- Default deployment ships with `auth.ingestion.filter.enabled=false` (per REFACTOR-204). Any caller can POST partial metadata for any datasource → silent metadata destruction.
- Even with filter-ON, a compromised collector token can erase metadata for that datasource's entities.
- No rate limiting (per REFACTOR-129 family). A buggy collector retry loop can erase + restore + erase metadata indefinitely.
- The Activity Feed (per REFACTOR-085 + ADR-CANDIDATE-021) doesn't record ingestion-driven metadata changes (per REFACTOR-264).

**Primary source citations**:
- `MetadataIngestionRequestProcessor.java:30` (`@Slf4j` present)
- `MetadataIngestionRequestProcessor.java:72-74` — `bindingsToDelete = existingMetadataBindings.difference(currentBindings).toSet()`
- `MetadataIngestionRequestProcessor.java:76-80` — `metadataFieldValueRepository.delete(bindingsToDelete)` with NO log.warn
- composes with ADR-CANDIDATE-082 (the architectural intent) — the gap is the operator-visibility absence
- composes with REFACTOR-204 (filter-OFF default), REFACTOR-264 (ingestion-update audit gap)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-082 (replace-not-merge collector contract) IS the architectural intent. The ADR's stance is "collectors own their declared state; omission = deletion." But the ADR DOES NOT defend against operator-blindness — the live docs don't surface the contract, the platform doesn't emit warnings, the activity feed doesn't record the deletions. The fix is refactoring within the existing architecture (add observability + audit) without changing the contract.

**Proposed remedy**: Four composable fixes:
1. **`log.warn` on the delete branch**: at lines 76-80, add `log.warn("Deleting {} metadata bindings for data_entity {} on ingestion-driven metadata replacement", bindingsToDelete.size(), dataEntityId)`. Surfaces the deletion in the application log.
2. **Activity-feed emission**: emit `CUSTOM_METADATA_FIELD_DELETED` activity events per deleted binding via `ActivityIngestionRequestProcessor`. Surfaces in the activity feed. Pairs with REFACTOR-253.
3. **Operator threshold**: emit a `WARN` log when `bindingsToDelete.size() > 0.5 * existingMetadataBindings.size()` — "more than 50% of this entity's metadata was deleted in one ingestion." Flags suspicious collector behaviour.
4. **Doc-side enforcement**: update the live `/configuration-and-deployment/collectors` page to document the replace-not-merge contract with operator-visible severity ("If your collector emits incomplete metadata, the platform WILL delete the omitted fields. There is no warning."). The contract is real; the doc must surface it.

The fixes are additive; none changes the architectural contract.

**Severity rationale**: HIGH — silent data destruction on a default-deployment-reachable surface. The combination of (a) replace-not-merge architectural intent + (b) no observability + (c) no doc warning + (d) default-off filter + (e) ingestion-driven activity audit gap is exactly the LSN-001-shape failure mode this workspace exists to catch.

**Suggested backlog grouping**: `Ingestion observability sprint` — pair with REFACTOR-259 (lineage-deletion same shape), REFACTOR-260 (silent restore), REFACTOR-261 (MICROSERVICE exclusion), REFACTOR-264 (ingestion-update audit), REFACTOR-085 (no activity retention). The cluster collectively describes the operator-blindness of ingestion-driven data changes.

---
