# ADR-CANDIDATE-216 — Slack webhook receiver (`/api/slack/events`) is UNCONDITIONALLY WHITELISTED in all four auth modes by design — Slack callback must reach it without auth; the `datacollaboration.enabled` feature flag is the SOLE defence

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-09 Security & Access Control]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:implicit_adrs.[1]` (LSN-018 PRESENCE) — "Filter-acked unknown event types … Slack's documented contract is to retry on non-2xx, so ack-200 on filtered events is the explicit choice to avoid Slack-side retry storms"
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:concepts.invariants` — "the path is publicly accessible (whitelisted in all auth modes)"
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:security.auth_mode_relevance` — "DISABLED `anyExchange().permitAll()` / LOGIN_FORM `permittedPaths` (LoginFormSecurityConfiguration.java:49-51) / OAUTH2 + LDAP `WHITELIST_PATHS` (SecurityConstants.java:96) — All four modes accept unauthenticated traffic"

**Decision statement**: `POST /api/slack/events` is INTENTIONALLY whitelisted from authentication in ALL FOUR platform auth modes. The architectural reasoning is that Slack's Events API protocol requires the receiver to be reachable by Slack's delivery infrastructure (which holds no platform credential); enforcing platform-level auth would make the integration impossible. The trade-off is encoded at FOUR distinct files: (a) `SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96) lists `/api/slack/events` alongside `/ingestion/**` and `/actuator/**` as the canonical "publicly reachable" set; (b) `LoginFormSecurityConfiguration.java:49-51` explicitly enumerates `/api/slack/events` in `permittedPaths`; (c) `AuthorizationCustomizer.java:22-23` consumes `WHITELIST_PATHS` for OAuth2 + LDAP modes via `.pathMatchers(WHITELIST_PATHS).permitAll()`; (d) `DisabledAuthSecurityConfiguration.java:13-17` permits everything anyway. The four-way enumeration is the deliberate consistency — the decision is fully spelled out at every auth-mode entry point.

The COMPENSATING controls the architecture chooses are:
1. **Feature-flag isolation** — `datacollaboration.enabled=false` is the application.yml default; the entire EventApiController bean is `@ConditionalOnDataCollaboration` gated, so the route 404s by default. The default deployment has NO publicly-reachable Slack webhook surface.
2. **URL-verification challenge as proof-of-Slack-config** — Slack's url_verification step gives the operator end-to-end proof at configuration time that the deployed `/api/slack/events` is reachable from Slack; subsequent deliveries flow through the same path.
3. **Structural filter at parse-time** — `SlackEventParser.java:65-74, 86-95` filters non-thread-reply events; `SlackMessageProviderEventHandler.java:31-35` filters thread-replies whose parent is NOT a tracked ODD `messages` row.

What the architecture INTENTIONALLY does NOT do (a separate REFACTORING scope, NOT a contradiction of this ADR):
- Slack request signature verification (`X-Slack-Signature` HMAC-SHA256) — Slack's documented additional defence (`https://api.slack.com/authentication/verifying-requests-from-slack`); REFACTOR-633 captures the gap.
- `event_id` idempotency / dedup — Slack at-least-once retries produce duplicate child messages; REFACTOR-634 captures the gap.
- Rate limiting on the public endpoint — REFACTOR-643 captures the gap.

The ADR's stance: the whitelist is deliberate (Slack-callback architecture); the absence of signature verification is the gap (not a deliberate trust assumption). The docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` publish the `request_url` and the bot manifest WITHOUT warning operators that the path is unauthenticated and signature-unverified.

**Wisdom test**: PASS. Four intent anchors:
1. **Structural-decision-positive evidence** — `WHITELIST_PATHS` is an explicit array; the entry `/api/slack/events` was added deliberately (verified via Grep across `<odd-platform>`: 6 source files reference the path; all 4 are auth-config entries that PERMIT it). The decision is not absent; it is repeated in 4 distinct config layers.
2. **Functional-requirement-driven** — Slack's Events API contract requires an unauthenticated `request_url`; the docs publicly publish the manifest. Adding auth to this path would break the integration; the absence is REQUIRED-by-the-external-system.
3. **Live-doc acknowledgment** — `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` publishes the path AS the integration contract (WebFetched 2026-05-25 status 200; verbatim per the EventApiController sidecar's docs_link_semantic).
4. **Compensating-control architecture** — the feature-flag gating + the parse-time filtering + the structural thread-anchor filter are EXPLICIT compensating controls — three defensive layers built into the design, not accidental.

Structural impact (the whitelist is intrinsic to webhook architecture; alternative — gate with platform auth — is structurally impossible for Slack callbacks); alternative (signed JWT + reverse-proxy mTLS) is a structural change to the integration model. **Sibling pattern**: the alertmanager-webhook receiver in the alerting pillar follows the same shape — webhook receivers are unauthenticated by architectural necessity; signature verification is the recommended layered control.

**Operator-visible consequence** (per live-docs):
- Operator follows the docs, sets `datacollaboration.enabled=true`, configures Slack app event subscriptions to `<ODD_PLATFORM_BASE_URL>/api/slack/events`.
- The endpoint is now reachable from any internet host that can reach the platform's port — Slack's delivery, AND any adversary scanning the platform's port.
- An adversary who can guess a tracked `thread_ts` (feasible if ODD is connected to a public-Slack channel and the channel history is observable) can forge events that pollute the Discussions tab of a tracked data entity.
- The compensating controls (signature verification, rate limit, dedup) that Slack documents as defence-in-depth are NOT IMPLEMENTED — captured as separate refactoring scopes.

**Existing ADR**: composes with **ADR-CANDIDATE-019** (Data Collab disabled-by-default) — the feature-flag gating is half of this ADR's "compensating control" story. Also composes with **ADR-CANDIDATE-029** (DISABLED-as-default), which makes the WHITELIST_PATHS distinction moot for DISABLED mode (all paths are permit-all), but creates the operator-onboarding-friendly stance.

DISTINCT FROM **ADR-CANDIDATE-003** (read-collaborative GET): ADR-003 is about READ surfaces being authenticated-only; ADR-216 is about a WRITE surface (POST) being UNAUTHENTICATED ENTIRELY because Slack callback semantics require it. The two are different architectural decisions; clustering them would muddle the trust model.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-633** NEW (HIGH) — `X-Slack-Signature` HMAC verification absent
- **REFACTOR-634** NEW (HIGH) — Slack at-least-once event_id dedup absent (duplicate downstream rows)
- **REFACTOR-643** NEW (HIGH) — No rate-limit + JSONB column unbounded payload → partition-fill DoS
- DOC-GAP — `configuration-and-deployment/odd-platform#enable-data-collaboration` does NOT disclose the unauthenticated + signature-unverified + replay-vulnerable posture (per the sidecar's doc_drift_findings[0])

**Proposed action**: Promote to `adrs/drafts/slack-webhook-unauthenticated-by-design.md` (new ADR). Document:
1. The stance: Slack webhook callbacks are unauthenticated by architectural necessity.
2. The four-layer enumeration: `WHITELIST_PATHS` + `permittedPaths` + `AuthorizationCustomizer.permitAll` + `DisabledAuthSecurityConfiguration.permitAll`.
3. The compensating controls: feature-flag gating + parse-time filtering + structural thread-anchor filter.
4. The MISSING compensating controls operators should know about: signature verification, idempotency dedup, rate limiting. These are SEPARATE refactoring scopes — adding them does NOT supersede this ADR; it composes with it.
5. The doc-disclosure responsibility: the live `enable-data-collaboration` page MUST warn operators that the endpoint is unauthenticated and signature-unverified; without signature verification their deployment trusts the Slack-delivered payload by assumption alone.

**Severity rationale**: HIGH — load-bearing security-architecture decision visible at FOUR distinct config-file layers, defining the trust boundary for the entire Discussions sub-feature. Pairs with REFACTOR-633 (signature verification) and REFACTOR-634 (idempotency) — those gaps are the operator-actionable closures the ADR's stance does NOT defend.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-019 (feature-flag isolation as compensating control); ADR-CANDIDATE-029 (DISABLED-as-default trades up-front auth for opt-in security).
- SUPERSEDES: none.
- CONFLICTS: none. The borderline question "is signature-verification gap deliberate?" is RESOLVED — it is a gap (REFACTOR-633), not an extension of this ADR.

---
