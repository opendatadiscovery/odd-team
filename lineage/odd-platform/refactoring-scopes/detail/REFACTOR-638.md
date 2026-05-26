# REFACTOR-638 — `GET /api/messages/{message_id}/url` returns 200 OK + empty body for non-existent / non-v1 message IDs (NOT 404); combined with no RBAC, it is a message-existence-by-id oracle

**Severity**: MEDIUM
**Category**: missing-404-path + information-disclosure-oracle
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "No 404 / NotFoundException path on `redirect`: when `messageId` does not exist OR is not a valid UUIDv1 … `ReactiveMessageRepositoryImpl.getMessageProviderIdentity` returns `Mono.empty`. The controller's `dataCollaborationService.resolveMessageUrl(messageId).map(...)` short-circuits to `Mono.empty`. Spring WebFlux translates `Mono.empty` from a controller to `200 OK` with NO body — NOT `404 Not Found`. There is no `switchIfEmpty(Mono.error(new NotFoundException(...)))` anywhere in the chain. A caller cannot distinguish 'message does not exist' from 'message exists but Slack returned no permalink'."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:concepts.invariants.[messageId-must-be-uuidv1]` — "a non-v1 UUID extracts a wrong timestamp, the WHERE clause fails, the inner Mono is empty, and (per the controller-class invariant on `Mono.empty`) the `redirect` endpoint returns 200 OK with no body — NOT 404."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:bugs_limitations_corner_cases.[8]` — "ANY authenticated user can probe message ids — receive 200/empty for non-existent and 302/slack-url for existing — effectively a message-existence-by-id oracle."

**Description**: The redirect endpoint's reactive chain at lines 41-49 short-circuits on `Mono.empty` with NO `switchIfEmpty(...)` handler. The downstream `ReactiveMessageRepositoryImpl.getMessageProviderIdentity(UUID)` (lines 171-185) is:

```java
public Mono<MessageProviderIdentity> getMessageProviderIdentity(UUID messageId) {
    return jooq.dsl()
        .select(...)
        .from(MESSAGE)
        .where(MESSAGE.UUID.eq(messageId)
            .and(MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))))
        .mono();
}
```

— two conjoined WHERE conditions:
1. `MESSAGE.UUID.eq(messageId)` — straightforward UUID match.
2. `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))` — partition-pruning assist (per ADR-CANDIDATE-217 NEW); REQUIRES messageId to be a UUIDv1.

Three failure modes produce `Mono.empty`:
- Message ID exists but is not UUIDv1 → `extractDateTimeFromUUID` returns garbage timestamp → WHERE fails → empty.
- Message ID is UUIDv1 but doesn't exist → straight UUID-mismatch → empty.
- Message exists but Slack's `chat.getPermalink` returns null permalink (unlikely; the API contract returns a string or an error) → empty.

All three short-circuit to `Mono.empty`, which Spring WebFlux maps to **200 OK + empty body** (NOT 404).

**Combined with REFACTOR-636 (ADR-CANDIDATE-218 systemic side-channel) and the no-RBAC nature of the endpoint, an attacker with an authenticated session (or any caller under DISABLED mode) can probe message UUIDs**:

- 302 + Location header → message exists and has a Slack permalink. The attacker now knows: a Discussions message exists at that UUID; the channel/timestamp; the embedded UUID-v1 creation timestamp (per ADR-217); the workspace's slack subdomain.
- 200 + empty body → message does not exist OR exists-but-permalink-failed (the attacker can't distinguish).

The oracle is enumerable because UUIDv1s carry their timestamp; the attacker can scan UUIDv1s within a narrow time window. Combined with channel-id observation (anyone who knows the data-entity's Discussions tab knows the channel-id from the URL), the attacker can derive a probable UUIDv1 corpus.

**Operator-visible failure modes**:

1. **Message-existence enumeration** — an authenticated user (or anonymous under DISABLED) can scan UUIDv1 ranges and learn which messages exist. The Discussions content itself isn't exposed via this endpoint (only the Slack permalink is), but the existence signal alone is information disclosure.

2. **No operator-actionable error reporting** — a user clicking a stale "Open in Slack" link (e.g. the message was deleted Slack-side) gets a 200 + empty body. The UI shows nothing happened; the user thinks the click was lost.

3. **Confusing client behaviour** — a third-party API client expecting RESTful 404 semantics gets 200 + empty body. The client interprets this as "found but no URL" rather than "not found"; the calling code logic diverges from the actual state.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../DataCollaborationController.java:41-49` (no switchIfEmpty).
- `<odd-platform-api>/src/main/java/.../DataCollaborationServiceImpl.java:72-77` (no switchIfEmpty).
- `<odd-platform-api>/src/main/java/.../ReactiveMessageRepositoryImpl.java:171-185` (the partition-pruned query).

**Existing-ADR-or-implied-prescription**: No specific ADR; the pattern of "Mono.empty → 404" is a Spring WebFlux idiomatic; sibling gap: REFACTOR-429 (Owner deletion Mono.empty cannot distinguish deleted-from-never-existed).

**Proposed remedy**: Two-part fix:

1. **Add `switchIfEmpty(NotFoundException)` at the service tier**:

```java
// DataCollaborationServiceImpl.resolveMessageUrl
public Mono<String> resolveMessageUrl(UUID messageId) {
    return reactiveMessageRepository.getMessageProviderIdentity(messageId)
        .switchIfEmpty(Mono.error(new NotFoundException("Message not found: " + messageId)))
        .flatMap(identity -> messageProviderClientFactory.getOrFail(identity.messageProvider())
            .resolveMessageUrl(identity.providerMessageChannel(), identity.providerMessageId()));
}
```

The ControllerAdvice maps `NotFoundException` to 404. Both non-UUIDv1 and non-existent UUIDs surface as 404.

2. **Optional: add owner-scoping** (defence-in-depth) — gate `resolveMessageUrl` by checking the message's `data_entity_id` against the caller's permission scope. This closes the oracle entirely; messages outside the caller's scope return 404 regardless of existence.

3. **Add integration tests**:
   - Non-existent UUIDv1 → 404 (was 200/empty).
   - Non-v1 UUID → 404 (was 200/empty).
   - Existing message → 302.
   - Existing message in caller's scope vs out-of-scope → 302 vs 404 (if owner-scoping added).

**Severity rationale**: MEDIUM — the oracle is information disclosure (not data exfiltration); the fix is small and the cost-benefit favours closing it. Pairs with REFACTOR-637 (open-redirect) — the two redirect-path scopes together secure the redirect endpoint. Pairs with ADR-CANDIDATE-217 (UUIDv1 is INTENTIONAL) — this REFACTOR captures the operator-actionable consequence of that ADR.

**Suggested backlog grouping**: `Discussions hardening sprint` — bundle with REFACTOR-637 / 639 / 644 / 645.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-429 (Owner deletion silent-204 — same shape on Owner); ADR-CANDIDATE-217 (UUIDv1 intentional — this is the missing 404 path).
- SUPERSEDES: none.
- CONFLICTS: none.

---
