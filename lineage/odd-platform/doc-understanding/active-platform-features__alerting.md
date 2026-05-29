---
doc_page: "docs/active-platform-features/alerting.md"
page_title: "Alerting"
live_url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
live_url_verified_status: "200"
live_url_resolved_slug: "features/active-platform-features/alerting"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Alert"
    - "List Alerts (three visibility scopes)"
    - "Change Alert Status"
    - "Receive AlertManager Webhook"
    - "AlertManager Webhook Receiver"
    - "Housekeeping TTL retention"
    - "Prometheus AlertManager"
    - "Notifications"
  features:
    - "F-007"
    - "F-126"
    - "F-014"
    - "F-064"
    - "F-198"
    - "F-010"
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:AlertController"
    - "odd-platform java AlertController controller-method:getAllAlerts"
    - "odd-platform java AlertController controller-method:getAssociatedUserAlerts"
    - "odd-platform java AlertController controller-method:getDependentEntitiesAlerts"
    - "odd-platform java AlertController controller-method:getAlertTotals"
    - "odd-platform java AlertController controller-method:changeAlertStatus"
    - "odd-platform java AlertManagerController controller-method:alertManagerWebhook"
    - "odd-platform ts routes route:alerts"
audience: [operator, developer]
doc_claim_vs_code:
  - "DRIFT (Category B, HIGH, code-confirmed, NOT yet fixed on the page) — the Alert-views table (alerting.md L60) claims `All — Every open and resolved alert across the whole platform`, and the Known-UX-limitations bullet (L191) repeats `the cross-owner feed that lists every team's open and resolved alerts`. The All-tab backend filters STATUS=OPEN only: `ReactiveAlertRepositoryImpl.listAllWithStatusOpen` builds `WHERE alert.STATUS = OPEN.getCode()` — resolved/auto-resolved alerts NEVER surface on any global tab. The page's own lifecycle section (L82) tells the reader the RESOLVED/RESOLVED_AUTOMATICALLY distinction is `preserved in the listings`, reinforcing a false expectation that resolved rows are visible in the All list. Evidence: invariant:alerts-all-tab-name-vs-implementation-drift-open-only (ReactiveAlertRepositoryImpl.java:142-148; UI label components/Alerts/AlertsTabs.tsx:22). DOC-GAP candidate: correct the All / My Objects / Dependents scope copy to 'open alerts only' (the global lists are an open-work-queue surface; resolved history is reachable only via the per-entity GET /api/dataentities/{id}/alerts endpoint)."
  - "COVERAGE GAP (Rule 2 signal, not page drift) — the Backwards-incompatible schema change detection logic the page documents in detail (L128-144: the three Dataset/Transformer/Consumer removal-detection paths, the `(oddrn, type)` field comparison, `Missing field/source/target/input` messages, the first-ingest-never-fires rule) has NO confirmed code node or concept in the substrate yet (graph-search CodeNode + Concept for schema-change detection / DatasetStructureDelta / AlertActionResolver returned no schema-comparison node). The detection pipeline (`AlertActionResolver` + the dataset-version comparator) is un-enriched; this page's most algorithm-specific claims cannot currently be traced to enforcing code. Enrich the alert-action-resolver / schema-delta path so these claims are verifiable. Not recorded as drift (no contradicting code located); recorded as a pillar-undocumented coverage note for doc-gap triage."
  - "ALIGNED (code-confirmed; re-confirm each refresh) — the page's three AlertManager-webhook danger/warning hints match the substrate exactly: (a) `entity_oddrn` read verbatim with no existence/ownership/shape check → AlertServiceImpl.handleExternalAlerts:178 setDataEntityOddrn direct assign + endpoint on the `/ingestion/**` unauthenticated whitelist (invariant:entity-oddrn-trust-from-alertmanager-webhook); (b) `generatorURL` string-formatted into the description `Distribution Anomaly. URL: %s` with no scheme allow-list → AlertServiceImpl.java:168-185, type hardcoded DISTRIBUTION_ANOMALY at :177 (operation:handle-external-alertmanager-webhook); (c) no idempotency on the webhook insert path — `handleExternalAlerts` skips the `AlertActionResolver`/`AlertUniqueConstraint` de-dup that `applyAlertActions` (AlertServiceImpl.java:200-231) uses for the in-platform path (invariant:alertservice-handle-external-alerts-skip-resolver-asymmetry, invariant:alertmanager-webhook-bypasses-alert-action-resolver-no-idempotency). The Distribution-anomaly-halt-unenforced warning (L177-185) is the same handler: the webhook path does not consult the halt config. No drift."
  - "ALIGNED (code-confirmed) — the manual-reopen guard (L96) quotes the exact server contract: `PUT /api/alerts/{alert_id}/status` → AlertServiceImpl.updateStatus:124-131 calls `openAlertWithTheSameTypeExistsForDataEntity` and throws `BadUserRequestException(\"Cannot reopen alert since the system already has an open alert of the same type\")`; server-enforced application logic, not a DB partial-unique constraint (operation:update-alert-status-with-reopen-guard, invariant:reopen-conflict-server-enforced-application-logic-not-db-constraint). The manual-resolve TTL warning (L106) matches the jOOQ operator-precedence bug at AlertHousekeepingJob.java:28-34 — `.where(STATUS.eq(RESOLVED)).or(STATUS.eq(RESOLVED_AUTOMATICALLY)).and(STATUS_UPDATED_AT.le(cutoff))` emits `(STATUS=RESOLVED) OR (STATUS=RESOLVED_AUTOMATICALLY AND ... )`, so every manual RESOLVED row is deleted regardless of TTL (invariant:joq-operator-precedence-bug-alert-housekeeping-primary-source). The Resolve-button-no-confirmation UX warning (L194-196) is the AlertItem.tsx:159-166 unconditional render + post-click permission probe (invariant:alerts-resolve-button-rendered-before-permission-check-ux-leak). No drift."
maintainer_curated: false
---

# Alerting — doc understanding

This page is the operator surface for the platform's per-entity alerting subsystem and a developer reference for its HTTP API. It documents the four alert types (failed job / failed DQ test / backwards-incompatible schema change / distribution anomaly), the three global list views (`List Alerts (three visibility scopes)` — feature **F-126**, `AlertController.getAllAlerts` / `getAssociatedUserAlerts` / `getDependentEntitiesAlerts` / `getAlertTotals`), the per-entity alert read used as the audit-export workaround (**F-014**, `GET /api/dataentities/{id}/alerts`), the `OPEN → RESOLVED → RESOLVED_AUTOMATICALLY` lifecycle with its server-enforced reopen guard (`Change Alert Status`, `AlertController.changeAlertStatus`), per-entity halt configuration (**F-198**, the `Alert` entity's halt-timestamp fields), the housekeeping TTL cleanup (`Housekeeping TTL retention`, **F-010**), and the unauthenticated Prometheus AlertManager inbound webhook (**F-007**, `Receive AlertManager Webhook` / `AlertManager Webhook Receiver`, `AlertManagerController.alertManagerWebhook`). The `My Objects`/`Dependents` user-owner-association prerequisite and silent-empty behaviour map to **F-064**. The UI lives at TS `route:alerts`. Audience is operator (the bulk of the page) + developer (the API-surface and webhook sections).

This page is unusually code-accurate: its three webhook security hints, the reopen guard, the jOOQ-precedence manual-resolve bug, and the no-confirmation Resolve UX leak are each confirmed against the substrate with `file:line` evidence (see `doc_claim_vs_code` ALIGNED entries), and the page already discloses the unauthenticated endpoint, the `entity_oddrn` no-check injection, the `generatorURL` XSS surface, and the distribution-anomaly-halt-bypass. One **code-confirmed drift remains unfixed**: the global **All** tab is described as carrying "open and resolved" alerts (L60, L191), but `ReactiveAlertRepositoryImpl.listAllWithStatusOpen` filters `STATUS = OPEN` only (ReactiveAlertRepositoryImpl.java:142-148) — resolved alerts never appear in any global list, and the lifecycle section's "preserved in the listings" framing (L82) compounds the false expectation. Separately, the page's most algorithm-specific section — the backwards-incompatible schema-change detection rules (L128-144) — has no enriched code node in the substrate yet, so those claims cannot currently be traced to enforcing code (a coverage gap, not drift). Both are logged above for doc-gap triage.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
