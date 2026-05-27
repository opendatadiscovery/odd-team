# SHB-055 — Ingestion-supplied alert descriptions can broadcast-notify the entire Slack workspace via @channel injection

**Category**: open
**Severity**: HIGH

## Hypothesis

`AlertChunkPojo.description` strings — populated from upstream collectors (dbt test names, Great Expectations expectation results, schema-diff narratives) — flow into the Slack outbound payload via `SlackMessageGenerator.buildDescriptionsFromChunks` as `markdownText(...)`. Slack interprets `@channel`, `@here`, `<!channel>`, `<!here>`, `<https://attacker.example/|click here>`, `*bold*`, `_italic_` as live markup. The platform performs NO escaping (`MrkdwnUtils.java` has only `bold(...)` and `buildLink(...)` helpers for platform-controlled strings — no `escape(...)` for untrusted strings). An ingestion-side actor with control over alert descriptions (any collector that emits a `DataQualityTestRun` with a custom-text description, any operator who registers a metadata source whose alerts include free-text fields) can broadcast-notify the entire Slack workspace's channel-membership at every alert firing — bypassing on-call rotation contracts AND social norms.

## Evidence

- `odd-platform-api/src/main/java/.../notification/processor/message/SlackMessageGenerator.java:77` — `markdownText(...)` call with the chunk description string passed verbatim. Per SlackMessageGenerator sidecar lines 95-101 (referenced in SlackNotificationSender sidecar), `buildDescriptionsFromChunks` renders the latest 3 chunks sorted by created_at DESC.
- `odd-platform-api/src/main/java/.../notification/processor/message/MrkdwnUtils.java:1-14` — utility class with `bold(...)` + `buildLink(...)` ONLY. No `escape(...)` helper exists; no Slack-mrkdwn-aware sanitisation anywhere in the package.
- `AlertActionResolverImpl.java:162` (referenced in SlackNotificationSender sidecar `bugs_limitations_corner_cases.[2]`) — ingestion-side population of `.description`; ODD's ingestion path accepts arbitrary descriptions per the upstream collector contract (no length cap, no charset restriction).
- `AlertController.changeAlertStatus` sidecar `security.known_security_gaps.[0]` (HIGH) — no RBAC permission for alert mutations means even the resolution-comment audit trail (if it adopts a similar pattern) is exposed.
- Live notifications doc (verified 2026-05-20) is SILENT on mrkdwn injection — operators cannot infer the risk from the docs.
- `SlackNotificationSender.java:43-48` — outbound POST with no Content-Type, no signing, no payload validation. Slack accepts whatever JSON arrives.
- `SlackNotificationSender` sidecar `known_security_gaps.[0]` HIGH severity flags this; SlackNotificationSender sidecar `doc_drift_findings.[3]` records the silent doc-coverage.

## Notes

- This is a P-09 (Security) cross-cut with the P-07 alerting/notifications surface. The interesting feature here is "alert content trust model" — what classes of input does the alerting pipeline trust, and at which boundary is trust established? Today the answer is "trust everything from collectors and surface verbatim across all channels"; the user-observable consequence (e.g. a DQ-test failure on a customer table broadcasting `@channel` to the entire on-call slack room when the table description contains the injection) is not framed as a feature.
- The same risk class extends to webhook (operator's receiver gets verbatim JSON; if rendered in any downstream HTML view, XSS) and email (Freemarker `.ftlh` auto-escape ON mitigates HTML injection in email today per `EmailNotificationSender` sidecar `bugs_limitations_corner_cases.[9]`; LATENT — a refactor to `.ftl` extension or a configuration change breaks the only line of defense).
- Concept candidate: "alert payload trust boundary" — a feature whose canonical home is `concepts.yaml` and which spans Slack mrkdwn + Webhook JSON-injection + Email HTML-injection.
- Combined with the F-007 (AlertManager external integration) ungated cross-tenant-alert-creation surface: an unauthenticated AlertManager POST with `summary: "@channel <attacker payload>"` (verbatim into `chunk.description` per `AlertServiceImpl.handleExternalAlerts` lines 168-185) reaches the workspace's channel-membership through the ODD platform's Slack identity — with NO operator-side identity check or audit trail.
- This is "open" not "clustering" because while the evidence is mature on the Slack side, the cross-channel scope (email/webhook XSS) is not fully read yet.

## Next

1. **Probe**: POST an AlertManager webhook payload with `summary: "@channel test injection"` via the unauthenticated `/ingestion/alert/alertmanager` endpoint. Observe whether the Slack workspace receives an @channel broadcast.
2. **Graduate** as F-NNN "Alert payload trust boundary — outbound channel injection surface". Pillar P-09 (Security & Access Control) primary, P-07 secondary. Cross-cuts Slack mrkdwn, Webhook JSON, Email HTML-via-Freemarker.
3. **SEC-NNN** — implement `MrkdwnUtils.escape(...)` (replace `*`, `_`, `~`, `<`, `>`, `@`, `&` with Slack-escape sequences); apply at `SlackMessageGenerator.java:77` before passing to `markdownText(...)`. Severity HIGH.
4. **SEC-NNN** — add a content-classifier check at `AlertServiceImpl.handleExternalAlerts` that flags `@channel` / `@here` / URL injection patterns and either rejects (high-trust mode) or quarantines (default).
5. **DOC-NNN** — surface the trust boundary in `features/active-platform-features/notifications` AND warn operators against pointing AlertManager at the unauthenticated webhook from a network the workspace's notification recipients don't already trust.

## Links

- cluster_with: [F-007, F-009, SHB-053, SHB-054]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — into F-009 WAL-driven Notification Delivery. F-009 batch Y facet 11 (`slack_mrkdwn_injection_via_alert_chunk_description_at_channel_at_here_broadcast`) is the load-bearing primary-source for SHB-055's hypothesis at SlackMessageGenerator.java:77 + MrkdwnUtils.java:1-14 + AlertActionResolverImpl.java:162. The cross-feature compound with F-007 (forge-and-display) is already captured via F-007 batch Y note 1 + F-009 batch Y note 1 + the F-007 → F-009 → F-004 probe-intersection (F-009 batch Y P-W-3). The Slack mrkdwn-injection is also enumerated as F-004's 6th XSS surface in F-004 batch Y. Thread marked merged. F-009: WAL-driven outbound alert notification fan-out — drift_class facets already cover the full SHB-055 hypothesis.
