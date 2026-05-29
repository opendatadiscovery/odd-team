---
doc_page: "docs/developer-guides/api-reference/data-collaboration.md"
page_title: "Data Collaboration"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/data-collaboration"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Enqueue Slack Discussion Message"
    - "Slack collaboration app"
  features:
    - "F-038"
    - "F-197"
  code_nodes:
    - "odd-platform java DataCollaborationController controller-method:getSlackChannels"
    - "odd-platform java DataCollaborationController controller-method:postMessageInSlack"
    - "odd-platform java DataCollaborationController controller-method:redirect"
    - "odd-platform java DataEntityController controller-method:getDataEntityMessages"
    - "odd-platform java DataEntityController controller-method:getMessages"
    - "odd-platform java EventApiController controller-method:handleSlackEvent"
    - "odd-platform java org.opendatadiscovery.oddplatform.datacollaboration.controller controller:EventApiController"
audience: [developer, operator]
doc_claim_vs_code:
  - "Page documents the POST /api/slack/events inbound webhook in detail (challenge handshake, event_callback, SlackEventParser) but OMITS the operator-critical security caveat that the webhook performs NO Slack request-signature verification (HMAC-SHA256 X-Slack-Signature) — Slack's Events-API contract mandates it; the codebase has zero matches for X-Slack-Signature / signing.secret / verifySignature and the handler deserialises @RequestBody Mono<String> reading no header. LSN-002-class missing-caveat. Evidence: F-038 (drift (a)), node odd-platform java EventApiController controller-method:handleSlackEvent / EventApiController.java:22."
  - "Page lists all four endpoints' routes/gating but OMITS that none of them carry an RBAC permission gate (SecurityConstants.SECURITY_RULES has zero entries for /api/datacollaboration/** , /api/messages/** , /api/slack/events) and that under auth.type=DISABLED all four are anonymously reachable — datacollaboration.enabled is the only defence. Evidence: F-038 (drifts (b),(c))."
  - "Page describes the getSlackChannels autocomplete (filtered by channel_name) but OMITS two UX-shaping behaviours: a 1-minute Caffeine async-loading cache fronting Slack conversations.list (stale window) and a startsWith — not contains — match on the filter. Minor caveat. Evidence: invariant:slack-channels-1-minute-caffeine-cache-stale-window-and-startswith-filter / SlackMessageProviderClient.java:36-44."
  - "CONFIRMED-ACCURATE (not drift): the page's '301 spec vs 302 runtime' note on GET /api/messages/{message_id}/url is correct — DataCollaborationController.redirect (DataCollaborationController.java:41) serves 302 Found, matching F-038's 'server-side 302 to the Slack permalink'. Recorded so a future audit does not re-flag a correct claim."
maintainer_curated: false
---

# Data Collaboration — doc understanding

This developer-guide page is the HTTP API reference for the Data Collaboration feature — the per-entity Slack-mirrored **Discussions** surface. It documents three groups of routes plus the inbound Slack webhook, all gated by `@ConditionalOnDataCollaboration` (404 when `datacollaboration.enabled=false`). The bindings are confirmed via graph-node: the outbound + history routes resolve to `DataCollaborationController` (`getSlackChannels`, `postMessageInSlack`, `redirect`) and `DataEntityController` (`getDataEntityMessages`, `getMessages`); the inbound `/api/slack/events` webhook resolves to `EventApiController.handleSlackEvent` (`EventApiController.java:22`, matching the page's cited line). The page is the API-reference face of feature **F-038** (Data Collaboration backend chain — its `entry_point` enumerates exactly these four routes) and **F-197** (the operator-visible Discussions UI tab). It binds the concepts *Enqueue Slack Discussion Message* (the `202 Accepted` + advisory-lock-elected sender-queue model) and *Slack collaboration app* (full OAuth-bot-token Slack app, distinct from the one-way alert webhook — a distinction the page makes explicitly and correctly).

The page is accurate on the surface it covers and is unusually rigorous (it self-reports the 301/302 spec-runtime drift, which graph-node confirms as correct). Its gap is by omission, not error: it documents the inbound `/api/slack/events` webhook without the security caveats the code makes operator-critical — no Slack request-signature verification, no RBAC gate on any of the four routes, and full anonymous reachability under `auth.type=DISABLED`. Per F-038 (`primary_drift_class: unauthenticated_slack_webhook_no_signature_verification`) this is the highest-value finding here — an LSN-002-class missing-caveat that a doc-gap follow-up should capture next to the webhook table.

## Maintainer notes
