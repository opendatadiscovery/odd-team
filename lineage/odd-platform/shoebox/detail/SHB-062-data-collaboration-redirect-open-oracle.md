# SHB-062 — Discussions /api/messages/{id}/url is a message-existence oracle + open-redirect class surface

**Category**: open
**Severity**: MEDIUM

## Hypothesis

The Discussions sub-feature exposes a server-side 302 redirect at `GET /api/messages/{message_id}/url` that has THREE compounding surprises: (1) **no 404 path** — when the messageId does not exist OR is a non-v1 UUID, Spring WebFlux serialises the empty Mono as HTTP 200 with empty body, NOT 404; (2) **no per-message authorization** — any authenticated user with any role can probe arbitrary message ids and distinguish "200 empty" (does not exist) from "302 to slack.com/..." (exists), enumerating the message-id space cross-tenant; (3) **open-redirect class** — the controller emits `URI.create(providerUrl)` UNCONDITIONALLY where `providerUrl` is whatever Slack's `chat.getPermalink` returned, with NO host check, NO scheme check, NO allowlist. The trust assumption is "Slack returns slack.com URLs" — enforced nowhere. Compounds with the OpenAPI spec declaring 301 but the code emitting 302 (`HttpStatus.FOUND`) — three sources of truth (code, spec, live doc) disagree on the basic response code.

## Evidence

- `odd-platform-api/src/main/java/.../controller/DataCollaborationController.java:41-49` — entire `redirect` method:
  ```
  return dataCollaborationService.resolveMessageUrl(messageId)
      .map(providerUrl -> ResponseEntity
          .status(FOUND)  // line 45 — emits 302, NOT 301 as the OpenAPI spec declares
          .headers(h -> h.setLocation(URI.create(providerUrl)))  // line 47 — unconditional URI.create
          .build());
  ```
  No `switchIfEmpty(Mono.error(new NotFoundException(...)))` anywhere in the chain.
- `openapi.yaml:1788-1789` — declares `301 Moved Permanently` for this route. **Drift from code.**
- Live api-reference doc page (`developer-guides/api-reference/data-collaboration`, verified 2026-05-25 status 200) acknowledges the drift explicitly: "the OpenAPI spec declares `301 Moved Permanently` for this route; the platform actually serves `302 Found`. Operators should treat responses as 302." — but the OpenAPI YAML is still wrong.
- `DataCollaborationServiceImpl.java:72-77` (referenced) — no validation; passes through to `messageProviderClientFactory.getOrFail(messageIdentity.messageProvider()).resolveMessageUrl(...)`.
- `SlackAPIClientImpl.java:84-95` (referenced) — `chat.getPermalink` response is unwrapped as `response.getPermalink()` verbatim; no validation.
- `SecurityConstants.java:98-355` — zero entries for `/api/datacollaboration/**` OR `/api/messages/**`. Path falls through to `AuthorizationCustomizer.java:29` `pathMatchers("/**").authenticated()` — any authenticated user reaches the endpoint regardless of role.
- `ReactiveMessageRepositoryImpl.java:171-185` (referenced) — `getMessageProviderIdentity(messageId)` query reads `MESSAGE.UUID` + `MESSAGE.CREATED_AT.eq(UUIDHelper.extractDateTimeFromUUID(messageId))` ONLY — no owner filter, no cross-tenant guard, no caller-identity scope.
- DataCollaborationController class sidecar `bugs_limitations_corner_cases.[0]` (open-redirect, MEDIUM), `[1]` (status-code drift, MEDIUM), `[2]` (no 404 path, MEDIUM), `[8]` (no RBAC, HIGH).
- Probe artifact P-144 already defined for the non-existent-UUID 200-vs-404 question; P-145 for open-redirect class.

## Notes

- This is an ENRICHER for **F-038 Data Collaboration**. F-038 already covers the opt-in Slack-Discussions tab; this thread surfaces three operator-visible drift facets the existing flow may not capture: the message-existence oracle, the open-redirect class, and the spec-vs-code disagreement.
- The "open-redirect class" finding is delicate: in practice, Slack's `chat.getPermalink` always returns `https://<workspace>.slack.com/archives/...` URLs. The platform trusts that contract. The fix is small (validate the URL's host ends in `.slack.com` and the scheme is `https://`) and well-bounded. The risk surface is conditional on Slack's API integrity — but defense-in-depth is cheap here.
- The "message-existence oracle" is the more operator-visible concern: any authenticated user can iterate UUIDv1 message IDs (which encode the creation timestamp — the search space is bounded by the platform's deployment age) and learn which IDs exist + redirect to the corresponding Slack permalinks. For a multi-tenant deployment this is cross-tenant data leakage; for a single-tenant deployment it's information disclosure (who-discussed-what when).
- The status-code drift (301 spec vs 302 code) matters for spec-generated client code (`generated-sources` in `odd-platform-ui`) — TypeScript clients may special-case 301 (cache the redirect, never re-call) vs 302 (re-call on every navigation). The current behaviour (302) is actually correct for a dynamic redirect; the spec is wrong.
- Concept-merger candidate: "Mono.empty silently becomes HTTP 200 in WebFlux controllers" — this pattern is structurally present anywhere a controller does not explicitly `switchIfEmpty`. The data-collaboration redirect is one instance; the GenAI controller, the alert mutations, and many others may share it. Worth a sweep.

## Next

1. **Probe**: with a valid authenticated user (any role), iterate UUIDv1s by guessing a recent timestamp + random clock-seq; observe which return 302 (= exist) vs 200 empty (= don't exist). Quantify the enumeration cost.
2. **Probe**: mock `SlackAPIClient` to return an attacker-controlled URL; assert the controller emits the 302 to that URL unconditionally.
3. **Graduate** as F-NNN "Discussions message redirect contract — existence, authorization, and redirect-target integrity" OR enrich F-038 with these facets.
4. **SEC-NNN MEDIUM** — add `switchIfEmpty(Mono.error(new NotFoundException(...)))` at the service tier (one-line fix at `DataCollaborationServiceImpl.java:72-77`).
5. **SEC-NNN MEDIUM** — validate `providerUrl.startsWith("https://") && URI.create(providerUrl).getHost().endsWith(".slack.com")` before redirect; reject with 500 + structured error otherwise.
6. **REFACTOR-NNN LOW** — fix the OpenAPI spec to declare 302 (one-line YAML change at `openapi.yaml:1788-1789`).
7. **DOC-NNN LOW** — once fixed, remove the "operators should treat responses as 302" note from the live doc.

## Links

- cluster_with: [F-038]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — into F-038 Data Collaboration. F-038's drift_class_summary already enumerates all three SHB-062 facets: `open_redirect_class_slack_permalink_trusted_verbatim`, `openapi_301_vs_impl_302_redirect_status_code_drift`, `non_uuid_v1_message_id_returns_200_not_404_silent_conflation`. The fourth concern (no per-message authorization = message-existence oracle for any authenticated user) is structurally inside `rbac_ungated_three_endpoints_pillar_catch_all_only`. F-038 batch ZF primary-source at DataCollaborationController.java:41-49 + openapi.yaml:1788-1789 + ReactiveMessageRepositoryImpl.java:171-185 covers the full SHB-062 hypothesis. Probes P-144 + P-145 already authored. Thread marked merged. F-038: Data Collaboration — drift_class facets already cover the full SHB-062 hypothesis.
