---
doc_page: "docs/active-platform-features/data-collaboration.md"
page_title: "Data Collaboration"
live_url: "https://docs.opendatadiscovery.org/features/active-platform-features/data-collaboration"
live_url_verified_status: "200"
live_url_resolved_slug: "features/active-platform-features/data-collaboration"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Slack collaboration app"
    - "Enqueue Slack Discussion Message"
    - "Slack Events INBOUND webhook ships NO signing-secret verification — anyone can forge events to POST /api/slack/events (batch ZF)"
    - "Slack channels autocomplete — 1-minute Caffeine cache staleness window + startsWith-not-contains filter (batch ZF)"
  features:
    - "F-038"
    - "F-197"
  code_nodes:
    - "odd-platform java EventApiController controller-method:handleSlackEvent"
    - "odd-platform java DataCollaborationController controller-method:postMessageInSlack"
audience: [operator, developer]
doc_claim_vs_code:
  - "SUBSTRATE STALE (resolved drift): F-038 finding (h), the DataCollaborationController `docs_link_semantic` block, and both Slack invariants' 'CONTRAST WITH LIVE DOCS' sections record this page as live-404 (WebFetched 2026-05-10 / 2026-05-25, status 404, 'page not yet live-published'). This session's WebFetch on 2026-05-29 returns 200 — the page IS now published at /features/active-platform-features/data-collaboration with all sections intact, and the danger admonition's signature-verification text renders live. The 404 was a publication-lag artefact; the substrate doc-link status is now out of date. Evidence: live=200 this session vs node `odd-platform java DataCollaborationController controller-method:postMessageInSlack` docs_link_semantic.inferred_docs[0].last_verified_status=404."
  - "Page OMITS a code-confirmed operator-critical caveat (LSN-001 class): the page documents the unsigned-webhook gap and the OAuth-token blast radius, but does NOT mention that NONE of the four Data Collaboration endpoints carry an RBAC permission gate, and that under `auth.type=DISABLED` all four (including the three /api/datacollaboration/... routes, not just the webhook) are anonymously reachable with `datacollaboration.enabled` as the only defence. The page's framing ('disabled by default; 404 when disabled') implies the flag is the gate but does not state that ENABLING the feature in a DISABLED-auth deployment publishes the entire write surface unauthenticated. Evidence: F-038 findings (b)/(c); node `odd-platform java DataCollaborationController controller-method:postMessageInSlack` finding:security (`SecurityConstants.java:96-355` has no rule for `/api/datacollaboration/...`; `AuthorizationCustomizer.java:29-30` catch-all; DISABLED skips auth) + finding:bugs_limitations_corner_cases (no `@PreAuthorize`, no owner scoping)."
  - "Page CONFIRMED-accurate, no drift, on every stated caveat — recorded for provenance, not as a defect: (1) `@ConditionalOnDataCollaboration` gating → 404 when `datacollaboration.enabled=false` matches `DataCollaborationFeatureCondition.java:18-22` + `application.yml:205` default false (node DataCollaborationController.understanding). (2) Default `false` flag, `DataCollaborationMessageSenderJob` draining the queue, retry default 3 (`datacollaboration.sending-messages-retry-count`) matches F-038 + `DataCollaborationProperties.java:12`. (3) No Slack request-signature verification — raw `Mono<String>` body, headers never read — matches invariant slack-events-inbound-no-signature-verification, `EventApiController.java:22-27`; zero codebase matches for X-Slack-Signature/signingSecret/HMAC.SHA256. (4) `message_provider_event` insert has no unique constraint on (provider, event_id) / no ON CONFLICT, so Slack at-least-once delivery materialises duplicate child messages — matches the same invariant, `V0_0_59__data_collaboration.sql:25-39`. (5) 60-second Caffeine channel-autocomplete cache (`expireAfterWrite(1, MINUTES)`, fixed sentinel key) matches invariant slack-channels-1-minute-caffeine-cache, `SlackMessageProviderClient.java:36-44`. (6) Singleton Slack client built once at boot from `datacollaboration.slack-oauth-token`, reused for process lifetime, no revocation detection — matches entitie:slack-collaboration-app + `DataCollaborationConfiguration.java:21-25`."
  - "Page UNDER-states the channel-autocomplete behaviour relative to code (minor, developer-facing): the page documents only the 60-second cache TTL caveat. The code-confirmed invariant adds two more autocomplete surprises the page does not surface — the filter is `startsWith(query)` not `contains` (typing the middle of a channel name returns zero results: `SlackMessageProviderClient.java:50-55`), and only PUBLIC channels the bot has been explicitly added to are listed (private/DM/archived excluded: `SlackAPIClientImpl.java:45,130-141`). Evidence: invariant slack-channels-1-minute-caffeine-cache-stale-window-and-startswith-filter. Tracked as the existing DOC-GAP-290 family; not new."
maintainer_curated: false
---

# Data Collaboration — doc understanding

This operator/developer page documents ODD Platform's **Data Collaboration** feature: an opt-in, per-data-entity **Discussions** tab that mirrors threads to a full Slack app (OAuth + Slack Events API, bidirectional) — distinct from the one-way alert webhook in Notifications. It binds to the backend feature **F-038** (the four-endpoint controller chain: channel autocomplete, message enqueue, message-permalink redirect, and the inbound `/api/slack/events` webhook) and the UI feature **F-197** (the Discussions tab), confirmed via graph-node. The message-lifecycle prose (enqueue → 202 → advisory-lock-elected `DataCollaborationMessageSenderJob` → Slack; reply → webhook → `message_provider_event` → child message) maps to concept `Enqueue Slack Discussion Message` and code node `DataCollaborationController controller-method:postMessageInSlack` (`DataCollaborationController.java:33`).

The page's four caveats are unusually well-grounded: each is independently confirmed by a code-walked invariant — the unsigned `/api/slack/events` webhook (`invariant:slack-events-inbound-no-signature-verification-public-webhook`, `EventApiController.java:22-27`, code node `EventApiController controller-method:handleSlackEvent`), the OAuth-token blast radius (`entitie:slack-collaboration-app`, `DataCollaborationConfiguration.java:21-25`), the at-least-once duplicate-message gap (missing unique constraint on `message_provider_event`, `V0_0_59__data_collaboration.sql:25-39`), and the 60-second channel-autocomplete cache (`invariant:slack-channels-1-minute-caffeine-cache`, `SlackMessageProviderClient.java:36-44`). No page claim contradicts the code.

Two drift signals for the maintainer: (1) the substrate records this page as live-404 (2026-05-10 / 2026-05-25), but it now resolves 200 — the substrate's doc-link status is stale, not the page. (2) The page omits the code-confirmed RBAC gap — none of the four endpoints carry a permission gate, and under `auth.type=DISABLED` all four are anonymously reachable (F-038 (b)/(c); `SecurityConstants.java:96-355`), an LSN-001-class operator-critical omission the existing DOC-GAP-290 family already tracks for the webhook but not for the three write endpoints.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
