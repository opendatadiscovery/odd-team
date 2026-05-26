# SHB-129 — Slack Events webhook (`POST /api/slack/events`) accepts forged events from any internet host because the Slack signing-secret verification is not implemented

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators enabling Data Collaboration follow the live docs to set up a Slack app pointing at `<ODD_PLATFORM_BASE_URL>/api/slack/events` — the published Slack app manifest in the docs. They reasonably assume the platform implements Slack's documented signature verification (`X-Slack-Signature` HMAC-SHA256 over `v0:{X-Slack-Request-Timestamp}:{raw body}` using the app's signing-secret) because Slack mandates this for production-grade integrations. The implementation does not. The entire codebase contains ZERO matches for `X-Slack-Signature`, `signing.secret`, `signingSecret`, `verifySignature`, or `HMAC.SHA256` — and the controller deserialises the raw body straight from `@RequestBody Mono<String>` without ever reading any header. Combined with the endpoint being whitelisted from authentication in every auth mode (`/api/slack/events` is in `SecurityConstants.WHITELIST_PATHS`), any internet host can forge Slack events; the parser-level filter (only thread replies on TRACKED parent messages produce a downstream materialised child message) is the sole defence, and `thread_ts` values for tracked threads are observable to anyone in public Slack channels.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/EventApiController.java:22-27` — the controller deserialises raw body straight from `@RequestBody Mono<String>` and never reads any header.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/datacollaboration/SlackEventParser.java:22-23` — `parse(final String rawJson)` signature takes only the raw body string. No headers, no timestamp, no signature.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `WHITELIST_PATHS` contains `/api/slack/events` (verified via EventApiController sidecar known_security_gaps[1]); consumed by `AuthorizationCustomizer.java:22-23` for OAUTH2/LDAP and `LoginFormSecurityConfiguration.java:49-51` for LOGIN_FORM. `DisabledAuthSecurityConfiguration` permits everything anyway.
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` (WebFetched 2026-05-25 status 200 per EventApiController sidecar) — publishes the Slack app manifest with `request_url: https://<ODD_PLATFORM_BASE_URL>/api/slack/events`, bot scopes `channels:history, channels:read, chat:write, users:read, incoming-webhook`, and bot event subscription `message.channels`. The docs section contains NO mention of `X-Slack-Signature` / `signing.secret` — verified via WebFetch model returning "Not found".
- `https://api.slack.com/authentication/verifying-requests-from-slack` — Slack's published requirement: receivers MUST validate `X-Slack-Signature` HMAC-SHA256 over `v0:{X-Slack-Request-Timestamp}:{raw body}` using the app's signing-secret.
- `odd-platform-api/src/main/resources/db/migration/V0_0_59__data_collaboration.sql:25-39` — `message_provider_event` table has NO unique constraint on `(provider, event_id)`. Slack's at-least-once delivery + the missing dedup = duplicate `message_provider_event` rows on Slack retries; downstream processor materialises N child `message` rows for one logical event.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMessageRepositoryImpl.java:136-155` — INSERT is plain, no `ON CONFLICT` clause. Duplicate Slack deliveries cause duplicate rows.

## Notes

- Threat model: an attacker reaching the platform's HTTP port can:
  1. Forge a Slack URL-verification challenge → platform echoes back the `challenge` value with 200 OK → no harm but enables endpoint-existence enumeration.
  2. Forge a `message` event with `thread_ts` matching a known tracked thread → enqueues a `message_provider_event` row → processor materialises a child `message` row → operators see the forged message in the Discussions tab as if it came from Slack.
  3. Forge events at high volume → fills `message_provider_event` table (no rate-limit, no dedup) → degrades the processor's leader-elected loop.
- Discoverability of `thread_ts` for tracked threads: thread_ts is the Slack timestamp string for the parent message (which ODD itself sent via `chat.postMessage`). For PUBLIC channels, the thread_ts is visible to anyone observing the channel. For ODD bot scope `channels:history`, the bot has read access to every public channel's history — so the bot's published Discussions threads are observable by every Slack workspace member.
- Operator-observable symptoms:
  - **Forged messages appearing in the Discussions tab on a data entity's page** — a UI user reading the discussion sees an authored attribution but cannot tell the message is forged.
  - **No audit log** — `message_provider_event` rows lack a `created_by_caller_ip` / `created_by_signature_valid` flag. Post-incident analysis cannot distinguish forged from real.
  - **Slack at-least-once duplicates** — even without an attacker, real Slack retries during platform load cause duplicate downstream messages. Users see the same message twice in the thread.
- This is `open` because evidence is rich (6 file:line refs across controller / parser / WHITELIST / migration / repository) but the OPERATOR-FACING SYMPTOM (forged messages in Discussions tab) is one probe firing away from confirmed. Likely promotes to a feature flow under pillar P-07 OR a high-severity SEC-NNN.
- Cross-link to F-038 (Data Collaboration — Slack Discussions tab). F-038 covers the OPT-IN feature; this thread surfaces the SECURITY GAP at the inbound webhook receiver. F-038's drift facets would gain `inbound_webhook_signature_unverified`.
- The fix is a standard Slack-integration pattern: add a config property `datacollaboration.slack-signing-secret`, mount a Spring WebFilter that validates `X-Slack-Signature` before the controller body deserialises, reject with 401 on mismatch. ~50 LOC. The Slack signing-secret is already provided by Slack in the Apps UI alongside the bot OAuth token; operators copy both at deployment time.
- Also need to add: `UNIQUE(provider, event_id)` on `message_provider_event` to handle Slack at-least-once delivery; OR use `ON CONFLICT DO NOTHING` on the INSERT.
- The `incoming-webhook` bot scope in the docs manifest is requested but UNUSED by the code (verified via EventApiController sidecar doc_drift_findings[1]) — historical copy-paste from a Slack example manifest. Tighten the manifest to drop the unused scope.

## Next

1. Promote to `F-NNN — Slack Events Webhook Security` in pillar P-07 OR direct-promote to high-severity SEC-NNN. The operator-visible symptom (forged messages in Discussions tab) is the falsifiable hypothesis.
2. Probe-NNN: against a local docker-compose mirror with Data Collaboration enabled and a fake tracked thread, fire a forged `POST /api/slack/events` with a crafted `message` event whose `thread_ts` matches a known tracked thread; observe the Discussions tab renders the forged message.
3. SEC-NNN: implement Slack signing-secret verification. Add `datacollaboration.slack-signing-secret` property; add `SlackEventSignatureFilter` (Spring WebFilter scoped to `/api/slack/events`) that validates `X-Slack-Signature` HMAC-SHA256 over `v0:{ts}:{body}`; reject 401 on mismatch.
4. SEC-NNN: add `UNIQUE(provider, event_id)` to `message_provider_event`; OR add `ON CONFLICT DO NOTHING` to `ReactiveMessageRepositoryImpl.java:136-155` INSERT.
5. DOC-NNN: extend `configuration-and-deployment/odd-platform#enable-data-collaboration` to document the signing-secret requirement once the SEC fix lands.

## Links

- cluster_with: [F-038]
- merged_into: F-098
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — SHB-129 evidence (7 file:line refs across controller / parser / WHITELIST / migration / repository + live docs + Slack's published mandate) is mature; the inbound-webhook security surface is distinct from F-038's Data Collaboration product-feature angle (the brief explicitly notes this distinction). Minted F-098 at lineage/odd-platform/feature-flows/detail/F-098.yaml (pillar P-10:F-005) — anchored on the inbound INTEGRATION RECEIVER boundary rather than the P-07 feature, consistent with slice-G ownership of "Integrations & Ingestion". Six drift facets: HMAC signature unverified; WHITELIST_PATHS unauthenticated in every mode; no (provider, event_id) uniqueness for at-least-once dedup; no forensic trail; URL-verification-challenge enumeration leak; unused `incoming-webhook` scope. Cross-links F-038 (Data Collaboration product feature) + F-094 (same unauthenticated-every-mode class) + F-097 (Swagger exposes the endpoint).
