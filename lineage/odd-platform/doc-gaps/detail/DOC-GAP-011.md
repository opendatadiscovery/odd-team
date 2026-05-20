- **DOC-GAP-011**: Legacy URL `/active-platform-features/alerting` returns 404 — canonical at `/features/active-platform-features/alerting`
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:docs_link_semantic.inferred_docs.[1]` (status: 404 at enrichment time)
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:docs_link_semantic.doc_drift_findings.[0]`
    - `odd-platform__ts__routes__route__alerts.md:docs_link_semantic.doc_drift_findings.[1]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/active-platform-features/alerting` 2026-05-08 status 404 — H1 "Page Not Found"; suggests canonical.
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-08 status 200.
  - **Proposed doc action**: Cross-link audit; update to `/features/active-platform-features/alerting`. See DOC-GAP-058 (class-level meta).
  - **Cross-references**: DOC-GAP-012, DOC-GAP-013, DOC-GAP-014, DOC-GAP-015, DOC-GAP-035, DOC-GAP-056, DOC-GAP-058 (same URL-prefix-drift class).
  - **Severity rationale**: MEDIUM.

#### Batch 2026-05-20-P COHERENCE-CORRECTION + STRENGTHENS — canonical page content materially improved; legacy URL still 404 (broken-url finding stands)

- Per batch-P **AlertManagerController.postAlerts** sidecar's coherence sweep (per LSN-018 protocol): the prior class-level AlertManagerController sidecar (batch A, 2026-05-08) recorded `doc_drift_findings.[0]` as the broken-URL claim that the alerting feature page returned 404. The batch-P sidecar's WebFetch refresh 2026-05-20 confirms:
  - **The CANONICAL URL `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` REMAINS at status 200** (as recorded in DOC-GAP-011's original Evidence block — the canonical URL was 200 throughout). The canonical URL's content has been **MATERIALLY STRENGTHENED** since 2026-05-08:
    - Page NOW cross-links to the AlertManager webhook endpoint with verbatim text: *"optionally from an external Prometheus AlertManager via the `POST /ingestion/alert/alertmanager` inbound webhook"*.
    - Page NOW documents the halt-toggle limitation verbatim: *"the Distribution Anomaly halt toggle doesn't enforce suppression on AlertManager-driven alerts, recommending operators use Prometheus Alertmanager configuration layers instead to manage alert noise"*.
    - Page NOW explicitly names the workaround for the housekeeping bug: *"GET /api/dataentities/{data_entity_id}/alerts returns the open and recently-resolved set including chunks and status history. Persist the response somewhere durable (object store, log pipeline, ticketing system) if the audit trail matters for compliance or postmortems."*. (Surfaced separately in DOC-GAP-157 batch L.)
  - **The LEGACY URL `https://docs.opendatadiscovery.org/active-platform-features/alerting` STILL returns 404** (re-verified this session 2026-05-20: "The URL `active-platform-features/alerting` does not exist. This page may have been moved, renamed, or deleted."). NO GitBook redirect rule has been added.
- **Coherence-correction note**: the prior class-level AlertManagerController sidecar's drift-finding wording ("The Alerting feature page at `https://docs.opendatadiscovery.org/active-platform-features/alerting` returns 404") conflated TWO URLs — the (legacy, 404) and the (canonical, 200) paths. The batch-P sidecar correctly separates them; DOC-GAP-011's framing (legacy 404, canonical 200, recommend redirect) has been correct throughout. The supersede applies to the AlertManagerController class-level sidecar's wording, not to this DOC-GAP.
- **The broken-URL finding STANDS**: the legacy URL still 404s, the GitBook redirect rule recommended in DOC-GAP-058 META (point 2) is still un-applied for the alerting slug. Maintainer action remains the same — add the redirect rule per DOC-GAP-058's recommended set.
- **STRENGTHENS DOC-GAP-003**: the AlertManager Webhook Receiver caveats finding gains a 3rd-tier of evidence (controller-method sidecar batch P) confirming all four drift facets at primary source (see DOC-GAP-003 batch P append).
- This entry is a coherence-correction note triggered by LSN-018's pre-emit cross-registry sweep; it does NOT mark DOC-GAP-011 as SUPERSEDED. The finding remains MEDIUM-severity broken-url; the underlying legacy-URL 404 is operationally present and the doc-side action (GitBook redirect via DOC-GAP-058) remains outstanding.
