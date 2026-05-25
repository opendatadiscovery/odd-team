# REFACTOR-637 — `GET /api/messages/{message_id}/url` is an open-redirect-class surface — the controller emits `URI.create(providerUrl)` UNCONDITIONALLY where `providerUrl` comes from Slack's `chat.getPermalink`; no host check, no scheme check, no allowlist

**Severity**: MEDIUM (elevated to HIGH if Slack API is ever compromised)
**Category**: open-redirect + missing-validation + missing-allowlist
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "Open-redirect-class surface on `redirect`: the controller emits `ResponseEntity.status(FOUND).headers(h -> h.setLocation(URI.create(providerUrl)))` (lines 42-48) where `providerUrl` comes from Slack's `chat.getPermalink` response (`SlackAPIClientImpl.java:84-95`) UNCONDITIONALLY. No host check, no scheme check (could be `javascript:` if Slack ever returned one), no allowlist of known-good URL prefixes (e.g., `https://*.slack.com/archives/...`)."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:concepts.invariants.[trusts-Slack's-chat.getPermalink-verbatim]` — "no host / scheme / structure validation in the controller (lines 42-48) or in `DataCollaborationServiceImpl.resolveMessageUrl` … or in `SlackMessageProviderClient.resolveMessageUrl` … or in `SlackAPIClientImpl.exchangeForUrl`."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:stress_findings.name_behavior_pairs.[redirect(messageId)]` — "UNCONDITIONAL — no URL validation, no host check, no scheme check."

**Description**: The `redirect` endpoint at `DataCollaborationController.java:41-49` is:

```java
@Override
public Mono<ResponseEntity<Void>> redirect(UUID messageId, ServerWebExchange exchange) {
    return dataCollaborationService.resolveMessageUrl(messageId)
        .map(providerUrl -> ResponseEntity.status(HttpStatus.FOUND)
            .headers(h -> h.setLocation(URI.create(providerUrl)))
            .build());
}
```

`providerUrl` is whatever string Slack's `chat.getPermalink` API returned (via the chain `DataCollaborationServiceImpl.resolveMessageUrl → SlackMessageProviderClient.resolveMessageUrl → SlackAPIClientImpl.exchangeForUrl → response.getPermalink()`). The string is passed verbatim through `URI.create(...)` into `Location:` header.

The trust assumption is "Slack returns slack.com URLs". The assumption is enforced **nowhere** in the four-layer chain:
- Controller (lines 42-48) — no validation.
- Service (`DataCollaborationServiceImpl.resolveMessageUrl:72-77`) — no validation.
- Provider client (`SlackMessageProviderClient.resolveMessageUrl:64-66`) — no validation.
- API client (`SlackAPIClientImpl.exchangeForUrl:83-95`) — no validation; passes through `response.getPermalink()`.

**Threat model**:

1. **Slack API compromise** (low probability, high impact) — if Slack's `chat.getPermalink` API is ever compromised to return attacker-controlled URLs (via a Slack security incident, a Slack workspace owner spoofing a permalink, or a Slack API bug), the platform becomes a 302 redirector to whatever Slack returned.

2. **Slack workspace abuse** (medium probability, low impact) — a malicious workspace admin in a Slack-connected ODD deployment could replace the bot's permalink response by intercepting the SDK call (e.g. via DNS hijack). The platform redirects to the hijacked URL.

3. **`URI.create` exception path** (high probability, low impact) — `URI.create(...)` throws `IllegalArgumentException` for malformed inputs (e.g. URLs with unencoded special characters, schemes with invalid characters). The exception bubbles through the WebFlux reactive chain as a 5xx, not a 4xx with a structured error body. The platform's response is opaque.

4. **`javascript:` / `data:` scheme** (theoretical) — if Slack's API ever returned a non-http(s) URL (perhaps due to a bug), browsers MAY follow the 302 to a `javascript:` or `data:text/html` URL. Modern browsers neutralise `javascript:` for top-level navigation, but `data:` URLs work in some browsers.

**Operator-visible failure modes**:

1. Compromised Slack API: ODD becomes a redirector. Users clicking "Open in Slack" land on attacker pages.
2. Malformed URL: 5xx response; users see an opaque error page.
3. Hijacked workspace: users land on the attacker's mock-Slack page; credentials may be phished.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../DataCollaborationController.java:41-49` (the redirect endpoint).
- `<odd-platform-api>/src/main/java/.../DataCollaborationServiceImpl.java:72-77` (service — passes through).
- `<odd-platform-api>/src/main/java/.../SlackMessageProviderClient.java:64-66` (provider client — passes through).
- `<odd-platform-api>/src/main/java/.../SlackAPIClientImpl.java:83-95` (API client — passes through).

**Existing-ADR-or-implied-prescription**: No ADR; the pattern is webhook-architecture standard practice (allowlist redirect targets). Sibling gap: REFACTOR-100 (login-form-redirect open-redirect — same class on the auth side).

**Proposed remedy**: Three-part fix:

1. **Add scheme + host allowlist validation** in the controller:

```java
private static final Set<String> ALLOWED_REDIRECT_SCHEMES = Set.of("https");
private static final Pattern SLACK_HOST_PATTERN = Pattern.compile("^[a-z0-9-]+\\.slack\\.com$");

@Override
public Mono<ResponseEntity<Void>> redirect(UUID messageId, ServerWebExchange exchange) {
    return dataCollaborationService.resolveMessageUrl(messageId)
        .flatMap(providerUrl -> {
            try {
                URI uri = URI.create(providerUrl);
                if (!ALLOWED_REDIRECT_SCHEMES.contains(uri.getScheme())
                    || !SLACK_HOST_PATTERN.matcher(uri.getHost()).matches()) {
                    log.warn("Refusing redirect to non-Slack URL: messageId={}, url={}", messageId, providerUrl);
                    return Mono.error(new BadUserRequestException("Refused to redirect to non-Slack URL"));
                }
                return Mono.just(ResponseEntity.status(HttpStatus.FOUND)
                    .headers(h -> h.setLocation(uri))
                    .build());
            } catch (IllegalArgumentException e) {
                log.warn("Refusing redirect to malformed URL: messageId={}, url={}", messageId, providerUrl);
                return Mono.error(new BadUserRequestException("Refused to redirect to malformed URL"));
            }
        });
}
```

2. **Make the allowlist configurable** (`datacollaboration.redirect-host-allowlist` defaulting to `*.slack.com`) so operators on Slack Enterprise Grid deployments with custom domains can extend the allowlist.

3. **Add integration tests**:
   - Mock SlackAPIClient returning `https://workspace.slack.com/archives/C123/p456` → 302 with that Location.
   - Mock SlackAPIClient returning `https://attacker.com/phish` → 400 + log warning.
   - Mock SlackAPIClient returning `javascript:alert(1)` → 400 + log warning.
   - Mock SlackAPIClient returning a malformed URL → 400 + log warning.

**Severity rationale**: MEDIUM today — the trust in Slack's API is the platform's only defence; Slack's reputation for not returning attacker-controlled permalinks holds in practice. Severity elevates to HIGH on any compromise of the Slack API; the fix is cheap and the cost-benefit favours hardening. Pairs with REFACTOR-638 (Mono.empty → 200 → message-existence oracle) — the two together secure the redirect path.

**Suggested backlog grouping**: `Discussions hardening sprint` — pair with REFACTOR-638 (oracle) + REFACTOR-639 (status-code drift) + REFACTOR-644 (channel filter) + REFACTOR-645 (audit-log gap). The five together close the operator-actionable gaps on the Discussions feature.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-100 (login-form-redirect open-redirect — same class).
- SUPERSEDES: none.
- CONFLICTS: none.

---
