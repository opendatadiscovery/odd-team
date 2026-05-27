# DOC-GAP-290 — scanner corroboration append (2026-05-27 batch-6)
# Parent: DOC-GAP-290.md (Slack-events webhook signature absence)
# Append shape: per scanner-ontology-fusion ADR §5.B.6 (Mode B write-back)

corroborated_by_scanner:
  - scanner_id: docs/coverage/undocumented-features
    scan_run_id: SR-20260527T1700Z
    scan_run_date: '2026-05-27'
    ontology_commit_consulted: ede5d277
    mode: B
    mode_b_batch: batch-6
    finding_id_in_scan: F-098 (with `inbound_webhook_signature_unverified` facet — facet of substrate F-098)
    finding_artefact: findings/docs-coverage-undocumented-features/2026-05-27-batch-6.md#f-098-slack-events-webhook-inbound-integration-security-p-10-integrations-ingestion
    feature_flow_anchor: lineage/odd-platform/feature-flows/detail/F-098.yaml
    confirms:
      - "VERIFIED VERBATIM this run at EventApiController.java:1-57: `@PostMapping(path = \"/api/slack/events\")` at line 22 + `handleSlackEvent(@RequestBody final Mono<String> rawRequestBody)` at line 23-24 — RAW body, NO headers read at all, NO `ServerWebExchange` parameter. The pipeline routes via `parseResult.type()` switch (lines 28-41) with NO signature-verification branch."
      - "VERIFIED VERBATIM this run at SlackEventParser.java:22: `public ParseResult parse(final String rawJson)` — takes ONLY the raw body string; no headers, no timestamp, no signature parameter."
      - "VERIFIED this run via Grep across `odd-platform/**/*.java|kt|yml|yaml` for `X-Slack-Signature|signing.secret|signingSecret|verifySignature|HMAC.SHA256|HmacSha256|HmacUtils` — ZERO MATCHES. The signature-verification subsystem is structurally absent."
      - "VERIFIED VERBATIM this run at SecurityConstants.java:95-96: `WHITELIST_PATHS = {\"/actuator/**\", \"/favicon.ico\", \"/ingestion/**\", \"/img/**\", \"/api/slack/events\"}`. The endpoint is whitelisted under every UI auth mode (LOGIN_FORM/OAUTH2/LDAP); DISABLED permits everything."
      - "Live `/configuration-and-deployment/odd-platform` (WebFetched 2026-05-27 status 200) confirms substrate's silent-on-signing-secret claim — page publishes Slack app manifest verbatim including `request_url`, `incoming-webhook` scope, `chat:write`, but is silent on `datacollaboration.slack-signing-secret`, HMAC validation, or `X-Slack-Signature` header."
    extends:
      - "F-098a (NEW): Slack at-least-once delivery has NO platform-side dedup. `message_provider_event` table at V0_0_59__data_collaboration.sql:25-39 has NO UNIQUE constraint on (provider, event_id) — verified verbatim. `ReactiveMessageRepositoryImpl.createMessageEvent` at lines 136-155 issues `DSL.insertInto(MESSAGE_PROVIDER_EVENT).set(record)` with NO `.onConflict(...)` clause — verified verbatim. Duplicate Slack retries (Slack's at-least-once delivery semantic) insert duplicate rows; downstream materialiser surfaces N child `message` rows for one logical event."
      - "F-098b (NEW): Slack `incoming-webhook` bot scope is requested in the published manifest but is UNUSED by the code (per substrate F-098 + EventApiController sidecar doc_drift_findings[1]). Operators following the docs grant a privilege the platform doesn't exercise. The fix is a manifest-edit in the docs only."
    severity_adjustment: unchanged (parent DOC-GAP-290 already HIGH; scan adds at-least-once dedup MEDIUM + manifest-scope-unused LOW)
    dedup_action: corroborate_and_extend
    proposed_doc_action: |-
      DOC-GAP-290's doc-side fix (signing-secret documentation + HMAC verification description) should be expanded to
      cover three orthogonal Slack-events surface dimensions:
      (a) signing-secret HMAC verification (original DOC-GAP-290 scope — Slack Events API receivers MUST verify
          `X-Slack-Signature` HMAC-SHA256 over `v0:{X-Slack-Request-Timestamp}:{raw body}` using the app's signing
          secret; the implementation does NONE of this);
      (b) at-least-once delivery dedup (F-098a — UNIQUE(provider, event_id) on `message_provider_event` OR
          `ON CONFLICT DO NOTHING` on the createMessageEvent INSERT);
      (c) manifest-scope cleanup (F-098b — drop `incoming-webhook` from the published manifest in the live docs).

      The three are independent fixes; (a) is the load-bearing security item; (b) is the operator-visible duplicate-
      message bug; (c) is the cosmetic-but-trust-impacting privilege-overgrant.
