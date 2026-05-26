# REFACTOR-645 — `OwnerController` + `OwnerServiceImpl` + `DataCollaborationController` + `EventApiController` have NO `@Slf4j` / Logger / `log.*` calls — the four-method Owner CRUD and the three-method Discussions surface are silent in application logs; no audit trail for who created / updated / deleted / messaged what

**Severity**: MEDIUM
**Category**: missing-audit + missing-observability
**Pillars affected**: [P-08 Management & Administration (Owner), P-07 Active Platform Features (Discussions), P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "**No class-level `@Slf4j` — no observability on the four methods** — the class carries no logger; no `info`/`debug`/`warn`/`error` calls in any of the four method bodies (`OwnerController.java:21-54`); no MDC enrichment. The only operator-visible trace of an Owner CRUD operation is the default Spring access log (request line + status + elapsed) and the downstream service-tier logging (which also has none — verified by Grep `private static final.*Logger` against `OwnerServiceImpl.java` 2026-05-25 — zero matches). Combined with the no-`@ActivityLog` finding, the four-method controller is forensically silent at every observability layer."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:bugs_limitations_corner_cases.[10]` (MEDIUM) — "No audit logging of redirect activity: there is no `log.info(...)` on the redirect path; the platform records WHO redirected to WHICH message at WHICH time nowhere. Combined with the absence of RBAC, this means any authenticated user can probe-by-id without leaving an audit trail."
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:downstream_side_effects.[log-emit]` — "Two log emissions — log.debug for FILTER (e.g. unknown event types, non-thread messages) and log.error for ERROR (broken payload)." → only filter + error emit; happy-path enqueue emits NOTHING.

**Description**: Four classes — `OwnerController` (CRUD on the Owner directory), `OwnerServiceImpl` (the transactional service layer for Owner CRUD), `DataCollaborationController` (the three Discussions endpoints), and `EventApiController` (the Slack-events webhook receiver) — operate WITHOUT application-layer logging on the happy path.

The platform-wide pattern (per REFACTOR-097 — "No audit logging infrastructure exists in `<odd-platform-api>/src/main/java`") is that the platform has no audit-log infrastructure beyond Spring's default access log + the per-feature `@Slf4j` logging that some controllers add. Owner + Discussions are at the lower-coverage end of this spectrum.

The composing-gaps consequence: combined with **REFACTOR-636** (Owner side-channel grows the directory from 3 paths without OWNER_CREATE) + **REFACTOR-638** (Discussions redirect 200/empty oracle), an attacker can:
1. Probe message UUIDs at the redirect endpoint → no audit trail of who probed what.
2. Grow Owner directory via side-channel → no audit trail of who added "Alice Forged".
3. Inject forged Slack events (per REFACTOR-633) → no application-layer log of accepted events.

The default Spring access log captures `(timestamp, IP, method, path, status, latency)` — enough to identify "this IP made N calls" but not enough to identify "this IP created Owner 'Alice Forged'" or "this IP probed UUID xyz".

**Operator-visible failure modes**:

1. **Post-incident forensics impossible** — an operator investigating "who added Owner 'Alice Forged'?" gets no answer from application logs; access logs show only the path (`POST /api/dataentities/123/ownerships`), not the payload (the ownerName).
2. **No alarms on suspicious patterns** — a flood of redirect probes (REFACTOR-638 oracle exploitation) leaves no application-layer signal; only access-log volume increases.
3. **Compliance gap** — deployments with regulatory audit requirements (SOC2, ISO27001) cannot demonstrate WHO performed which Owner CRUD action.
4. **Debugging gap** — developers debugging "why did this Discussions message arrive late?" have no log trail of the enqueue path.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../OwnerController.java:1-55` (no logger field, no log calls).
- `<odd-platform-api>/src/main/java/.../OwnerServiceImpl.java:1-123` (no logger either).
- `<odd-platform-api>/src/main/java/.../DataCollaborationController.java:41-49` (no log statements on redirect).
- `<odd-platform-api>/src/main/java/.../DataCollaborationServiceImpl.java:72-77` (no log statements on resolveMessageUrl).
- `<odd-platform-api>/src/main/java/.../EventApiController.java:18-57` (only log.debug on FILTER + log.error on ERROR; happy path silent).

**Existing-ADR-or-implied-prescription**: **REFACTOR-097** (audit-log infrastructure gap — the platform-wide finding) is the cluster anchor. Sibling: REFACTOR-411 (OAuth logout handlers no `@Slf4j` — same shape on auth side); REFACTOR-042 (DataEntityController no `@Timed` — same shape on observability side); REFACTOR-608 (IdentityController.whoami zero log lines — same shape on identity side); REFACTOR-609 (PermissionController no @Slf4j — same shape on RBAC read side).

**Proposed remedy**: Three-part fix:

1. **Add `@Slf4j` and happy-path INFO logging to all four classes**:

```java
// OwnerController
@RestController
@RequiredArgsConstructor
@Slf4j
public class OwnerController implements OwnerApi {
    public Mono<ResponseEntity<Owner>> createOwner(Mono<OwnerFormData> formData, ServerWebExchange exchange) {
        return formData.flatMap(ownerService::create)
            .doOnSuccess(o -> log.info("Owner created: id={}, name={}", o.getId(), o.getName()))
            .map(ResponseEntity::ok);
    }
    // ... similarly for update / delete / list
}
```

2. **Add `@Slf4j` to `OwnerServiceImpl`** + log at INFO on `getOrCreate(name)` (the side-channel path) per REFACTOR-636's recommendation. Combined, the application logs would show all FOUR Owner creation paths.

3. **Add `@Slf4j` to `DataCollaborationServiceImpl` + happy-path log on `resolveMessageUrl`**:

```java
public Mono<String> resolveMessageUrl(UUID messageId) {
    return reactiveMessageRepository.getMessageProviderIdentity(messageId)
        .doOnNext(id -> log.info("Resolved message URL: messageId={}, provider={}", messageId, id.messageProvider()))
        .switchIfEmpty(Mono.error(new NotFoundException("Message not found: " + messageId)))  // also REFACTOR-638's fix
        .flatMap(identity -> messageProviderClientFactory.getOrFail(identity.messageProvider())
            .resolveMessageUrl(identity.providerMessageChannel(), identity.providerMessageId()));
}
```

4. **Add `@Slf4j` to `EventApiController` happy path** — log.info on enqueue (currently only debug/error):

```java
case PAYLOAD -> dataCollaborationService.enqueueMessageEvent(parseResult.messageEvent())
    .doOnSuccess(v -> log.info("Slack event enqueued: provider=SLACK, thread_ts={}", parseResult.messageEvent().getThreadTs()))
    .then(SlackEventResponse.ack());
```

5. **Add `@ActivityLog` annotations** to OwnerServiceImpl create/update/delete (REFACTOR-426 sibling) so the Activity Feed surfaces Owner lifecycle events. Cross-link to ADR-CANDIDATE-049 (Owner identity-decoupled CRUD).

6. **Add integration tests** asserting that `log.info` is emitted on each happy path; the Spring test framework can capture log output.

**Severity rationale**: MEDIUM — operator-visible compliance + forensics gap; pairs with REFACTOR-636 (side-channel growth) — the audit silence amplifies the side-channel gap. Lower priority than HIGH security gaps but higher than LOW UX polish. Part of the broader REFACTOR-097 platform-wide audit-log cluster.

**Suggested backlog grouping**: `Audit-log coverage sprint` — pair with REFACTOR-097 (platform-wide cluster anchor) + REFACTOR-042 / 411 / 608 / 609 / 426 (sibling instances). The Owner + Discussions + EventApi extensions are one sprint item.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-097 (audit-log cluster anchor — adds 4 classes to the covered set); REFACTOR-042 / 411 / 608 / 609 (sibling instances); REFACTOR-426 (Owner @ActivityLog gap — paired closure).
- SUPERSEDES: none.
- CONFLICTS: none.

---
