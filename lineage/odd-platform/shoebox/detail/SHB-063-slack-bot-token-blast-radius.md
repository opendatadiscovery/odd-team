# SHB-063 — Slack OAuth bot token is the single secret protecting the workspace integration — no rotation, no scoping, no in-app revocation signal

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators enabling Data Collaboration ship a Slack OAuth bot token (`datacollaboration.slack-oauth-token`) into their application config. The token is bound at boot time into a singleton `AsyncMethodsClient`, used for ALL outbound Slack calls (`conversations.list` channel enumeration, `chat.postMessage`, `chat.getPermalink`). A leaked token grants the attacker: enumerate every channel the bot is a member of, post messages as the bot to any of those channels, retrieve permalinks for any message id. Defences are MINIMAL: (a) the token is required at bean construction — fail-fast on empty; (b) Spring's default `Sanitizer` masks the property name `slack-oauth-token` in `/actuator/env` (token substring match). There is NO env-var rotation hook (operator must restart the JVM), NO token-lifecycle integration (no expiry check, no refresh flow), NO fail-closed-on-revocation (a revoked token returns `invalid_auth` from Slack → `SlackAPIException` → 5xx, but the Discussions feature is NOT marked broken in the UI; users see 5xx errors on every action). The operator's only signal of token compromise is Slack-workspace-side audit logs — which the operator may not own.

## Evidence

- `odd-platform-api/src/main/java/.../datacollaboration/config/DataCollaborationConfiguration.java:21-29` — `@Value("${datacollaboration.slack-oauth-token}")` injects the token; `slackAPIClient(...)` constructs a single `AsyncMethodsClient` at bean creation; `if (StringUtils.isEmpty(slackOauthToken)) throw new IllegalArgumentException("Slack OAuth token is empty")` — fail-fast on empty BUT no validity-check (a non-empty-but-invalid token passes the check).
- `DataCollaborationConfiguration.java:27` — the `AsyncMethodsClient` is constructed once and reused across all callers (`SlackAPIClientImpl.java:23-28`).
- `SlackAPIClientImpl.java:84-95` (referenced in DataCollaborationController sidecar) — `exchangeForUrl` emits `sink.error(new SlackAPIException(response.getError()))` when Slack returns `invalid_auth`. The exception propagates via WebFlux to a generic 5xx. **No application-state change** flags the feature as "token broken."
- Slack docs (WebFetched 2026-05-25 per DataCollaborationController sidecar): bot token scopes required = `channels:read`, `chat:write`, `chat:read`. Compromising the token grants all three.
- DataCollaborationController class sidecar `bugs_limitations_corner_cases.[7]` (HIGH operational invariant) primary source.
- `application.yml:206` — commented placeholder `slack-oauth-token: # xoxb-...` — operator-set, plaintext-at-rest in YAML (unless externalised to env vars / secrets backend).
- No secrets-backend integration ships with the platform for this key (cross-reference: only `odd-collector` ships an AWS SSM hook per system-mission.md P-10 maintainer notes; the platform side does not).

## Notes

- This is an ENRICHER for **F-038 Data Collaboration**. F-038 covers the opt-in Slack-Discussions surface; this thread surfaces the credential-lifecycle-and-blast-radius shape that operators need to understand BEFORE enabling.
- The "no in-app revocation signal" is the most operator-relevant gap: when a workspace admin rotates or revokes the bot token, the Discussions feature degrades silently (every `postMessageInSlack` returns 202 because the message is enqueued; the leader-elected sender job retries N times per `datacollaboration.sending-messages-retry-count` = 3 by default, then marks the message FAILED; the UI shows "Message failed to send" without explaining WHY). Operators have no path to "the token is revoked, you need to update config and restart" from the UI.
- The compound with the bot-channel scope is concerning: the bot can only see PUBLIC channels it has been invited to (per `SlackAPIClientImpl.java:45` `.filter(Conversation::isMember)`). Operators may have invited the bot to channels they later forgot about; a token leak means the attacker enumerates that forgotten scope.
- The fix space is bounded but non-trivial:
  - Easy: surface `slack-oauth-token-rotation-required` flag in admin UI when boot detects an `invalid_auth` response.
  - Medium: integrate with Slack's app-config endpoint to validate the token AT boot AND periodically (every 1 hour), flag feature as degraded otherwise.
  - Hard: support Slack's rotating-token / refresh-token flow (per Slack OAuth 2.0 specs).
- Cross-cuts SHB-056 (no HMAC on webhook) — both reflect "the platform delegates secret management entirely to the operator." OK as policy; not always documented as such.

## Next

1. **Probe**: deploy ODD with Data Collaboration enabled, post a message, then revoke the bot token Slack-side, post another message, observe what the user sees (likely 202 Accepted + UI-side "delivery failed" with no actionable diagnostic).
2. **Graduate** as F-NNN "Slack bot token lifecycle and revocation surface" OR enrich F-038 with this as a load-bearing operational concern.
3. **SEC-NNN MEDIUM** — at boot, call `auth.test` Slack API to validate the token; fail-startup or mark-degraded on `invalid_auth`. One-line additional call in `DataCollaborationConfiguration.slackAPIClient`.
4. **REFACTOR-NNN MEDIUM** — UI affordance surfacing "Discussions degraded — Slack token may be invalid" + the runbook link.
5. **DOC-NNN MEDIUM** — `features/active-platform-features/data-collaboration` (currently 404 — see SHB-062 thread on the broken doc page) should describe the token lifecycle + rotation runbook.

## Links

- cluster_with: [F-038, SHB-056, SHB-062]
- merged_into: (open)
- supersedes: []
