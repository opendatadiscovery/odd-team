---
doc_page: "docs/developer-guides/api-reference/alerts.md"
page_title: "Alerts"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/alerts"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Alert"]
  features: ["F-007", "F-014"]
  code_nodes:
    - "odd-platform java AlertController controller-method:getAllAlerts"
    - "odd-platform java AlertController controller-method:getAssociatedUserAlerts"
    - "odd-platform java AlertController controller-method:getDependentEntitiesAlerts"
    - "odd-platform java AlertController controller-method:getAlertTotals"
    - "odd-platform java AlertController controller-method:changeAlertStatus"
    - "odd-platform java DataEntityController controller-method:getDataEntityAlerts"
    - "odd-platform java DataEntityController controller-method:getDataEntityAlertsCounts"
    - "odd-platform java DataEntityController controller-method:getAlertConfig"
    - "odd-platform java DataEntityController controller-method:updateAlertConfig"
    - "odd-platform java AlertManagerController controller-method:alertManagerWebhook"
audience: [developer, operator]
doc_claim_vs_code:
  - "Page calls the global listings 'Paginated list of every alert across the whole platform' (getAllAlerts) and 'list of alerts on data entities where the signed-in user is a registered owner' (getAssociatedUserAlerts) / downstream (getDependentEntitiesAlerts) with NO open-only qualifier — but all three backend queries hard-filter STATUS = OPEN at the SQL layer, so RESOLVED + RESOLVED_AUTOMATICALLY alerts are never returned on any of the three global tabs. The API-reference rows reproduce the same Category-B drift already tracked against the feature page. Evidence: concept invariant:alerts-all-tab-name-vs-implementation-drift-open-only (ReactiveAlertRepositoryImpl.java:145 listAllWithStatusOpen, :166 listByOwner, :230 listDependentObjectsAlerts — the ALERT.STATUS.eq(OPEN.getCode()) predicate is present in all three) + node odd-platform java AlertController controller-method:getAllAlerts understanding (AlertServiceImpl.java:77-80 → ReactiveAlertRepositoryImpl.java:142-157, single WHERE STATUS = OPEN). Severity HIGH."
  - "Page states the distribution_anomaly_halt_until field is 'Currently unenforced — persisted by the API but ignored by the AlertManager-driven creation path.' This caveat is the page's own self-disclosure and is operator-critical, but it is NOT independently confirmable from the substrate: the AlertManager creation path (AlertServiceImpl.handleExternalAlerts → createAlerts, surfaced via F-007) and the halt-config save/enforcement nodes (updateAlertConfig, AlertHaltConfigServiceImpl) are descriptor-only stubs — graph-search for the halt-enforcement code returned no enriched node. Flag for substrate enrichment so the unenforced-halt claim can be code-verified rather than trusted on the page's word. Evidence-absent: node odd-platform java DataEntityController controller-method:updateAlertConfig (enrichment_status: none, descriptor only) + no enriched node for the distribution-anomaly halt check on the creation path."
maintainer_curated: false
---

# Alerts — doc understanding

This API-reference page documents the alert HTTP surface across three controllers and binds cleanly to the graph. Verified live at the guessed slug (status 200, no GitBook rewrite — the `developer-guides/` prefix is preserved here, unlike the `active-platform-features/*` pages that are served under `/features/...`); all six sections and the `#see-also` anchor resolve.

The five global/per-entity *listing* rows plus the totals/counts rows map to `AlertController` (`getAllAlerts`, `getAssociatedUserAlerts`, `getDependentEntitiesAlerts`, `getAlertTotals`) and `DataEntityController` (`getDataEntityAlerts`, `getDataEntityAlertsCounts`); the halt-config rows map to `DataEntityController.getAlertConfig` / `updateAlertConfig`; the status-mutation row maps to `AlertController.changeAlertStatus`; the inbound webhook row maps to `AlertManagerController.alertManagerWebhook`. The page's central concept is **Alert** (`concepts.yaml`).

Confirmed-accurate claims (code-cited): the manual-reopen guard returning `400` with the verbatim message is enforced in `AlertServiceImpl.updateStatus` at `AlertServiceImpl.java:124-131` (matches the page's exact cite), the activity-feed `ALERT_STATUS_UPDATED` emission is the `@ActivityLog` AOP on the service method (`AlertServiceImpl.java:112`), and the three-value `AlertStatus` enum is closed (`AlertStatus.java:24-30`) — all from the enriched `changeAlertStatus` node. The AlertManager webhook auth caveat ("not behind the platform's ingestion auth filter", path fixed at `AlertManagerController.java:21`) is confirmed by **F-007**: `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only, so the webhook inherits only the global `.authenticated()` gate (bypassed under `auth.type=DISABLED`) — the page's caveat is correct.

Two drift findings are recorded above. The first is HIGH-severity and code-backed: the global-listing row descriptions omit the open-only filter that all three list queries hard-enforce. The second is the page's own unenforced-halt self-disclosure, which the substrate cannot yet corroborate (the enforcement path is an unenriched stub) — logged as an enrichment gap rather than a confirmed contradiction. Note also that the page's "every alert" per-entity row (`getDataEntityAlerts`) is the doc-recommended audit-export workaround for the resolved-alert housekeeping deletion bug (per **F-014**) — that per-entity read genuinely returns open + resolved history (no STATUS filter on that path), so the open-only drift is specific to the three *global* tabs, not the per-entity listing.

## Maintainer notes
