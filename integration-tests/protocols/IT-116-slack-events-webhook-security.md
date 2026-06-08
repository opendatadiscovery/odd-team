---
id: IT-116
title: "Slack Events webhook has no signature verification; its exposure is gated solely by datacollaboration.enabled"
gates:
  validates: [F-098]
  enforces: []
  regresses: [PLT-054, PLT-099]
test_class: integration
stack: odd-minimal
automation: "e2e:slack-events-webhook-security.spec.ts"
plan_ref: I1
status: ready
---

# IT-116 — F-098 Slack Events inbound webhook security

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any tooling.
> The `automation:` spec runs the same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

`POST /api/slack/events` (EventApiController.java:22-27) binds ONLY `@RequestBody Mono<String>` — it reads
**no header**, so it is structurally incapable of verifying `X-Slack-Signature`. `SlackEventParser.parse`
(SlackEventParser.java:22-35) takes only the body and echoes the `url_verification` `challenge` back with
200 **before any signature check (there is none)**. The whole codebase contains **zero**
`X-Slack-Signature` / signing-secret / HMAC-SHA256 handling. The controller is
`@ConditionalOnDataCollaboration` (gated by `datacollaboration.enabled`, default **false** —
application.yml:205); the path is in `SecurityConstants.WHITELIST_PATHS` (line 95-96), so when the feature
is enabled it is anonymously reachable in every auth mode with no Slack verification.

This pins the two security facts observable on the **shipped-default** engine (`datacollaboration.enabled=false`)
**without** enabling the feature (enabling it would be a forbidden stack/config change):

- **UC-001 (source ground truth):** there is zero signature-verification code on the path (the canonical
  HMAC grep returns nothing) AND the controller binds no header — so it cannot verify a Slack signature
  even in principle.
- **UC-003 (live posture):** the receiver's *existence* is gated **solely** by `datacollaboration.enabled`
  — there is no auth gate. With the flag off the route is **unmapped**, behaving identically to a
  definitely-unmapped sibling under `/api/slack/` (proves the 500 is the unmapped-route response, not a
  Slack-handler fault, and that nothing 401/403-rejects the path).
- **UC-010 (live posture):** an unsigned `url_verification` challenge is never auth-rejected (no
  401/403 gate stands in front of the path). With the feature enabled this becomes a 200 challenge echo
  with no signature check — an unauthenticated endpoint-existence/fingerprint oracle.

**Operator-facing consequence:** once an operator sets `datacollaboration.enabled=true`, `/api/slack/events`
is whitelisted from auth in every mode and performs no Slack HMAC verification — any host that can reach the
HTTP port can forge Slack events (rendering as messages on a real entity's Discussions tab) and echo the
challenge to fingerprint the deployment. Source: F-098 (`inbound_webhook_signature_unverified`,
`unauthenticated_under_every_supported_configuration`, `endpoint_existence_enumeration_via_unsigned_challenge`);
filed as PLT-054 + PLT-099 (no HMAC) + PLT-035 (at-least-once dedup).

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal` (`auth.type=DISABLED`, `datacollaboration.enabled=false` — the shipped default).
  `ODD_STACK_EXTERNAL=1` reuses a running stack. **Do not** enable data collaboration — this protocol
  characterizes the shipped default; enabling the feature is a different (enabled-feature) matrix.
- **Auth/config:** no credential needed.
- **Seed data:** none (the receiver is unmounted under the default flag; no DB rows are touched).
- **Source checkout:** the platform source must be readable for the UC-001 grep — sibling `odd-platform`
  checkout (resolved relative to the spec; `ODD_PLATFORM_DIR` overrides). If absent, UC-001 self-skips
  rather than fake-passing.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Feature-off posture confirmed behaviorally: `POST /api/slack/events {type:url_verification,challenge:x}`
  returns the SAME status as `POST /api/slack/<unmapped-sibling>` (both the platform's unmapped-route
  response; neither 401/403) — i.e. the receiver is not mounted.

## 4. Run protocol — what to run (each request carries NO Authorization and NO X-Slack-Signature)

1. **UC-001 grep (human-executable):**
   `grep -rniE 'X-Slack-Signature|signing.?secret|signingSecret|verifySignature|HMAC.?SHA256|HmacSha256|HmacUtils' <odd-platform>/odd-platform-api/src/main/java`
   → **zero matches**. And
   `grep -nE '@RequestHeader|HttpHeaders|ServerHttpRequest|getHeaders' …/EventApiController.java`
   → **zero matches**.
2. **UC-003:** `POST /api/slack/events {"type":"url_verification","challenge":"it116-challenge-marker"}`
   and `POST /api/slack/it116_definitely_unmapped {…}` → both return the same status; neither is 401/403.
3. **UC-010:** `POST /api/slack/events {"type":"url_verification","challenge":"it116-no-signature"}`
   (no signature header) → not 401/403.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-116`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/slack-events-webhook-security.spec.ts`).

## 5. What it checks — assertions

- **PASS (current platform, shipped default)** when: the HMAC grep + the header-binding grep both return
  empty; `/api/slack/events` is never 401/403 and returns the same response as a definitely-unmapped
  sibling; an unsigned challenge is never 401/403.
- **FLIPS (regression-closure signal)** when: the HMAC grep starts matching (a signing-secret filter was
  added — UC-001/UC-010 hardened), OR `/api/slack/events` diverges from the unmapped sibling (the receiver
  is now mounted — re-scope UC-003 to the enabled-feature matrix and assert the mounted-route signature
  behaviour), OR an unsigned challenge starts returning 401/403 (signature now enforced).

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-116.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-098 UC-001 (no signature, contradicted) · UC-003 (unauth/flag-gated, contradicted) · UC-010
  (fingerprint oracle, partial); EventApiController.java:22-27 · SlackEventParser.java:22-35 ·
  SecurityConstants.java:95-96 · application.yml:205 · DataCollaborationFeatureCondition.
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth/authz posture).
- Related: PLT-054 + PLT-099 (no HMAC on /api/slack/events) · PLT-035 (at-least-once dedup) · IT-090/IT-091
  (the Data Collaboration product-feature surface) · F-097 (Swagger spec that exposes this path).
- Responsible disclosure: asserts the verification path's observable behaviour (no code exists; exposure is
  flag-gated); NEVER forges a valid signature, dumps secrets, or gives an exploit recipe.
