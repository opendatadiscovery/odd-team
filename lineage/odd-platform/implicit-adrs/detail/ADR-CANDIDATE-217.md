# ADR-CANDIDATE-217 — Discussions `messageId` is UUIDv1 (NOT v4) — encodes message creation timestamp into the UUID itself, enabling a covering-index assist on the time-partitioned `messages` table at lookup time

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-02 Data Modelling]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:implicit_adrs.[5]` (MEDIUM) — "MessageId is UUIDv1 (not v4) — encodes the message's creation timestamp into the UUID itself, enabling a covering-index assist at lookup time via `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))`."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:concepts.invariants.[messageId-must-be-uuidv1]` — "`messageId` MUST be a UUIDv1 — `ReactiveMessageRepositoryImpl.getMessageProviderIdentity` (`:176-177`) binds BOTH `MESSAGE.UUID.eq(messageId)` AND `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))`"

**Decision statement**: The `messages.uuid` primary identifier is a **UUIDv1** (timestamp-and-MAC-address-based) rather than a UUIDv4 (random). The decision propagates through THREE intent anchors:
1. **Generation side** — `UUIDHelper.generateUUIDv1()` is called at message creation in `DataCollaborationServiceImpl.java:89` and downstream message-creation paths.
2. **Lookup side** — `ReactiveMessageRepositoryImpl.getMessageProviderIdentity` (`:171-185`) and `getUUIDByProviderInfo` (`:188-195`) bind a redundant `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))` predicate alongside `MESSAGE.UUID.eq(messageId)`. The redundancy is intentional: it enables Postgres to use the partition-pruning + covering-index path on the partitioned `messages` table rather than a full-table scan against `uuid`.
3. **Partition architecture** — `messages` is partitioned by `created_at` (per the `datacollaboration.message-partition-period=30` (days) property, application.yml:203). The UUIDv1 timestamp embed makes lookup by `uuid` effectively partition-aware without requiring the caller to supply `created_at` separately.

Choosing UUIDv1 trades:
- (+) Partition-pruning lookup performance (~30-day-window scan vs full-table scan on `uuid`).
- (+) Roughly-chronological ordering when sorting by `uuid` (a side benefit for chronological displays).
- (-) UUIDv1 leaks the platform's MAC address in the trailing bits (privacy / fingerprinting consideration).
- (-) UUIDv1 leaks the message creation timestamp to anyone who holds the UUID (URL-shareable timestamps).
- (-) Clock skew between platform instances can cause UUIDv1 collision in multi-instance clusters (mitigated by the node-ID portion of the UUIDv1).

The trade is structural: alternative is "use UUIDv4 + composite `(uuid, created_at)` PK" which would require the caller to supply both fields at every lookup, OR "use UUIDv4 + full-table-scan-on-uuid" which would not scale beyond a few partitions.

**Wisdom test**: PASS. Three intent anchors:
1. **Explicit helper** — `UUIDHelper.generateUUIDv1()` (named v1, not v4) — the maintainer wrote the helper to embed the v1 choice in the type system.
2. **Symmetric lookup** — `UUIDHelper.extractDateTimeFromUUID(uuid)` is the complementary helper consumed at lookup time. The pair-wise design makes the choice load-bearing: removing v1 generation would break partition-pruning at lookups.
3. **Schema co-design** — the `messages` table's partition-by-`created_at` is the COMPLEMENT of the v1 choice; the two designs are linked.

Structural impact (partition-pruning depends on it; multi-instance cluster behaviour depends on it); alternative (UUIDv4) is a structural change to the partitioning strategy. **Sibling pattern**: no other table in the codebase uses UUIDv1 — the choice is Discussions-specific because Discussions is the only feature with a time-partitioned table.

**Operator-visible consequence**:
- A URL like `/api/messages/<uuid>/url` carries the embedded timestamp; an adversary capturing the URL knows when the message was posted (even before resolving the redirect).
- A multi-instance ODD Platform cluster requires clock-sync (NTP) to avoid UUIDv1 collisions; the operator-facing docs do not call this out.
- An operator who manually queries `SELECT * FROM messages WHERE uuid = 'some-v4-uuid'` (e.g. importing test data with v4 ids) will hit a full-table scan; the partition pruning predicate `created_at = extract(uuid)` will produce garbage timestamps.

**Existing ADR**: composes with **ADR-CANDIDATE-019** (Data Collab opt-in) — UUIDv1 is the storage-side design choice that makes the time-partitioned table feasible at the operator-default storage backend. No direct contradiction with any existing ADR.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-638** NEW — `redirect` returns 200 OK + empty body for non-v1 / non-existent message IDs (not 404). This is a CONSEQUENCE of the UUIDv1 choice: a non-v1 UUID's `extractDateTimeFromUUID` returns garbage timestamp, the partition-pruned WHERE clause fails, `Mono.empty` propagates, controller returns 200/empty. The fix is `switchIfEmpty(Mono.error(NotFoundException))` at the service tier — which then makes the UUID-version mismatch surface as 404 instead of 200.
- DOC-GAP — `docs.opendatadiscovery.org/active-platform-features/data-collaboration` (404 at fetch time) does NOT exist yet. When published, it should disclose the UUIDv1 timestamp leak.

**Proposed action**: Promote to `adrs/drafts/messages-uuidv1-partition-assist.md` (new ADR). Document:
1. The decision: messages use UUIDv1.
2. The reason: partition-pruning + covering-index assist on the time-partitioned table.
3. The trade-offs: timestamp leak in URLs; MAC-address leak in UUIDs; multi-instance clock-sync requirement.
4. The alternative considered: UUIDv4 with composite (uuid, created_at) PK — rejected because the API contract exposes only the UUID, not a (uuid, created_at) pair, and changing the contract would break the live `/api/messages/{message_id}/url` shape.
5. The operator-facing implication: a Discussions URL leaks the post timestamp; a multi-instance cluster requires NTP sync.

**Severity rationale**: MEDIUM — schema-and-API-contract co-design decision; load-bearing for the Discussions feature's storage strategy but bounded in scope (one feature). Pairs with REFACTOR-638 (the NotFoundException gap that the UUIDv1 choice indirectly produces).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-019 (Data Collab feature-isolation pattern) — UUIDv1 is the storage-side detail of that broader stance.
- SUPERSEDES: none.
- CONFLICTS: none.

---
