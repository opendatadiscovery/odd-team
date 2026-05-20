## REFACTOR-561 — Postgres row-order non-determinism in ownership/tag list queries (no ORDER BY) leaks into JSON-string-equality diff at `ActivityAspect.java:86` → produces SPURIOUS activity events when nothing semantically changed

**Severity**: MEDIUM (data-integrity false-positives on the audit trail)
**Category**: data-integrity
**Surfaced by**:
- `ActivityHandler.md:stress_findings.S-E-4` (CANARY HEADLINE — ROW-ORDER NON-DETERMINISM — "for handlers serializing list-shaped state (owners, tags, terms), is the JSON output deterministic across query plans? Answer (TRACE): ReactiveOwnershipRepositoryImpl.getOwnershipsByDataEntityId:130-145 has NO ORDER BY. ReactiveTagRepositoryImpl.listDataEntityDtos:69-81 has NO ORDER BY... Postgres can change row order after VACUUM, UPDATE-storage relocation, or query-plan change" — probe P-018)
- `ActivityHandler.md:bugs_limitations_corner_cases[2]` ("Postgres row-order non-determinism in ownership-list and tag-list serialization... `ActivityAspect:86`'s `info.getOldState().equals(newState)` is string-equality. A row-order flip emits a spurious activity record showing the same entities 'changed'. Operator confidence in the Activity Feed degrades" — HIGH)
- `ReactiveOwnershipRepositoryImpl.java:130-145` (no ORDER BY on `getOwnershipsByDataEntityId`)
- `ReactiveTagRepositoryImpl.java:69-81` (no ORDER BY on `listDataEntityDtos` — only `groupBy(TAG.fields())`)
- `AbstractOwnershipActivityHandler.java:19-22` (the `collectList` → JSON pattern that serializes the unordered list)
- `TagActivityHandlerImpl.java:41-50` (the tag list → JSON pattern)
- `ActivityAspect.java:86` (the string-equality diff that does NOT tolerate order variance: `info.getOldState().equals(newState)`)

**Description**: Several `ActivityHandler` implementations serialize list-shaped state into JSON for the activity feed's `oldState`/`newState` columns:

- `OwnershipUpdatedActivityHandler` (and abstract base `AbstractOwnershipActivityHandler.getDataEntityOwnerships`): reads `ownerships` for a data entity → `collectList()` → JSON-serialize as `OwnershipActivityStateDto[]`.
- `TagActivityHandlerImpl`: reads tag rows for a data entity → list → JSON-serialize as `TagActivityStateDto[]`.
- Similar pattern for term assignments, custom-metadata lists, dataset-field-value lists.

The repository queries that feed these handlers have NO `ORDER BY` clause:

- `ReactiveOwnershipRepositoryImpl.getOwnershipsByDataEntityId` (`:130-145`): SELECT with a 3-table JOIN (OWNERSHIP × OWNER × TITLE), no `ORDER BY` — Postgres returns rows in storage order.
- `ReactiveTagRepositoryImpl.listDataEntityDtos` (`:69-81`): SELECT with `groupBy(TAG.fields())` but no `ORDER BY` — natural storage order.

The post-mutation diff at `ActivityAspect.java:86`:

```java
.filter(newState -> !info.getOldState().equals(newState))
```

uses Java `String.equals` on the JSON-serialized representations. Two JSON strings differing ONLY in array element order (`[{owner: A}, {owner: B}]` vs `[{owner: B}, {owner: A}]`) are NOT equal under `String.equals`.

**The trigger sequence for a spurious event**:
1. Time T=0: User edits some field of a data entity (e.g. internal_description). `@ActivityLog(DESCRIPTION_UPDATED)` fires.
2. `getContextInfo` snapshot: reads the entity's CURRENT description (line internal_description = "hello").
3. The wrapped mutation runs: UPDATE internal_description = "world".
4. `getUpdatedState` reads the entity's NEW description ("world").
5. The aspect emits a DESCRIPTION_UPDATED activity row. Fine.

But suppose the handler also reads ownership / tag list (e.g. a different `@ActivityLog(OWNERSHIP_UPDATED)` on a different mutation):
1. Time T=0: User adds owner X to a data entity.
2. `getContextInfo`: reads ownership list — Postgres returns `[A, B, C]` in some storage order. JSON: `[{owner: A}, {owner: B}, {owner: C}]`.
3. The wrapped mutation runs: INSERT owner X.
4. `getUpdatedState`: reads ownership list — Postgres returns `[A, B, C, X]` in some storage order. JSON: `[{owner: A}, {owner: B}, {owner: C}, {owner: X}]`. Diff is real; activity emit OK.

**The spurious case**: Postgres VACUUM rearranges row storage between steps 2 and 4 (a heap-update on OWNERSHIP, or a manual VACUUM by the operator, or background autovacuum). Step 4 returns `[B, A, X, C]` in some new storage order. JSON: `[{owner: B}, {owner: A}, {owner: X}, {owner: C}]`. Now the string-equality at line 86 returns FALSE between two reads of "A, B, C" — even though semantically nothing changed (the entity still has A, B, C plus X).

Or, more insidious: an `@ActivityLog`-annotated mutation that doesn't actually change ownership (e.g. a description update that happens to also re-read ownership for completeness) — and Postgres VACUUM between getContextInfo and getUpdatedState — emits a spurious OWNERSHIP_UPDATED row even though no ownership change happened.

**Operator-visible consequence**: 
- The UI's Activity Feed displays a misleading event: "User X changed ownership of dataset Y" — but the ownership set is THE SAME as before (just in different display order). Operators investigating "who changed ownership" find phantom records.
- Compliance audit: the audit trail records changes that didn't happen.
- Operator trust in the Activity Feed degrades. The maintainer's intent ("audit log records actual changes") is violated.

**Frequency bounding**: Postgres row-order is stable under steady-state. VACUUM and storage-relocation events change it. The race is more likely:
- After bulk INSERTs (which storage-locate rows in insertion-order).
- After UPDATE-MOVE operations (which can relocate rows to new pages).
- After explicit `VACUUM FULL` or `CLUSTER` operations.
- After query-plan changes (Postgres may use index-scan vs sequential-scan returning different orders).

Per P-018 probe, runtime measurement on a populated DB is needed to quantify production frequency.

**Cross-cutting context**: This is the **classic data-integrity defect from list-as-JSON-as-equality-key**. Standard fix: serialize with deterministic ordering (e.g. ORDER BY id). The defect is widespread in audit systems that JSON-serialize collection state.

**Primary source citations**:
- `ReactiveOwnershipRepositoryImpl.java:130-145` (verified no ORDER BY)
- `ReactiveTagRepositoryImpl.java:69-81` (verified no ORDER BY, only groupBy)
- `AbstractOwnershipActivityHandler.java:19-22` (collectList → JSON)
- `TagActivityHandlerImpl.java:41-50` (list → JSON)
- `ActivityAspect.java:86` (`info.getOldState().equals(newState)` — string-equality)
- `JSONSerDeUtils.java:14-20` (the ObjectMapper config — uses SNAKE_CASE per ADR-CANDIDATE-N from this batch; does NOT apply ORDER-stabilising serialization features)
- `OwnershipActivityStateDto.java` (the typed list-element wrapper — no `equals`/`hashCode` discriminator)
- Probe `P-018` (pending) — verifies the row-order flip experimentally

**Existing-ADR-or-implied-prescription**: NONE. The dual decision (serialize list-shape state + use JSON-string-equality for diff) is implicit. No ADR defends either choice; the consequence is borne in audit-trail spurious-event noise.

**Proposed remedy**: Three options:

1. **LOWEST cost — add `ORDER BY id` to the offending repository queries**: Modify `ReactiveOwnershipRepositoryImpl.getOwnershipsByDataEntityId` and `ReactiveTagRepositoryImpl.listDataEntityDtos` to add `.orderBy(OWNERSHIP.ID.asc())` / `.orderBy(TAG.ID.asc())`. This stabilises the JSON serialization order regardless of Postgres storage flux. Cost: marginal query overhead (sort over typically-small lists). Benefit: spurious activity emits eliminated for ownership/tag handlers.

2. **MEDIUM cost — Jackson SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS + a custom @JsonOrder on list-element DTOs**: Configure the global ObjectMapper to canonicalize JSON output (alphabetical key ordering, predictable array serialization). Wider impact: stabilises ALL JSON serialization across the platform, not just activity-state. Risk: affects other JSON-emit surfaces.

3. **HIGHEST cost — replace JSON-string-equality with structural equality on parsed DTOs**: Modify `ActivityAspect.java:86` to NOT use `String.equals` on the JSON strings. Instead, parse both sides back to DTOs and compare via `Objects.equals` on the typed lists (which respect element-set rather than order). Requires the DTOs to implement order-tolerant `equals` (e.g. compare as `Set<OwnerDto>`). Architectural cleanest; heaviest code change.

**Recommended**: Option 1 (add ORDER BY to the offending queries) — minimal change, high leverage, mechanical fix. Pair with a code comment at the queries explaining "deterministic ordering required by ActivityAspect's JSON-string diff" — prevents future maintainers from removing the ORDER BY thinking it's redundant.

**Severity rationale**: MEDIUM — operator-visible audit-trail false positives. The defect produces records that misrepresent the actual change history. Severity is bounded by:
- The actual frequency depends on Postgres VACUUM patterns; on stable storage, may be near-zero.
- The visible event-type is OWNERSHIP_UPDATED / TAGS_UPDATED — typically high-visibility but operationally diagnosable (the manual reviewer can spot the "old state and new state look the same").
- The fix is small and mechanical.

**Suggested backlog grouping**: `SEC-NNN activity-audit correctness sprint`. Pair with REFACTOR-556 (transactional coupling), REFACTOR-558 (oldState race), REFACTOR-560 (system_event flag asymmetry). The four findings collectively define "activity audit log is approximate" — investing in any subset improves the audit-trail trust contract.

---
