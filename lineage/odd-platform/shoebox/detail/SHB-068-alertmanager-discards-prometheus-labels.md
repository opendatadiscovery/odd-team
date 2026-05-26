# SHB-068 — AlertManager webhook discards severity / alertname / generator labels — every external alert is the same DISTRIBUTION_ANOMALY type with no operator-side discrimination

**Category**: open
**Severity**: MEDIUM

## Hypothesis

ODD's `POST /ingestion/alert/alertmanager` endpoint accepts Prometheus AlertManager webhook payloads — the standard format with `labels: {alertname, severity, instance, ...}`, `annotations: {summary, description, ...}`, `generatorURL`, and `startsAt` per alert. The platform's `handleExternalAlerts` HARDCODES every incoming alert as `AlertTypeEnum.DISTRIBUTION_ANOMALY` regardless of the actual `alertname` or `severity` label values. The `generatorURL` is preserved into the chunk description; `entity_oddrn` is the only label honoured (lookup key). EVERY other label is silently discarded. Operators configuring Prometheus AlertManager with rich `severity`/`alertname`/`runbook_url` annotations see ZERO of that detail in ODD's UI — alerts appear as undifferentiated DISTRIBUTION_ANOMALY rows on the All tab. Combined with the four-element AlertTypeEnum (`DISTRIBUTION_ANOMALY / FAILED_DQ_TEST / FAILED_JOB / BACKWARDS_INCOMPATIBLE_SCHEMA`), the external-integration path uses ONLY ONE of the four available types, regardless of what AlertManager rules the operator authors.

## Evidence

- `odd-platform-api/src/main/java/.../service/AlertServiceImpl.java:177` — `alertPojo.setType(AlertTypeEnum.DISTRIBUTION_ANOMALY.getCode())` — hardcoded; no label-based dispatch.
- `AlertServiceImpl.java:178` — `setDataEntityOddrn(externalAlert.getLabels().get("entity_oddrn"))` — ONLY label honoured.
- `AlertServiceImpl.java:168-185` — chunk description construction: `Distribution Anomaly. URL: %s` with the URL-encoded `generatorURL` + `g0.moment_input` + `g0.end_input` query params. The `annotations.summary` / `annotations.description` from the Prometheus payload are NOT read.
- `AlertServiceImpl` sidecar `invariants.[5]`: "AlertManager webhook path hardcodes type=DISTRIBUTION_ANOMALY. The AlertManager-side `alertname` / `severity` labels are ignored; every webhook payload becomes the same type regardless of provider configuration."
- AlertServiceImpl sidecar `tests_coverage_semantic.uncovered_behaviours` — multiple AlertManager-webhook-related test gaps including "orphaning behaviour" (`entity_oddrn` missing → AlertPojo with `dataEntityOddrn=null`, persisted but invisible).
- Live notifications doc (`features/active-platform-features/notifications`, verified 2026-05-20) per AlertServiceImpl `docs_link_semantic.fetched_excerpts`: "an externally-injected distribution anomaly — the platform raises an alert" — the doc framing reinforces "distribution anomaly" as the canonical AlertManager-derived alert shape, but does NOT warn that operator-configured AlertManager metadata is discarded.
- Cross-link F-007 — the `unauthenticated_payload_trust` + `cross_tenant_alert_creation` + `no_idempotency_no_audit` cluster already covers the SECURITY shape; this thread surfaces the SEMANTIC drift (operator-configured labels lost).

## Notes

- This is an ENRICHER for **F-007 (AlertManager Integration)**. F-007 covers the cross-tenant + unauthenticated + idempotency drift; this thread surfaces a separate facet — operator-visible metadata loss.
- The compound with mrkdwn injection (SHB-055): although the `annotations.summary` is discarded TODAY (mitigating injection risk via the integration's NEGLECT), if a future refactor passes the summary into the chunk description for richer UX (which operators reasonably expect), the injection vector lights up cross-channel.
- The operator-side impact is "Prometheus AlertManager integration is significantly less useful than the docs suggest":
  - Authoring AlertManager rules: operators write `alertname: HighLatency` + `severity: critical` and expect ODD's UI to reflect that. They don't.
  - On-call rotation: operators expect severity-based routing in Slack. With SHB-064 (no per-channel filter) AND SHB-068 (no severity field on the alert), severity routing is impossible at TWO compounding layers.
  - Runbook integration: AlertManager's `annotations.runbook_url` could be a clickable link in ODD's alert detail. It's not.
- The fix is straightforward but surface-changing:
  - Map `labels.severity` → a new `AlertPojo.severity` enum field. (Schema change.)
  - Map `labels.alertname` → the chunk description's first line, replacing the hardcoded "Distribution Anomaly" prefix.
  - Map `annotations.summary` → the chunk description body. Apply mrkdwn / HTML escape at output channels.
  - Map `annotations.runbook_url` → a new `AlertPojo.runbook_url` field, surfaced as a UI button.
- Compound with the SHB-064 routing gap: severity field + per-channel filter = the operator-expected routing primitive.
- The AlertTypeEnum's four values may also be insufficient — Prometheus AlertManager's `alertname` is open-ended; mapping to a closed enum is itself a contract. A possible fix is `AlertTypeEnum.EXTERNAL` + `AlertPojo.external_alertname` text field.

## Next

1. **Probe**: configure a Prometheus AlertManager firing an alert with `alertname: HighLatency, severity: critical, annotations.summary: "API p99 > 1s", annotations.runbook_url: "https://...”`; observe what reaches ODD's UI.
2. **Graduate** as a load-bearing facet of F-007 — extends from "cross-tenant + unauthenticated" to also "metadata-lossy semantically."
3. **REFACTOR-NNN MEDIUM** — schema migration adding `alert.severity` (enum) + `alert.external_alertname` (text) + `alert.runbook_url` (text); populate from AlertManager labels/annotations.
4. **REFACTOR-NNN MEDIUM** — UI changes to render severity as a colored badge + runbook URL as a button on the alert detail page.
5. **DOC-NNN MEDIUM** — `features/active-platform-features/notifications` should explicitly enumerate the AlertManager fields ODD reads vs discards, with a "configure your AlertManager labels accordingly" admonition.

## Links

- cluster_with: [F-007, SHB-055, SHB-064]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merge — into F-007 AlertManager Integration. F-007 batch P secondary facets already enumerate "DTO silently drops AlertManager wire fields (`status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`, `groupLabels`, `commonLabels`, `commonAnnotations`, `externalURL`, `version`, `receiver` are all silently dropped — most operationally impactful drop is `status: resolved`)" — this captures the structural pattern of label/annotation discard at the controller-method tier. The SHB-068 thread refines this with the SEMANTIC consequence (every external alert becomes hardcoded DISTRIBUTION_ANOMALY regardless of operator-configured `alertname`/`severity`) anchored at AlertServiceImpl.java:177 (hardcoded type) + line 178 (only entity_oddrn read). Appending a new drift_class on F-007 — `alertmanager_labels_annotations_discarded_every_external_alert_hardcoded_distribution_anomaly_operator_metadata_loss` — captures the missing semantic facet. The compound with SHB-064 (no per-channel routing) at TWO compounding layers (no severity field + no routing primitive) IS the load-bearing operator-experience finding; recorded as a cross-feature note linking to F-009's `unconditional_broadcast_no_routing` facet. Thread marked merged. F-007: AlertManager webhook ingestion — adding drift_class `alertmanager_labels_annotations_discarded_every_external_alert_hardcoded_distribution_anomaly_operator_metadata_loss`.
