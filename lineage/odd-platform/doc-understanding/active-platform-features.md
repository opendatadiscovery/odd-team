---
doc_page: "docs/active-platform-features.md"
page_title: "Active platform features"
live_url: "https://docs.opendatadiscovery.org/features/active-platform-features"
live_url_verified_status: "200"
live_url_resolved_slug: "features/active-platform-features"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Activity Feed"
    - "Notifications"
    - "GenAI Assistant"
    - "Metrics Ingestion"
    - "Slack collaboration app"
    - "Alerts page root (three-tab shell with shared Redux slot)"
  features:
    - "F-007"
    - "F-009"
    - "F-014"
    - "F-021"
    - "F-030"
    - "F-038"
    - "F-039"
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Alerting bullet claims the Alerts section shows 'Open and resolved alerts' across 'All / My Objects / Dependents' tabs; the All-tab SQL filters STATUS=OPEN only, so resolved alerts never appear on the All tab — name-vs-implementation drift (Category B). Evidence: invariant:alerts-all-tab-name-vs-implementation-drift-open-only; per-entity read F-014 (DataEntityController.java:315-321) does return open+resolved, so the drift is tab-scoped to the global Alerts page, not the per-entity Alerts tab."
  - "The page names `odd.activity.partition-period` as the Activity-Feed platform config and links the activity-feed sub-page; that sub-page (live features/active-platform-features/activity-feed#configuration) claims the setting controls 'retention and partitioning'. Code: it controls partition WIDTH only — ActivityTablePartitionManager calls only createPartitionsIfNotExists, no DROP/retention path; public.activity grows monotonically (LSN-001 silent-data-growth class). Confirmed from a second angle: HousekeepingTTLProperties.java:8-12 has exactly three TTL fields and none targets the activity table. Evidence: node ActivityTablePartitionManager config-key-consumer:odd.activity.partition-period@L11; HousekeepingTTLProperties. The hub itself makes no retention claim — this is drift on the sub-page it points to."
  - "GitBook IA drift on two of the six sub-feature slugs: live /active-platform-features/notifications and /active-platform-features/data-collaboration return 404; the canonical live paths are /features/active-platform-features/notifications and .../data-collaboration (200). The hub's repo-relative `.md` sub-section links resolve correctly under /features/, but the bare /active-platform-features/* slug (which operators reach via search) is dead. Evidence: concepts.yaml Notifications vocabulary_status + postMessageInSlack.md doc_drift_findings[2] (HIGH for doc-drift)."
maintainer_curated: false
---

# Active platform features — doc understanding

This is the section-landing (hub) page for ODD Platform's six opt-in,
event-driven subsystems — the features where the platform is itself an actor.
It is a router page: it has no implementing code of its own, instead delegating
to six sub-pages. Each subsystem is confirmed in the ontology via graph-node and
bound here at the feature level, with a concept anchor per subsystem:
**Alerting** → F-014 (per-entity alert read backing the Alerts tab,
`DataEntityController.java:315-321`) + F-007 (AlertManager inbound anomaly
webhook) + concept `Alerts page root (three-tab shell with shared Redux slot)`;
**Notifications** → F-009 (WAL-driven outbound Slack/webhook/email fan-out) +
concept `Notifications`; **Activity Feed** → F-021 + concept `Activity Feed`;
**Data Collaboration** → F-038 (Slack-integrated Discussions) + concept
`Slack collaboration app`; **GenAI assistant** → F-039 (thin proxy to an
operator-run external LLM, API-only) + concept `GenAI Assistant`;
**Metrics Ingestion** → F-030 (`POST /ingestion/metrics`, INTERNAL_POSTGRES
default / PROMETHEUS) + concept `Metrics Ingestion`.

The page is accurate at the pillar/framing level (event-driven, side-effecting,
opt-in-per-subsystem — each gated by its own `*.enabled` flag). The drift it
inherits is at the subsystem level and lives on the sub-pages it routes to: the
global Alerts All-tab "open and resolved" claim is open-only in SQL; the
activity-feed `partition-period` "retention" claim is partition-width-only
(monotonic growth, LSN-001 class); and two sub-feature slugs 404 under the bare
`/active-platform-features/*` path (canonical is `/features/active-platform-features/*`).
`code_nodes` is intentionally empty — a hub page documents no single code unit;
its bindings are the six sub-feature flows.

## Maintainer notes
- `Alerts page root (three-tab shell with shared Redux slot)` is a confirmed
  graph node (`concepts/detail/entities/alerts-page-root-three-tab-shell.yaml`,
  batch ZL 2026-05-26) but is NOT yet rolled up into `concepts.yaml` (catalog
  v8, 2026-05-13). Bound here by its confirmed node title; re-confirm the
  canonical name on the next concept-merger refresh.
- No dedicated top-level "Alerting" or "Data Collaboration" concept exists in
  concepts.yaml; those two subsystems are anchored via `Alerts page root` and
  `Slack collaboration app` respectively, plus their feature flows. Not padded.
