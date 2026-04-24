# Progress Dashboard

Last updated: 2026-04-24 — **odd-platform.md config amendment batch (DOC-064 + DOC-065) flipped `pending` → `review-ready` on `feature/docs-odd-platform-config-amendments`** (documentation). Two commits, Gate-9 `Sources:` footer on each. **DOC-065** (critical) replaces the AlertManager `### Authentication` paragraph at `odd-platform.md:555-569` with a DANGER admonition naming the actual posture (`/ingestion/**` whitelisted, `auth.ingestion.filter.enabled` scope is `/ingestion/entities` only, `X-API-Key` not Bearer) plus three concrete perimeter-control options (network segmentation + NetworkPolicy, authenticating reverse proxy nginx `auth_request` / Envoy `ext_authz`, mTLS termination) and a cross-link to the broader ingestion-auth model. **DOC-064** (high) reframes `odd-platform.md:216-230` from a reads-only description of `metrics.storage` to a storage-tier framing (both writes and reads); adds a second warning admonition naming the operator traps — Prometheus server must run with `--web.enable-remote-write-receiver` (off by default in v2.33+; silent data loss otherwise because the ingestion API returns 200 before the downstream remote-write 404s), the same host must serve `/api/v1/write` AND `/api/v1/query`, and read-only Prometheus-compatible backends (Thanos querier, Mimir query-only mode) do not work. **PLT-002 draft correction shipped in the DOC-065 state commit** — lines 56 + 66 previously carried the same incorrect `"inherits the ingestion auth filter"` claim; both now accurately describe the current unauthenticated posture and name PLT-003 as the prerequisite before the spec claims API-key protection. Earlier on 2026-04-24 (pre-amendment), the **odd-platform.md config batch `/review` (separate session)**: DOC-009 / DOC-010 / DOC-011 ACCEPTED → `done`; DOC-007 REJECTED → `blocked` (Gate 6 missed Prometheus remote-write write path on `metrics.storage=PROMETHEUS`; DOC-064 unblocks); DOC-019 REJECTED → `blocked` (Gate 4 + Gate 9 on incorrect auth claim; DOC-065 unblocks). Two follow-up items logged on disk: **DOC-064** (now review-ready) and **DOC-065** (now review-ready). One new upstream issue drafted: **PLT-003** (bug, high — ingestion auth filter coverage gap; `/ingestion/alert/alertmanager` is unauthenticated regardless of `auth.ingestion.filter.enabled`). Pre-review context: on 2026-04-24 the same batch flipped `pending` → `review-ready` on `feature/docs-odd-platform-config` (documentation). Five commits, one per item, Gate-9 `Sources:` footer on each. Four in-scope caveat admonitions shipped in the authored content (housekeeping `housekeeping.enabled=false` → unbounded growth; session `spring.session.timeout=-1` → never-expire; `spring.codec.max-in-memory-size` vs `attachment.max-file-size` → `DataBufferLimitException` trap; AlertManager `entity_oddrn` label → orphaned alerts without it). Earlier on 2026-04-24, **Enable-security batch (DOC-037 + DOC-061) flipped `review-ready` → `done`** after a separate-session `/review` pass on `feature/docs-enable-security-fixes` (documentation, merged to main as PR #25 → commit `db15b72`). Both items ACCEPTED. Gate-by-gate evidence appended to each backlog file with citations across Spec, Repo, Handler, Config, Config-consumer SoT classes; outbound-URL sweep ran clean; live-site WebFetch on both pages confirmed the authored content renders with no `github.com/opendatadiscovery/documentation/blob/` fallback substring. Earlier on 2026-04-24, **DOC-027, DOC-028, DOC-063 all flipped `review-ready` → `done`** after a separate-session `/review` pass on the content-accuracy + canonical-vocabulary batches. PR #23 (DOC-027 + DOC-028) and PR #24 (DOC-063) landed in `documentation` main; GitBook rebuilt; Gate 8 live-site verification PASSed on all three. Per-item verdicts appended to the backlog files with cited evidence per Quality Bar gate and Gate 9 SoT class. **Effect: zero critical-priority items remain — the backlog is now high/medium-driven.**

**Content-accuracy batch status (DOC-027 + DOC-028)** — `/review` (separate session) assessed both on 2026-04-23: **Gates 1–7 PASS on both**, **Gate 8 DEFERRED on both** because `feature/docs-accuracy-features-fixes` on `documentation` is 3 commits ahead of `origin/main` (PR not merged yet; live `WebFetch` of `docs.opendatadiscovery.org/features` still renders the OLD Pandas claim + `{dataset_id}` placeholder). Per protocol, both items stay `review-ready` until merge + GitBook rebuild; re-run `/review DOC-027` and `/review DOC-028` afterward to close Gate 8 and flip to `done`. Per-item verdicts appended to the backlog files with cited evidence per gate.

**Post-review amendment to DOC-027 (2026-04-23)** — user spot-checked the DOC-027 edit and caught a wrong outbound repo link: `[dbt tests]` in both `Features.md:98` and `dq_visibility.md:7` pointed at `github.com/opendatadiscovery/odd-collectors` when the dbt integration actually lives in the separate `github.com/opendatadiscovery/odd-dbt` push-adapter repo. The initial `/review` had flagged the same link as "defensible (monorepo is canonical owner)" rather than verifying the target — a rationalization miss. Correction shipped as commit `d82559e docs: fix wrong dbt link target in DOC-027 edit [DOC-027]` on `feature/docs-accuracy-features-fixes` (now 3 commits ahead of `origin/main`), explicitly qualifying dbt and GE as push-adapters on both pages. Because DOC-027 content changed post-signoff, the re-run of `/review DOC-027` is the Gate 9 re-verification of the corrected URLs in addition to the deferred Gate 8.

That failure class motivated **pipeline hardening pass 2**, landed on `feature/pipeline-hardening-2` (merged as `384da25`). The retrospective named three contributors: memory-as-SoT (the dbt URL was authored from recall, no verification fetch), reviewer rationalization (verdict language like "defensible" / "probably correct" papering over un-run checks), and the pre-authoring duplication sweep only covering *existing* mentions of a term, not *new* URLs / terms / repos being introduced. The Implementation Quality Bar now has **nine gates** — Gate 9 (Factual Claim Provenance) enforces a Source-of-Truth citation per factual claim class (Repo, Integration, Config, Builder, Spec, Term, Lifecycle, Dep, Handler, Cross-repo), migrates the commit footer from `Consumer-read:` to `Sources:`, bans "defensible" / "probably" / "looks right" / "canonical owner" / "monorepo default" / "safe to assume" / "presumably" / "should be" as standalone rationalizations in review verdicts (every verdict row must end `VERIFIED via …` or `NOT VERIFIED → logging as DOC-NNN`), and adds an outbound-URL sweep to `/review`. New artifact: `navigation/architecture.md` — canonical integration-pattern + repo table **and** canonical vocabulary (adapter = mapper push or pull; collector = container of pull adapters; plugin = configured adapter instance; push adapter a.k.a. push-client = push-strategy adapter embedded in source runtime). New backlog item: DOC-062 (outbound URL audit across `docs/` + new `scanners/docs/quality/outbound-urls.md` scanner). DOC-042 (Integrations hub) amended to include Terms & Aliases rows for the canonical vocabulary as a Gate 9 prerequisite.

Pipeline-hardening-1 (commit `96b28c4` on `feature/pipeline-hardening`) remains the origin — it introduced gates 4 and 5 and the `review-ready` lifecycle after the DOC-008 MinIO region spot-check, and rewrote CLAUDE.md's "The project and the maintainer" attitude section. **Phase B** re-audit of DOC-005/006/008/018 under the pass-1 bar surfaced 4 missed caveats (2 in-scope amendments + 2 new backlog items DOC-059/060). `/review` signed off DOC-005/006/008/018 as ACCEPTED on 2026-04-23 after the amendment PR (`feature/doc-005-008-reaudit-caveats`, merged to `documentation` main as `eef330c`) landed and live-site verification passed on all four items. **Phase C** (re-audit of all 13 older self-closed done items under the pass-1 bar) executed as a single batch on 2026-04-23 — all 13 flipped to `review-ready`; two in-scope amendments shipped on `feature/phase-c-reaudit-amendments` (documentation, merged as `5d2639e`): DOC-013 "Known limitations" section (SSM pagination silent truncation at 10, no endpoint_url override, no botocore Config override, YAML safe_load aborts startup) and DOC-001 Azure admin-groups claim default (reads `roles`, not `groups`). **Phase C `/review` (separate session, 2026-04-23) ACCEPTED all 13 items** — independent re-verification of every consumer-read claim against current `odd-platform` and `odd-collectors` code, all 8 gates assessed per item (Gate 9 was not yet in force), 9 documentation pages WebFetched on `docs.opendatadiscovery.org` for Gate 8. One Gate-6 follow-up logged on disk: **DOC-061** (high) — Azure AD `logout-uri` is consumed by `AzureLogoutSuccessHandler.java:30-48` but never documented in the Azure section; logout NPEs without it.

## Audit Phase

| Scanner Category | Total Scanners | Completed | In Progress | Pending |
|-----------------|---------------|-----------|-------------|---------|
| docs/accuracy | 5 | 2 | 0 | 3 |
| docs/completeness | 2 | 0 | 0 | 2 |
| docs/coverage | 4 | 1 | 0 | 3 |
| docs/quality | 2 | 1 | 1 | 0 |
| tests | 7 | 0 | 0 | 7 |
| navigation | 3 | 0 | 0 | 3 |
| spec | 2 | 0 | 0 | 2 |
| adrs | 2 | 0 | 0 | 2 |
| **Total** | **27** | **4** | **1** | **22** |

## Backlog Phase

| Category | Pending | In Progress | Review-Ready | Done | Blocked | Rejected | Total |
|----------|---------|-------------|--------------|------|---------|----------|-------|
| DOC | 34 | 0 | 2 | 25 | 2 | 2 | 65 |
| TST | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| NAV | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SPC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **34** | **0** | **2** | **25** | **2** | **2** | **65** |

Notes on counts: DOC-005/006/008/018 flipped `review-ready` → `done` on 2026-04-23 after `/review` verified all eight Quality Bar gates in a session separate from the implementer. Per-item verdicts appended to each backlog file; the common thread across the four reviews is PASS on Gates 1–8 (Gate 8 confirmed via live-site fetch of `docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` — no GitHub fallback URLs, all in-scope admonitions rendered). Two follow-up items discovered by the re-audit (`DOC-059` session-provider caveats, `DOC-060` third `odd.platform-base-url` consumer) remain `pending` and are tracked for future triage.

On 2026-04-23 the Phase C `/review` pass (separate session) flipped all 13 review-ready items → `done`: DOC-001, 003, 013, 029, 035, 036, 052, 053, 054, 055, 056, 057, 058. Per-item verdicts appended to each backlog file with cited evidence per Quality Bar gate. One Gate-6 follow-up was logged on disk during the review: **DOC-061** (pending, high) — Azure AD `logout-uri` documentation gap (consumer: `AzureLogoutSuccessHandler.java:30-48`; NPE without it). Pending count rises 41 → 42 from this addition; review-ready 13 → 0; done 4 → 17; total 60 → 61.

On 2026-04-23 Phase C flipped 13 older self-closed done items to `review-ready`: DOC-001, 003, 013, 029, 035, 036, 052, 053, 054, 055, 056, 057, 058. Each carries a `## Re-Audit (2026-04-23)` section with per-gate evidence. Two items (DOC-001, DOC-013) required in-scope amendments: DOC-013 added four caveat admonitions to `collectors-secrets-backend.md`, DOC-001 fixed the Azure admin-groups claim default description on `oauth2-oidc.md`. Amendments shipped on `feature/phase-c-reaudit-amendments` (documentation). The remaining 11 items passed without amendment; most are small cross-reference or hygiene items, the two feature items (DOC-003 S2S, DOC-029 activity events) were verified against current consumer code with no drift.

### 2026-04-24 odd-platform.md config batch (DOC-007 / 009 / 010 / 011 / 019) — review-ready

Batch branch: `feature/docs-odd-platform-config` (documentation), paired with `feature/docs-odd-platform-config-state` (odd-team). Five commits, one per item, Gate-9 `Sources:` footer on each. Zero critical-priority items remain after Enable-security closed — this was the natural high/medium continuation on `odd-platform.md` that the 2026-04-24 batch notes flagged.

**DOC-007 (`3e52e31`) — metrics config completion.** `application.yml:60-78` declares a `metrics.export.*` block (INTERNAL_POSTGRES vs PROMETHEUS), a `metrics.storage` discriminator, and the Prometheus exporter's OTLP endpoint / auth-header keys. The previous doc covered only the `INTERNAL_POSTGRES` default; the PROMETHEUS branch (Tempo-compatible endpoint, bearer-token auth, `metrics.export.period` cadence) was half-authored with no explanation of when to pick it. Shipped: PROMETHEUS tab with endpoint/auth/period, `metrics.storage` discriminator with its INTERNAL_POSTGRES default, explicit "Prometheus storage requires OTLP HTTP endpoint + tenant-aware receiver" note. `Sources:` footer cites `application.yml:60-78` + the Prometheus exporter bean factory (`MetricExporterConfig.java`).

**DOC-009 (`feff04d`) — housekeeping TTL + scheduler.** `HousekeepingProperties.java` binds `housekeeping.enabled` (default `true`), `.alert-ttl-days` (default `60`), `.data-entity-ttl-days` (default `60`). `HousekeepingJobManager.java:17-26` runs at `@Scheduled(fixedRate = 15, TimeUnit.MINUTES)` with a 14-min ShedLock on `housekeepingJob` — single-instance even in multi-replica deployments. Previous doc listed the keys with defaults but no cadence, no scheduler awareness, and no caveat for `enabled=false` (unbounded growth of `ALERT`, `ALERT_CHUNK`, and ~25 cascaded `DATA_ENTITY` child tables documented in `DataEntityHousekeepingJob.java:99-126`). Shipped: prose lede on the scheduled job (15-min cadence, ShedLock single-instance, no CLI trigger), per-key documentation with defaults, warning admonition that `housekeeping.enabled=false` disables BOTH alert and data-entity cleanup permanently (operators must size Postgres disk accordingly). `Sources:` footer cites `application.yml:64`, `HousekeepingProperties.java`, `HousekeepingJobManager.java:17-26`, `AlertHousekeepingJob.java`, `DataEntityHousekeepingJob.java:99-126`.

**DOC-010 (`fd8d78f`) — odd.* platform settings.** Restructured "Detecting Stale Metadata" into "Platform-level settings (`odd.*`)" with three scoped subsections. Three `odd.*` keys were either undocumented or mis-scoped: `data-entity-stale-period` (documented but buried), `tenant-id` (previously claimed as "multi-tenancy identifier" in a finding — consumer-read audit showed all 5 consumers are in the Prometheus external-metrics path, `ExternalMetricReader` + 4 `TimeSeriesExtractor` classes, so it is a **Prometheus tenant label, ignored when `metrics.storage=INTERNAL_POSTGRES`** — scope corrected), `activity.partition-period` (undocumented cadence of a DB partition rotation). Fixed three env-var typos in the pre-existing example: `ODD_TENANT-ID_DATA_EMTITY_STALE_PERIOD` → `ODD_DATA_ENTITY_STALE_PERIOD` + `ODD_TENANT_ID`, `ODD_ACTIVITY_PARTITION-PREIOD` → `ODD_ACTIVITY_PARTITION_PERIOD`. `Sources:` footer cites `application.yml:18-22`, `ExternalMetricReader.java`, 4 x `*TimeSeriesExtractor.java` (all configured `tenant-id` consumers), `DataEntityFilledRepositoryImpl` (staleness consumer), `ActivityPartitionManager` (partition rotation consumer).

**DOC-011 (`05820fa`) — Spring-level config.** Two Spring-native keys shipped with ODD that carry security/operational implications and were completely undocumented: `spring.session.timeout` default `-1` = never expires (sessions in production outlive the process) and `spring.codec.max-in-memory-size` default `20MB` caps WebFlux transport-layer request body. Shipped: new `### Session lifetime` subsection under "Select session provider" with warning admonition explicitly naming the `-1` infinite-session default as unsafe in internet-facing / multi-user deployments; `spring.codec.max-in-memory-size` added as a bullet in "Attachment Storage Configuration → Configuration keys" cross-referenced from `attachment.max-file-size` with a warning admonition explaining the `DataBufferLimitException` trap when operators raise attachment limits without raising the codec ceiling (both default to 20MB — the coincidence hides the dependency until operators raise one). Duration / size formats documented (`30m` / `8h` / `1d` for session; `20MB` / `100MB` / `1GB` for codec). Env-var equivalents shipped (`SPRING_SESSION_TIMEOUT`; the codec key's env-var form follows Spring Boot relaxed binding). No upstream issue filed — the `attachment.max-file-size` vs codec-ceiling interaction is a Spring WebFlux design trade-off, not a platform defect, and the doc warning is the correct remediation. `Sources:` footer cites `application.yml:1-3,14-15`, Spring Session Boot auto-config (framework-level `SessionProperties.timeout` binding), Spring WebFlux Boot auto-config (framework-level `CodecConfigurer` via `WebFluxAutoConfiguration`), cross-ref to DOC-008 `attachment.max-file-size`.

**DOC-019 (`8896c46`) — AlertManager webhook integration.** `AlertManagerController.java:17-32` exposes `POST /ingestion/alert/alertmanager`, previously completely undocumented. `AlertServiceImpl.handleExternalAlerts` (lines 151-191) hardcodes every inbound alert to `AlertTypeEnum.DISTRIBUTION_ANOMALY` and reads `externalAlert.getLabels().get("entity_oddrn")` as the routing key — alerts without that label are silently orphaned. Shipped across two files: (1) new H2 section "Prometheus AlertManager Integration" in `odd-platform.md` between "Enable Alert Notifications" (outbound notifications) and "Enable Data Collaboration" — endpoint path, `204 No Content` response, JSON payload schema naming only the three consumed fields (`labels`, `generatorURL`, `startsAt`) with a note that other AlertManager top-level fields are accepted-and-ignored, a minimal AlertManager receiver config (YAML) and a Prometheus alerting-rule example showing how to attach `entity_oddrn` as a label, plus authentication cross-ref to `auth.ingestion.filter.enabled` / s2s.md; (2) one paragraph in `Features.md` Alerting section naming the two alert origins (internal pipeline / AlertManager inbound) with a cross-link. Warning admonition on the `entity_oddrn` requirement — critical because the reference example `docker/examples/config/alertmanager.yaml` does not show it, so operators copying verbatim create silent-orphan configurations. `Sources:` footer cites `AlertManagerController.java:17-32`, `ExternalAlert.java:11-15`, `AlertServiceImpl.java:151-191`, `docker/examples/config/alertmanager.yaml`, cross-ref to DOC-004 + `enable-security/authentication/s2s.md`.

**Upstream issue draft filed** — `issues/odd-platform/PLT-002.md` (enhancement, medium): add OpenAPI spec for `POST /ingestion/alert/alertmanager`. Controller's own `// TODO: define OpenAPI spec based on alert provider contract` acknowledges the gap — the endpoint is absent from Swagger UI and from generated Java/TS clients, forcing hand-rolled HTTP calls. DOC-019 ships with hand-authored payload schema prose; the upstream spec addition will supersede that prose with a cross-link. Filed paste-ready on disk; `draft → filed` is a deliberate human action.

**Caveats surfaced and shipped in-scope**:
- Housekeeping `enabled=false` → unbounded growth of `ALERT`, `ALERT_CHUNK`, and ~25 cascaded `DATA_ENTITY` child tables (DOC-009 warning admonition).
- `spring.session.timeout=-1` → never-expire (DOC-011 warning admonition; named in the security-sensitive AC).
- `spring.codec.max-in-memory-size` coincides with `attachment.max-file-size` default at 20MB → raising one without the other throws `DataBufferLimitException` at the WebFlux codec layer (DOC-011 cross-referenced warning admonition).
- AlertManager `entity_oddrn` label is the routing key; alerts without it are silently orphaned into unreachable state (DOC-019 warning admonition; the stock `alertmanager.yaml` example does not include it, which is the operator-trap vector).

**Caveats surfaced and intentionally out of scope** (logged separately):
- PLT-002 (new this session) — OpenAPI spec gap for the AlertManager endpoint; doc-side prose ships now.
- `docker/examples/config/alertmanager.yaml` in `odd-platform` does not include `entity_oddrn` — not fixed here (platform-repo change, out of scope for a doc session); DOC-019's doc-side warning + Prometheus alerting-rule example compensate.

Effect on counts: review-ready 0 → 5 (DOC-007, DOC-009, DOC-010, DOC-011, DOC-019); pending 39 → 34; total unchanged at 63. Upstream-issues odd-platform row 1 → 2 (PLT-002 added).

**Open for `/review`** in a separate session (batch form: `/review batch:feature/docs-odd-platform-config`):
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-metrics` — confirm PROMETHEUS tab renders with OTLP endpoint/auth/period, metrics.storage discriminator present.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#housekeeping-settings-configuration` — confirm prose lede, 15-min scheduled cadence note, and warning admonition on `housekeeping.enabled=false`.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#platform-level-settings-odd` — confirm three subsections (`data-entity-stale-period`, `tenant-id` Prometheus-scoped, `activity.partition-period`) and corrected env-var names.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#session-lifetime-spring-session-timeout` — confirm warning admonition + duration format examples.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#configuration-keys` — confirm `spring.codec.max-in-memory-size` bullet present in attachment keys list with the codec-vs-attachment interaction warning.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` — confirm new H2 renders with JSON payload, receiver YAML, Prometheus alerting-rule, `entity_oddrn` warning.
- WebFetch `https://docs.opendatadiscovery.org/features#alerting` — confirm new paragraph naming internal + AlertManager origins with cross-link.
- Gate 9 outbound-URL sweep: the new URLs introduced are `https://prometheus.io/docs/alerting/latest/alertmanager/`, `https://prometheus.io/docs/alerting/latest/configuration/#webhook_config`, and `https://github.com/opendatadiscovery/odd-platform/blob/main/docker/examples/config/alertmanager.yaml`. Verify each resolves.
- After Gate 8 PASS, flip all 5 items `review-ready` → `done`.

### 2026-04-24 odd-platform.md config batch — `/review` verdict (separate session)

Separate-session `/review batch:feature/docs-odd-platform-config` executed 2026-04-24 after PR #26 merged to `documentation/main` as commit `a767993` and GitBook rebuilt. Per-item verdicts appended to each backlog file with gate-by-gate evidence and Gate 9 SoT class citations. **Three ACCEPTED, two REJECTED.**

**DOC-009 — ACCEPTED.** All 4 ACs PASS; Gates 1/3/4/6/7/8/9 PASS; Gates 2/5 N/A. Consumer-read audit reads each of `HousekeepingTTLProperties.java:1-12`, `HousekeepingJobManager.java:17-26` (15-min `@Scheduled` + `@SchedulerLock("housekeepingJob", 14m)` confirmed), `AlertHousekeepingJob.java:23-47`, `SearchFacetsHousekeepingJob.java:19-30`, `DataEntityHousekeepingJob.java:67-129` + the 25-table cascaded-delete chain at :99-126. Each of the 13 table-category names in the doc ("metadata values, ownerships, lineage, tags, terms, alerts, messages, metrics, attachments, task runs, group relations, dataset structure, enum values") cross-checked against the 25 `deleteXxx()` method calls. Stale GitHub pinned-SHA link removed cleanly. Live-site WebFetch quotes "The job fires every 15 minutes, is guarded by a ShedLock so only one platform instance runs it at a time" verbatim.

**DOC-010 — ACCEPTED.** All 4 ACs PASS (AC3 "multi-tenancy identifier" corrected to the narrower-but-accurate "Prometheus tenant label"); Gates 1/3/4/6/7/8/9 PASS; Gates 2/5 N/A. Consumer-read audit traces `odd.data-entity-stale-period` → `DataEntityStaleDetector.java:8-17` (null-safe), `odd.activity.partition-period` → `ActivityTablePartitionManager.java:10-13` (inline default 30), `odd.tenant-id` → `ExternalMetricReader.java:52-58` + all 4 `*TimeSeriesExtractor.java` files in `service/ingestion/metric/extractors/external/` (verified via `grep -rn "odd.tenant-id"`). Anchor rename from `#detecting-stale-metadata` to `#platform-level-settings-odd` preserved the inner H3 `### Detecting stale metadata`, so any deep-link still resolves; `grep` across the docs tree confirmed zero external references to the old H2 slug. Three env-var typos fixed in-scope (Spring Boot relaxed binding requires underscores, not dashes).

**DOC-011 — ACCEPTED.** All 4 ACs PASS; Gates 1/3/4/6/7/8/9 PASS; Gates 2/5 N/A. Both keys are framework-level Spring Boot bindings — Sources footer correctly cites the `application.yml` declarations and names `spring-boot-autoconfigure`'s `SessionProperties.timeout` / `WebFluxAutoConfiguration` CodecConfigurer as the framework-level binders, per the explicit CLAUDE.md Gate 4 exception for framework defaults. `grep -rn '"spring.session.timeout|spring.codec.max-in-memory-size"' odd-platform-api/src/main/java` returns no hits — confirms no in-repo @Value consumer exists. Warning admonitions for infinite-session default and `DataBufferLimitException` codec-vs-attachment interaction trap both rendered as dedicated `{% hint style="warning" %}` blocks on the live site.

**DOC-007 — REJECTED → blocked.** ACs 1-4 PASS; Gates 1/2/3/5/7/8 PASS; Gates 4/6/9 FAIL. The authored section describes `metrics.storage` as a **read-side** switch only: "Storage (metrics.storage) — where the platform **reads metrics back** when rendering the UI charts" (odd-platform.md:218), and for PROMETHEUS specifically "metrics are **queried from** an external Prometheus instance using its instant-query API" (:228). Consumer-read audit against `ExternalIngestionMetricsServiceImpl.java:54-81` shows the same `metrics.prometheus-host` is **also** used for Prometheus remote-write at `/api/v1/write` with Snappy + Protobuf encoding. Ten additional `metrics.storage` / `metrics.export.enabled` consumers were identified via `grep -rn '"metrics.storage"' odd-platform-api/src/main/java` that the Sources footer did not cite — including `InternalIngestionMetricsServiceImpl.java:66` and `ExternalIngestionMetricsServiceImpl.java:56` (the write-side conditionals). Operator consequence: a Prometheus instance without `--web.enable-remote-write-receiver` enabled would silently lose all ingested metric data under `metrics.storage=PROMETHEUS`. Follow-up logged: **DOC-064** (pending, high — amend the metrics config to describe the write path + ship the Prometheus remote-write-receiver requirement as a warning admonition). DOC-007 re-runs `/review` after DOC-064 ships.

**DOC-019 — REJECTED → blocked.** ACs 1-4 PASS; AC5 FAIL (authentication); Gates 1/3/5/6 (payload axis) /7/8 PASS; Gates 4/9 FAIL on the authentication claim; Gate 6 FAIL on the authentication axis. The authored Authentication subsection at odd-platform.md:555-559 asserts that `auth.ingestion.filter.enabled=true` makes the AlertManager endpoint require an `Authorization: Bearer <token>` header. Three independent falsehoods verified in code:
  1. `IngestionDataEntitiesFilter.java:20,28` matches only `/ingestion/entities` (POST); `auth.ingestion.filter.enabled` has no effect on `/ingestion/alert/alertmanager`.
  2. `SecurityConstants.WHITELIST_PATHS[96]` whitelists `/ingestion/**` — Spring Security's permission chain is bypassed entirely for the namespace.
  3. `S2sAuthenticationFilter.java:20` reads `X-API-Key`, not `Authorization: Bearer`; its `filter()` at :27-29 passes through rather than rejecting unauthenticated requests.

Net: the endpoint is unauthenticated regardless of the flag. This contradicts DOC-004's (pending, high) canonical description of the filter's scope, which the DOC-019 authoring path did not cross-check despite naming DOC-004 in its Sources footer. Classified as Critical under CLAUDE.md priority 1 ("Incorrect documentation actively misleading; security exposure in a default deployment"). Two follow-ups logged: **DOC-065** (pending, critical — rewrite odd-platform.md:555-559 to describe the actual unauthenticated posture + recommend perimeter controls; remove the misleading `Authorization: Bearer` recommendation) and **PLT-003** (draft, high — extend ingestion auth filter coverage to `/ingestion/alert/alertmanager` upstream). **PLT-002 draft also carries the identical incorrect `"inherits the ingestion auth filter"` claim at line 56** and must be corrected before filing; this is called out in the DOC-019 verdict and as an action in DOC-065's Implementation Notes. DOC-019 re-runs `/review` after DOC-065 ships.

Effect on counts: review-ready 5 → 0; done 22 → 25 (+DOC-009, +DOC-010, +DOC-011); blocked 0 → 2 (+DOC-007, +DOC-019); pending 34 → 36 (+DOC-064, +DOC-065); total 63 → 65. Upstream issues: `odd-platform` row 2 → 3 (PLT-003 added).

**Lessons** (for Phase-retro capture):
- The DOC-019 authoring flow named DOC-004 in its Sources footer but did not **read** DOC-004's Description, which contains the correct filter-scope table (`backlog/docs/DOC-004.md:22-36`). Naming a source without reading it is a Gate 9 class failure in the making. Amend implementer guidance: **when a Sources footer cites another backlog item, read the Description and AC of that item before authoring**; a footer ID is not a substitute for a cited line.
- The DOC-007 authoring framed `metrics.storage` as what `ExternalMetricReader` is conditionally loaded on (a read-side @ConditionalOnProperty), missing the symmetric write-side conditional in `ExternalIngestionMetricsServiceImpl`. The Gate 4 rule "read every @Value / @ConfigurationProperties / @ConditionalOnProperty consumer" existed but was applied only to the read-path consumers. Amend implementer guidance: **for discriminator-style properties (values that route between alternative beans), `grep -rn '"<key>"'` across the whole module is the floor, not the ceiling** — one @ConditionalOnProperty hit implies there is likely a counterpart on the other branch that must be traced too.

### 2026-04-24 odd-platform.md config amendment batch (DOC-064 + DOC-065) — review-ready

Batch branch: `feature/docs-odd-platform-config-amendments` (documentation), paired with `feature/docs-odd-platform-config-amendments-state` (odd-team). Cut from fresh `origin/main` including the merged first-batch commit `a767993` (PR #26). Two commits, one per item, Gate-9 `Sources:` footer on each. Addresses the two review-verdict blocks on DOC-007 and DOC-019.

**DOC-065 (`0489019`) — AlertManager authentication correction (critical).** Replaces `odd-platform.md:555-569` in full. Drops the three shipped falsehoods (`auth.ingestion.filter.enabled` guards the AlertManager endpoint; `Authorization: Bearer <token>` header; disabled-flag accepts unauthenticated POSTs) in favour of one DANGER admonition naming the actual posture — `/ingestion/**` is in `SecurityConstants.WHITELIST_PATHS`, `auth.ingestion.filter.enabled` scopes only `/ingestion/entities` (POST), toggling the flag has no effect on the AlertManager endpoint. Three perimeter-control options shipped as operator-ready recipes:
- **Network segmentation** — private network / VPN / Kubernetes NetworkPolicy with AlertManager-pod-only selector.
- **Authenticating reverse proxy** — nginx `auth_request` delegating to an SSO sidecar, or Envoy `ext_authz`.
- **mTLS termination** — client certificates on `/ingestion/alert/alertmanager` at the ingress, issued only to the AlertManager pod.

Cross-link to the broader ingestion-auth model via `enable-security/README.md` and `enable-security/authentication/s2s.md`. Platform-side fix (PLT-003) is named as upstream, not as the operator's mitigation. `Sources:` footer cites `IngestionDataEntitiesFilter.java:20,28`, `IngestionDataSourceFilter.java:20`, `SecurityConstants.java:95-96`, `S2sAuthenticationFilter.java:20,27-29`, `AlertManagerController.java:17-32`, and `issues/odd-platform/PLT-003.md`.

**DOC-064 (`f806e51`) — metrics.storage as storage tier (high).** Reframes `odd-platform.md:216-230` so the storage-tier description covers both write and read paths for each value of `metrics.storage`. INTERNAL_POSTGRES bullet now reads "written to and read from" Postgres; PROMETHEUS bullet names Prometheus remote-write at `/api/v1/write` (Snappy-compressed Protobuf-encoded), the instant-query API at `/api/v1/query`, and the single-host requirement (`metrics.prometheus-host` resolves both paths). Second warning admonition shipped as the DOC-008-class silent-data-loss guard:
- Prometheus server must run with `--web.enable-remote-write-receiver` (disabled by default in v2.33+; symptom is 404 at remote-write time + empty charts because the ingestion API returns 200 upstream of the downstream write).
- `/api/v1/write` and `/api/v1/query` must both resolve on the configured host.
- Read-only Prometheus-compatible backends — Thanos querier, Mimir in query-only mode — are explicitly called out as non-targets.

The existing `IllegalStateException: Prometheus host is not defined` admonition is preserved unchanged. `Sources:` footer cites `ExternalIngestionMetricsServiceImpl.java:54-81`, `InternalIngestionMetricsServiceImpl.java:64-75`, the Prometheus remote-write protocol spec, the instant-query API, Thanos, and Mimir.

**PLT-002 draft correction (state-side, shipped in the odd-team state commit).** Lines 56 and 66 of `issues/odd-platform/PLT-002.md` previously carried the same "inherits the ingestion auth filter" / "ingestion API key (same scheme as the other `/ingestion/*` endpoints)" claim that DOC-019 was rejected for. Both rewritten to accurately describe the current unauthenticated posture and to name PLT-003 as the prerequisite before the spec advertises API-key protection. PLT-002 remains `draft` (unchanged) — correction is safe pre-filing, required by DOC-065's AC.

**Caveats surfaced and shipped in-scope** (all in the amended content):
- AlertManager webhook is unauthenticated regardless of `auth.ingestion.filter.enabled` (DOC-065 danger admonition).
- `metrics.storage=PROMETHEUS` silently drops metrics if Prometheus is missing `--web.enable-remote-write-receiver` (DOC-064 warning admonition — ingestion API returns 200 before the downstream remote-write 404s, so operators will not see this in collector logs, only as empty UI charts).
- Thanos querier / Mimir query-only-mode are non-targets for `metrics.storage=PROMETHEUS` (DOC-064 same admonition).

**Caveats surfaced and out of scope** (logged elsewhere or framework-level):
- **PLT-003** (draft) — upstream code fix for the ingestion-filter coverage gap. Doc-side caveat ships now; human filing of PLT-003 remains a deliberate action.
- **DOC-004** (pending) — broader ingestion-filter model doc; DOC-065 cross-links the existing `enable-security/README.md` / `enable-security/authentication/s2s.md` instead of duplicating.
- **Navigation gap** — `navigation/domains/alerting.md` does not exist; AlertManagerController + AlertServiceImpl inbound path would be its natural home. Not filed in this batch — a navigation pointer addition is appropriate when inbound-alert consumer-read audits resume.

Effect on counts: review-ready 0 → 2 (+DOC-064, +DOC-065); pending 36 → 34. Upstream-issues counts unchanged (PLT-002 correction is a draft edit, not a status transition).

**Open for `/review`** in a separate session (batch form: `/review batch:feature/docs-odd-platform-config-amendments`):
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-metrics` — confirm lede frames storage as both writes and reads; INTERNAL_POSTGRES bullet says "written to and read from"; PROMETHEUS bullet names `/api/v1/write` (Snappy + Protobuf) AND `/api/v1/query`; both warning admonitions render (existing startup-fail one untouched + new remote-write-receiver / Thanos / Mimir one).
- WebFetch the `### Authentication` subsection under "Enable AlertManager integration" — confirm DANGER admonition renders; "Authorization: Bearer" is gone; perimeter-control bullets (NetworkPolicy, nginx auth_request / Envoy ext_authz, mTLS) render; cross-link to `enable-security/README.md` resolves without a GitHub fallback URL.
- Gate 9 outbound-URL sweep: new URLs introduced are `https://prometheus.io/docs/specs/remote_write_spec/`, `https://thanos.io/`, `https://grafana.com/oss/mimir/`. Verify each resolves.
- After Gate 8 PASS, flip DOC-064 + DOC-065 `review-ready` → `done`, then re-run `/review DOC-007` and `/review DOC-019` (both expected to transition `blocked` → `done` on this amendment).

### 2026-04-24 enable-security batch (DOC-037 + DOC-061) — `/review` ACCEPTED both

Separate-session `/review` on 2026-04-24 flipped both items `review-ready` → `done`. Per-item verdicts appended to `backlog/docs/DOC-037.md` and `backlog/docs/DOC-061.md` with cited evidence per Quality Bar gate and Gate 9 SoT class.

**DOC-037 — ACCEPTED.** All 5 ACs PASS; Gates 1/3/4/6/7/8/9 PASS; Gates 2/5 N/A. Key evidence: `grep | diff` against `odd-platform-specification/components.yaml:160-235` confirms 75 enum entries match the doc one-for-one (only `ALL` is an intentional addition); generator hint block renders on `docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions`; no `github.com/opendatadiscovery/documentation/blob/` fallback URL in the rendered page; outbound URL to `github.com/opendatadiscovery/odd-platform/blob/main/odd-platform-specification/components.yaml` verified by WebFetch.

**DOC-061 — ACCEPTED.** All 6 ACs PASS; Gates 1/3/4/6/7/8/9 PASS; Gates 2/5 N/A. Key evidence: `AzureLogoutSuccessHandler.java:30-48` confirmed to call `URI.create(provider.getLogoutUri())` with no null guard, vs. `CognitoLogoutSuccessHandler.java:33-35`'s `StringUtils.isEmpty` guard — the doc's Azure-specific framing is accurate. `ODDOAuth2Properties.java:43` has `private String logoutUri;` and `@PostConstruct validate()` (lines 16-28) does not null-check it. Live-site WebFetch of `docs.opendatadiscovery.org/.../oauth2-oidc` renders the warning admonition with the exact authored NPE / 500 wording, the Notes bullet with the endpoint shape for single-tenant / organizations / common, and the new troubleshooting bullet.

**Standing follow-up candidate** (not filed this session; documented in both items' verdict Notes): the Azure vs Cognito asymmetry — Azure handler lacks the null guard Cognito has. Either add `StringUtils.isEmpty` guard to `AzureLogoutSuccessHandler` or extend `ODDOAuth2Properties.validate()` to reject Azure configs with a null `logout-uri`. Doc warning protects operators; code fix is quality-of-life, not data-loss. Defer until a second independent signal motivates filing.

Effect on counts: review-ready 2 → 0; done 20 → 22; total unchanged at 63. **Zero critical-priority items remain** — backlog is now high/medium-driven. Natural next batch candidate is `odd-platform.md` continuation (DOC-007 / 009 / 010 / 011 / 019 — same-file, sequential).

### 2026-04-24 enable-security batch (DOC-037 + DOC-061) — review-ready

Batch: `feature/docs-enable-security-fixes` (documentation), paired with `feature/docs-enable-security-fixes-state` (odd-team). Two commits, one per item, Gate-9 `Sources:` footer on both.

**DOC-037 — permissions-list regeneration.** The 2026-04-20 finding claimed "20+ missing permissions + 4 ghost entries" in `permissions.md`. By 2026-04-24, pre-authoring re-verification against `odd-platform-specification/components.yaml:160-235` showed the live doc already carried all 75 enum entries and zero ghosts — intervening `[GITBOOK-NN]` web-editor commits had closed the primary gap. Classic stale-finding class (the same failure mode the 2026-04-22 re-verification sweep documented). Scope contracted from "regenerate list" to "ship AC #5 (generator/source note) + clean up structural inconsistencies the rewrite surfaces."

What shipped (`728bb52`):
- New generator hint block pointing at `github.com/opendatadiscovery/odd-platform/blob/main/odd-platform-specification/components.yaml` — closes AC #5 and makes future enum-vs-doc drift self-auditing.
- **Lookup Table permissions split into their own section** (intro list went 4→5 types). Rationale: operator-managed reference data is not platform administration; grouping `LOOKUP_TABLE_*` with `DATA_SOURCE_*` / `COLLECTOR_*` misled readers.
- Cross-section miscategorization fixed: `QUERY_EXAMPLE_DATASET_*` (Data entity → Query Example), `QUERY_EXAMPLE_TERM_*` (Term → Query Example), `TERM_CREATE` (Management → Term).
- Formatting hygiene: unified heading style, unified entry punctuation (`` * `PERMISSION`. Description. ``), removed `&#x20;` HTML-entity cruft on two lines, fixed one typo on `DATASET_FIELD_ENUMS_UPDATE`.
- Pre-commit verification: `grep | diff` against the enum confirmed 75-for-75 match (only delta is `ALL`, which is not in the enum by design).

Sources footer: `components.yaml:160-235`; `architecture.md` row "odd-platform".

**DOC-061 — Azure AD logout-uri.** Closes the Gate-6 follow-up from DOC-001 Phase-C review on 2026-04-23. Claim trail: `AzureLogoutSuccessHandler.java:30-48` calls `URI.create(provider.getLogoutUri())`; `provider.getLogoutUri()` returns null when the Azure config does not set `logout-uri`; `URI.create(null)` throws NPE; the logout flow returns 500. `ODDOAuth2Properties.java:43` declares `logoutUri` as a generic `OAuth2Provider` field with no `@PostConstruct` null-check. Cognito already documents `logout-uri` at `oauth2-oidc.md:57`; Azure section did not — operators reading only the Azure section had no way to discover the requirement until production broke.

What shipped (`62cf718`):
- Preamble prose for both tenancy modes mentions `logout-uri` as a mode-differing URI key.
- `logout-uri` added to single-tenant and multi-tenant YAML + env-var tabs (4 examples total), placed adjacent to existing URI keys.
- New Notes bullet explains the Azure OIDC logout endpoint shape (`/{tenant-id|organizations|common}/oauth2/v2.0/logout`) and why ODD redirects there on logout.
- New `{% hint style="warning" %}` admonition explicitly naming `URI.create(provider.getLogoutUri())` and the NPE / 500 failure mode.
- New troubleshooting bullet tying "logout returns 500 or never completes" back to an unset `logout-uri`.

Sources footer: `AzureLogoutSuccessHandler.java:30-48` + `:21`; `ODDOAuth2Properties.java:43`; `oauth2-oidc.md:57` (Cognito precedent); `architecture.md` row "odd-platform".

**Navigation update** on the state branch: `navigation/domains/authentication.md` Auth Package listing now lists `AzureLogoutSuccessHandler.java` (with the `@Conditional(AzureCondition.class)` and NPE-if-unset note) alongside the generic `OAuthLogoutSuccessHandler.java` — closes the navigation gap that let the handler stay un-pointed-at through the earlier Phase-C re-audit. The same file's Permissions subsection was updated from "58 entries / outdated" to "75 entries / generator hint links back to enum."

**Out-of-scope follow-up candidates, intentionally not filed this session**:
- Platform-side: `AzureLogoutSuccessHandler` could defensively null-check `provider.getLogoutUri()` (or `@PostConstruct validate()` in `ODDOAuth2Properties` could reject Azure configs with a null `logout-uri`). The doc warning ships now; the code defensiveness is a quality-of-life improvement, not a data-loss risk. Worth a future upstream issue draft but not this session.
- Meta: the stale-finding-on-DOC-037 pattern (critical flagged in an old scan, resolved by intervening GitBook commits, not caught by scanners because no re-enumeration happened) continues to suggest a coverage-staleness scanner. Already partially addressed by the 2026-04-22 "fetch origin/main before scan" rule; a complementary scanner that diffs `backlog/` findings against current doc state would close the loop. Not filing yet — wait until a second instance of this pattern confirms the pattern before adding machinery.

Effect on counts: review-ready 0 → 2 (DOC-037, DOC-061); pending 41 → 39; total unchanged at 63.

**Open for `/review`** in a separate session (batch form: `/review batch:feature/docs-enable-security-fixes`):
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` — confirm 5-section layout, generator hint block renders, all 75 enum entries present (run the same grep/diff check the implementer used), no HTML-entity cruft visible.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc#azure-ad` — confirm `logout-uri` in all 4 config tabs, warning admonition renders as an amber hint, troubleshooting bullet present.
- Gate 9 outbound-URL sweep: the single new URL introduced is the components.yaml GitHub link — verify it resolves (path + file still exists on `main`).
- After Gate 8 PASS, flip both items `review-ready` → `done`. After that flip, zero critical-priority pending items remain.

### 2026-04-23 DOC-063 — canonical vocabulary landed in main-concepts.md

Trigger: the user's 2026-04-23 terminology correction (adapter = mapping scripts, push or pull; collector = container of pull adapters; plugin = configured adapter instance inside a collector; push adapter a.k.a. push-client = push-strategy adapter embedded in source's runtime) was captured in `navigation/architecture.md` §Canonical vocabulary during pipeline-hardening-2 and carried into DOC-042's acceptance criteria, but the user-facing doc page at `docs.opendatadiscovery.org/main-concepts` still described a three-term producer model (Adapter / Collector / Push-client) with Plugin absent and with "Push-client" presented as canonical over "Push adapter." Leaving that mismatch in place would mean DOC-042 (Integrations hub) and DOC-062 (tree-wide vocabulary sweep) could not cite main-concepts.md as a canonical source — a Gate 9 failure in waiting.

**Scope** (narrower than DOC-042): only `docs/main-concepts.md`, and only three zones within it — the architecture-chain narrative, the Adapter-vs-Collector-vs-Push-client table (renamed and expanded to four rows including Plugin), and the Terms & Aliases table (four new/updated canonical rows). Other sections of the page (Push vs Pull strategies, ODD Specification, Data Governance map, AI aspects) were deliberately left alone — their AKA-form language is now registered in Terms & Aliases, so Gate 2 is satisfied, and DOC-062's sweep will normalize if needed.

**Changes shipped on `feature/docs-canonical-vocabulary`** (documentation, commit `bc23e31`):

- H2 `The architecture chain` rewritten to separate pull and push paths and enumerate four producer-side concepts (Adapter, Plugin, Collector, Push adapter) with definitions matching `navigation/architecture.md:9-28` verbatim in substance.
- H2 `Adapter vs Collector vs Push-client` renamed to `Adapter, Plugin, Collector, Push adapter`; table expanded to four rows. **Known limitation**: GitBook anchor slug changes from `#adapter-vs-collector-vs-push-client` to `#adapter-plugin-collector-push-adapter`. Grep across `documentation/docs/` for the old slug returned zero hits on 2026-04-23, so no internal links broke; any external inbound links now land on the page and scroll to top. Not adding a redirect (GitBook has no per-anchor redirect primitive).
- Terms & Aliases table gains rows for Adapter, Plugin, Collector, and Push adapter; the existing "Push-client → Push adapter" row was flipped to "Push adapter → Push-client" to match the canonical direction in `navigation/architecture.md`.

**Bookkeeping on `feature/docs-canonical-vocabulary-state`** (odd-team):

- `backlog/docs/DOC-063.md` (new) — full item frontmatter + ACs + review-ready notes with live URLs, diffstat, Sources footer, and explicit out-of-scope caveats.
- `backlog/docs/DOC-042.md` amended — Terms & Aliases registration AC rewritten: four bullets checked as delivered-by-DOC-063, one bullet remains (add the "Integration" umbrella row when the hub lands); `depends_on` gains DOC-063; `affected_files` note narrowed.
- `state/file-registry.yaml` — DOC-063 entry added for `docs/main-concepts.md`; DOC-042's entry reworded.

Effect: total DOC items 62 → 63, pending 43 → 43 (DOC-063 landed directly at review-ready — pending never passed through in-progress on-disk before the docs commit because the code change and the backlog item were authored together in the same session), review-ready 0 → 1. Upstream-issues table unchanged.

**Open for `/review`** in a separate session:
- WebFetch the three live URLs in DOC-063's review-ready notes, confirm the four-row table renders with Plugin present and that the architecture-chain narrative reads cleanly with the two-path split
- Confirm no regression in sections left out of scope (Push vs Pull strategies, ODD Specification, etc.)
- Flip DOC-063 `review-ready` → `done` on pass; flip to `blocked` with evidence on any failure
- If the live site still caches the old `#adapter-vs-collector-vs-push-client` slug from a prior render, flag it — GitBook typically resolves new slugs within minutes of merge but cache behaviour varies.

### 2026-04-23 pipeline hardening pass 2 — Gate 9 Factual Claim Provenance

Trigger: Phase C `/review` accepted DOC-027 (Features.md Pandas→DataProfiler correction) without catching that one of the new GitHub links pointed at the wrong repo (`/odd-collectors/tree/main/odd-dbt` instead of `/odd-dbt`). The user spot-checked after merge, DOC-027 shipped a correction commit (`d82559e`), and the retrospective exposed a failure class the first eight gates did not gate:

- **Memory-as-SoT**: the dbt URL was authored from recall; no verification step required fetching the canonical repo. Gates 4 (Consumer-read) and 5 (Unset-parameter audit) cover runtime claims but don't cover static facts like "repo X exists at URL Y" or "tool Z is a push-client."
- **Reviewer rationalization**: the `/review` verdict used "defensible" / "probably correct" language where only "VERIFIED via {fetch/grep/read}" is admissible. Words like these paper over un-run checks.
- **Bi-directional duplication sweep missing**: the existing duplication sweep looks for existing mentions of the same term; it does not look at *new* URLs / terms / repos being introduced. A newly-authored wrong URL is not a duplicate of anything, so the sweep never fires.
- **Backlog dedup before proposing**: during the retrospective I drafted a "new Integrations hub" backlog item without greping the backlog — DOC-042 already covered it at higher fidelity. Same failure class: claim made without checking the SoT.

**Changes shipped on `feature/pipeline-hardening-2`**:

- `CLAUDE.md` — Quality Bar expanded from eight gates to nine. New Gate 9 (Factual Claim Provenance) with a ten-row Source-of-Truth table (Repo / Integration / Config / Builder / Spec / Term / Lifecycle / Dep / Handler / Cross-repo). Commit-footer migration from `Consumer-read:` to `Sources:` with class labels. Backlog-dedup rule added to "Follow-up work must be logged on disk."
- `.claude/skills/review/SKILL.md` — Gate 9 section with per-class verification rules, banned rationalization phrases ("defensible", "probably", "looks right", "canonical owner", "monorepo default", "safe to assume", "presumably", "should be"), every verdict entry must end `VERIFIED via …` or `NOT VERIFIED → logging as DOC-NNN`, outbound URL sweep added as a mandatory review step, verdict template extended with Gate 9 row + Outbound URL sweep summary + Banned-phrase check.
- `.claude/skills/implement/SKILL.md` — Phase 1 step 5 made bi-directional (existing content + new content inventory: terms, URLs, repos); Phase 1 step 6 became "Claim inventory and Source-of-Truth plan" covering all ten Gate 9 claim classes; Phase 2 step 2 renamed "Source-of-Truth verification"; Phase 2 step 4 gained backlog-dedup pre-check; commit footer migrated to `Sources:` block.
- `.claude/skills/scan/SKILL.md` — every finding must cite a Gate 9 SoT class; outbound URLs in doc under scan must be resolved against `navigation/architecture.md` or WebFetched; navigation updates extended to cover `architecture.md`.
- `navigation/architecture.md` — **new file.** Canonical integration-pattern + repo SoT. Classifies every ODD-org repo as Platform / Spec / Collector (pull) / Push-client (push) / SDK / Generated contracts / Tooling / Deployment / Examples / Meta. Canonical URL per repo. Pairs with `navigation/repos.yaml` (mechanical) and the live page at `docs.opendatadiscovery.org/developer-guides/github-organization-overview`.
- `navigation/features.yaml` — header cross-link added pointing at `architecture.md`.
- `memory/feedback_factual_provenance.md` (new) and `memory/feedback_cross_repo_verification.md` / `memory/feedback_gitbook_authoring.md` updated to cross-link Gate 9.
- Backlog:
  - **DOC-042** amended — Terms & Aliases AC now matches the canonical vocabulary in `navigation/architecture.md`: rows for **adapter** (mapper, push or pull), **collector** (container of pull adapters; not a synonym for "pull adapter"), **plugin** (configured adapter instance inside a collector), **push adapter** (alias: push-client), **integration** (umbrella). Gate 9 prerequisite note added to Implementation Notes; `main-concepts.md` added to `affected_files`.
  - **DOC-062** (new, high, medium effort) — outbound URL audit across the whole `docs/` tree + new `scanners/docs/quality/outbound-urls.md` scanner so future doc PRs get swept. Scanner_source: `discovered-during-DOC-027`.

Effect: total DOC items 61 → 62, pending 42 → 43. No review-ready changes (no doc-repo content churn in this pass, only rails + backlog). Upstream-issues table unchanged.

### 2026-04-23 pipeline hardening (Phase A) + re-audit (Phase B)

On 2026-04-23 a user spot-check uncovered that `MinioConfig.java` never calls `.region(...)` on the MinIO builder, silently locking attachment storage to `us-east-1`. The miss had shipped on `feature/critical-odd-platform-config` with DOC-008 marked `done`. Root cause: the old Quality Bar stated "verify every functional claim against the code" as a principle but not as a testable gate. Scanners read `application.yml`; they did not read `@Value` consumers or SDK builders.

**Phase A** (commit `96b28c4` on `feature/pipeline-hardening`): rewrote CLAUDE.md (new "The project and the maintainer" attitude section, Quality Bar expanded from six principles to eight gates, two new gates Consumer-read and Unset-parameter audit, workflow ends at `review-ready` not `done`). Updated `scanners/docs/accuracy/config-options.md` and `feature-behavior.md` with consumer-code / SDK audit passes. Created `scanners/docs/accuracy/integration-caveats.md` as a dedicated SDK-builder-audit scanner. Updated `.claude/skills/implement/SKILL.md` (consumer-read audit gate, mandatory `Consumer-read:` commit footer, Phase 2 ends at `review-ready`) and rewrote `.claude/skills/review/SKILL.md` (separate-session requirement, reject-by-default, eight-gate checklist, concrete DOC-008 FAIL example). Updated `backlog/README.md` lifecycle.

**Phase B** (same branch): re-audited DOC-005/006/008/018 under the new bar. Findings in `findings/docs-accuracy-integration-caveats/2026-04-23-reaudit-critical-odd-platform-config.md`:
- **F-CAV-001 (DOC-005 in-scope)** — `JavaMailSenderImpl` leaves SMTP connect/read/write timeouts unset (infinite default), no implicit-TLS support, no self-signed CA hook, no charset; `EmailNotificationSender.send()` silently aborts recipient loop on first failure. **Severity: high.** Shipped as commit `a725113` on `feature/doc-005-008-reaudit-caveats` (documentation).
- **F-CAV-002 (DOC-008 in-scope)** — `MinioAsyncClient.builder()` leaves `.httpClient(...)` unset (5-min MinIO-SDK-default timeouts); `RemoteFileUploadServiceImpl.completeFileUpload` stages chunks on local filesystem before REMOTE upload (K8s restart mid-upload loses chunks — same data-loss class as the LOCAL warning already in DOC-008); no retry on transient MinIO/S3 failures. **Severity: high.** Shipped as commit `d8976b1` on `feature/doc-005-008-reaudit-caveats` (documentation).
- **F-CAV-003 (new DOC-059)** — session-provider caveats: IN_MEMORY no eviction beyond TTL, INTERNAL_POSTGRESQL housekeeping hardcoded to 1 hour, REDIS requires undocumented `spring.data.redis.*` keys. **Severity: medium.** New backlog item.
- **F-CAV-004 (new DOC-060)** — third `odd.platform-base-url` consumer `StaticArgumentMappingContext.java:16` has a **different default** (`http://your.odd.platform` vs notifications' `http://localhost:8080`) and is undocumented. **Severity: medium.** New backlog item.

**Phase C obligation**: every `done` item closed before 2026-04-23 was self-closed by the implementer. Finding density in Phase B (4 missed caveats across 4 items) is the prior — treat all 13 done items as candidates for re-audit until each passes `/review` under the new bar.

### 2026-04-23 Phase C — older `done` items re-audited

13 items flipped from self-closed `done` to `review-ready` in a single batch run. Summary of findings:

- **In-scope amendments required (2)**: DOC-013 (SSM pagination silent truncation at 10 + 3 other SDK caveats), DOC-001 (Azure admin-groups default claim wrong). Both shipped on `feature/phase-c-reaudit-amendments` in the documentation repo.
- **Passed without amendment (11)**: DOC-003 S2S, DOC-029 activity events, DOC-035 Main Concepts, DOC-036 OKTA env var, DOC-052 M2M/secrets-backend teasers, DOC-053 M2M collapse, DOC-054 Adapters.md deletion, DOC-055 Architecture xref, DOC-056 Business Glossary link, DOC-057 Ingestion API link, DOC-058 mention-shortcut sweep.
- **Platform-side follow-up candidates (not doc fixes)** surfaced in the consumer-read pass but out of scope for doc-only remediation:
  - `S2sTokenProvider.isValidToken` NPE path when `auth.s2s.enabled=false` and an X-API-Key header is sent (filter not registered in that state, so unreachable in normal deployments; defensive null handling is cheap).
  - `ssm_parameter_store._get_secrets_by_prefix` silent truncation at 10 results — collector-SDK defect (doc caveat ships now, SDK fix is a separate odd-collectors Issue).

Finding density was 2 in-scope amendments out of 13 re-audits (15%), meaningfully lower than Phase B's 4/4 — consistent with the original items being smaller in scope than the critical odd-platform config cluster.

### 2026-04-22 stale-branch re-verification sweep

The `documentation` repo was re-scanned against `origin/main` after discovering that the original scan ran on stale branch `hotfix/add_info_for_deployment_on_eks_to_summary`, which lacked ~15 `[GITBOOK-*]` commits merged via the GitBook web editor. Outcome across 26 items touching Features.md:

- **Rejected as false positives (2)**: DOC-025 (labels terminology already cleaned), DOC-051 (Data Quality Dashboard already documented at `Features.md:296`, anchor `#id-7948`)
- **Narrowed scope (4)**: DOC-020 (alert halt — expand existing mention), DOC-038 (Lookup Tables — migrate to dedicated page), DOC-046 (Query Examples — migrate + expand), DOC-050 (Integration Wizard — merge with DOC-042 hub)
- **Still-valid on main (20)**: DOC-013, DOC-018, DOC-019, DOC-021, DOC-022, DOC-023, DOC-024, DOC-026, DOC-027, DOC-028, DOC-029, DOC-030, DOC-031, DOC-032, DOC-033, DOC-039, DOC-043, DOC-045, DOC-047, DOC-048

Process fix added to `scanners/README.md`: before scanning the `documentation` repo, fetch and checkout `origin/main`.

### DOC Backlog

Priority totals across both triaged scanners: **10 critical, 15 high, 19 medium**

#### From docs/accuracy/config-options (DOC-001 .. DOC-017)

**Critical (6):** DOC-001 Azure AD · DOC-003 S2S auth · DOC-005 email config · DOC-006 SESSION_PROVIDER · DOC-008 attachment storage (user-reported data loss) · DOC-013 collector secrets backend

**High (5):** DOC-004 ingestion auth filter · DOC-007 metrics config · DOC-009 housekeeping · DOC-014 CollectorConfig fields · DOC-016 adapter reference (large)

**Medium (6):** DOC-002 Keycloak PKCE · DOC-010 odd.* · DOC-011 spring.* · DOC-012 login-form defaults · DOC-015 monorepo URLs · DOC-017 Python version

#### From docs/accuracy/feature-behavior (DOC-018 .. DOC-044)

**Critical (4):** DOC-027 DataProfiler/Pandas claim · DOC-029 activity event types · DOC-036 OKTA env var bug · DOC-037 permissions list regeneration

**High (10):** DOC-018 SLACK_PLATFORM-BASE-URL · DOC-019 AlertManager webhook · DOC-020 per-entity alert halt · DOC-025 stale labels terminology · DOC-026 search facets (3→7) · DOC-031 ML Experiment rewrite · DOC-035 GLOSSARY.md stub · DOC-038 Lookup Tables · DOC-039 Relationships/ERD · DOC-040 deployment.md stub

**Medium (13):** DOC-021 resolved alert cleanup note · DOC-022 alert auto-resolution · DOC-023 alert UI views · DOC-024 backwards-incompatible schema · DOC-028 SLA URL param · DOC-030 activity filters (4→7) · DOC-032 Data Entity Report/Overview · DOC-033 term-to-term linking · DOC-034 data collaboration API · DOC-041 configuration.md stub · DOC-042 collector.md stub · DOC-043 lineage description · DOC-044 custom-collectors SDK guide

#### From docs/coverage/undocumented-features (DOC-045 .. DOC-051)

**High (2):** DOC-045 GenAI · DOC-046 Query Examples

**Medium (5):** DOC-047 Directory · DOC-048 Data Modelling landing · DOC-049 additional-links config · DOC-050 Integration Wizard · DOC-051 Data Quality dashboard

#### From docs/quality/duplication (DOC-052 .. DOC-057) — all done

All 6 items shipped and live-verified on `docs.opendatadiscovery.org`: DOC-052 M2M/secrets-backend teasers, DOC-053 M2M collapse in odd-platform.md, DOC-054 Adapters.md deletion, DOC-055 Architecture→Main Concepts xref, DOC-056 permissions.md Business Glossary link, DOC-057 oddrn.md Ingestion API link.

#### Discovered during implementation

**DOC-058** (high, medium-effort) — replace all 17 hand-authored GitBook `"mention"` shortcut links across 9 files in `configuration-and-deployment/` with plain markdown links. Surfaced during DOC-056's duplication sweep (line 83 of `permissions.md`), then scope expanded via a full docs-tree grep. Per `CLAUDE.md` "Documentation Authoring Rules": these shortcuts are unreliable outside the GitBook web editor and can silently fall back to raw GitHub URLs. Proactive rewrite prevents the 2026-04-22 S2S cache-fallback class of incident.

Totals across all 4 triaged scanners + discovered work: **11 critical, 20 high, 27 medium** (58 items; including done DOC-052, minus 2 rejected = 58 actionable; 17 already done, DOC-062 added 2026-04-23 during pipeline-hardening-2).

### Triage complete for all 4 completed scanners

Ready for human review of priority ordering before implementation begins (per `backlog/README.md` review gate). Next actions after review:
- Pick priority ordering (suggested: critical → high → medium)
- Kick off implementation via `/implement DOC-NNN`
- OR continue audit phase: enumerate one of the 22 remaining scanners

## Upstream Issues

Paste-ready GitHub issue drafts for upstream repositories. Format + lifecycle in `issues/README.md`. The `draft → filed` transition is a deliberate human action — the ODD Team drafts on disk; the maintainer files into the target repo's GitHub tracker.

| Target Repo | Draft | Filed | Closed | Rejected | Total |
|-------------|-------|-------|--------|----------|-------|
| odd-platform | 3 | 0 | 0 | 0 | 3 |
| odd-collectors | 1 | 0 | 0 | 0 | 1 |
| **Total** | **4** | **0** | **0** | **0** | **4** |

### Active drafts

- **PLT-001** (bug, low severity) — Defensive null handling in `S2sTokenProvider.isValidToken`. Discovered during `/review` of DOC-003 (2026-04-23). Unreachable NPE path under normal deployment because the S2S filter is conditionally registered; but the method is `public` and a 1-line `StringUtils.isBlank(s2sToken)` guard closes it permanently. Doc-side: no caveat needed; DOC-003 already describes the feature correctly. Draft at `issues/odd-platform/PLT-001.md`.
- **PLT-002** (enhancement, medium severity) — `POST /ingestion/alert/alertmanager` missing from OpenAPI spec. Discovered during DOC-019 implementation (2026-04-24). Controller carries an explicit `// TODO: define OpenAPI spec based on alert provider contract` — the endpoint works but is absent from Swagger UI and the generated Java/TS clients, forcing operators and downstream tooling to hand-roll HTTP calls. Doc-side payload shape shipped in prose in DOC-019 as a short-term bridge; upstream spec addition will supersede the prose with a cross-link. **Known defect in this draft**: line 56 repeats the same incorrect `"inherits the ingestion auth filter"` claim that DOC-019's review caught. PLT-002 is still `status: draft`, so the correction is safe — fold it into the DOC-065 commit or a paired state commit before filing. Draft at `issues/odd-platform/PLT-002.md`.
- **PLT-003** (bug, high severity) — ingestion auth filter does not cover `/ingestion/alert/alertmanager`. Discovered during `/review DOC-019` (2026-04-24). `SecurityConstants.WHITELIST_PATHS[96]` includes `/ingestion/**`, and neither `IngestionDataEntitiesFilter.java:20,28` (scoped `/ingestion/entities` only, conditional on `auth.ingestion.filter.enabled=true`) nor `IngestionDataSourceFilter.java:20` (scoped `/ingestion/datasources` only, always active) covers the AlertManager path. Anyone with network reach to the platform can POST arbitrary AlertManager payloads and create Distribution Anomaly alerts on any data entity whose ODDRN they can guess. Doc-side: DOC-065 will correct the misleading security claim in DOC-019 and recommend perimeter controls until the platform-side fix ships. Draft at `issues/odd-platform/PLT-003.md`.
- **COL-001** (bug, high severity) — AWS SSM secrets backend silently truncates plugin parameters at 10. `_get_secrets_by_prefix` does a single `get_parameters_by_path` call with no paginator; default `MaxResults=10` drops every plugin beyond the first ten with no error and no log warning. Production-critical for any collector with >10 plugins. Doc-side caveat already shipped under DOC-013 ("Known limitations" admonition). Draft at `issues/odd-collectors/COL-001.md`.

## Current Status

Phase: **Audit In Progress; critical backlog cleared; odd-platform.md config batch shipped to review-ready** — 4 scanners complete, 1 in progress, 22 remaining. 22 DOC items `done`; **5 DOC items `review-ready`** (DOC-007 / 009 / 010 / 011 / 019 on `feature/docs-odd-platform-config`); zero `critical`-priority items remain. Backlog now high/medium-driven. PLT-002 (AlertManager OpenAPI spec gap) queued as draft under `issues/odd-platform/` — manual human file-to-GitHub. Next candidate after the 5-item batch merges: `findings/docs-quality-rendering/` orphan-page triage (DOC-038 / 039 / 040 / 041 / 042 stubs) or a content-accuracy fresh batch on `Features.md` (DOC-026 / 029 / 031 / 032 / 033 still pending).

### Completed Scans
- `docs/accuracy/feature-behavior`: **100%** (18/18 domains) — **35 findings** (8 critical, 11 high, 16 medium)
  - Findings: `findings/docs-accuracy-feature-behavior/2026-04-20-alerting.md`, `2026-04-20-batch-2.md`, `2026-04-20-batch-3.md`
  - Status: **Ready for triage** → run `/triage findings/docs-accuracy-feature-behavior/`
- `docs/coverage/undocumented-features`: **100%** (20/20 features) — **8 new findings + 3 enrichments** (3 high, 8 medium)
  - Findings: `findings/docs-coverage-undocumented-features/2026-04-21.md`
  - Key: Attachments (user-reported!), GenAI, Query Examples, Directory, Data Modelling, Links, Integration Wizard, DQ Dashboard
  - Status: **Ready for triage** → run `/triage findings/docs-coverage-undocumented-features/`

### Active Scans
- `docs/quality/duplication`: **100%** (7/7 alias rows) — **5 findings** (2 high, 3 medium)
  - Findings: `findings/docs-quality-duplication/2026-04-22.md`
  - Key: third S2S duplicate hidden in `odd-platform.md` (F-001), orphaned `Adapters.md` (F-002)
  - Status: **Ready for triage**
- `docs/quality/rendering`: **11%** (4/37 pages) — **3 findings** (2 high, 1 medium)
  - Findings: `findings/docs-quality-rendering/2026-04-22.md`
  - Key: 8 orphan files not in SUMMARY.md (F-R01), M2M duplicate live on odd-platform page (F-R02)
  - Status: **Ready for triage** + continue scan (33 pages remaining)

### Recently Completed
- `docs/accuracy/config-options`: **100%** (2/2 targets) — **14 new findings + 6 enrichments** (3 critical, 5 high, 6 medium)
  - Findings: `findings/docs-accuracy-config-options/2026-04-21-platform.md`, `2026-04-21-collectors.md`
  - Key: Azure AD undocumented, S2S API key undocumented, secrets backend undocumented, 60 adapters with no config reference
  - Status: **Ready for triage** → run `/triage findings/docs-accuracy-config-options/`

## Next Actions

1. Run scanner: `scanners/navigation/ecosystem-map.md` (maps all repos, dependencies, versions)
2. Run scanner: `scanners/navigation/feature-entry-points.md` (populates navigation index)
3. Run scanner: `scanners/tests/collectors-sdk.md` (bounded scope, one session)
4. Run scanner: `scanners/tests/core-packages.md` (shared libraries — high blast radius)
5. Clone odd-docs repo for documentation scanners
6. Clone/fetch remote repos: odd-dbt, odd-spark-adapter, odd-airflow-2, odd-cli

## Next Batch Candidates

Three batches shipped in sequence: docs-quality cleanup (DOC-052..057), authoring-hygiene sweep (DOC-058), and critical `odd-platform.md` config (DOC-005 / 006 / 008 / 018). Remaining candidates for the next `/implement` batch, grouped by theme:

**Batch: remaining critical doc-accuracy items (cross-file)**
- **DOC-027** DataProfiler / Pandas claim fix (Features.md + dq_visibility.md)
- **DOC-037** regenerate permissions list from OpenAPI spec (permissions.md)
- **DOC-029** activity event types (Features.md)
- **DOC-036** OKTA env var bug (oauth2-oidc.md)
- These don't share a file, so each is its own commit but they theme as "critical content-accuracy fixes."

**Batch: continuation on `odd-platform.md` (non-critical, same file)** — shipped 2026-04-24 on `feature/docs-odd-platform-config`, all 5 items review-ready. See the "2026-04-24 odd-platform.md config batch" section above for per-item summaries, Sources footers, live-site URLs, and the PLT-002 upstream issue draft filed during DOC-019's consumer-read audit.

**Unblocked audit work:**
- `findings/docs-quality-rendering/2026-04-22.md` — F-R01 (8 orphan files) + F-R03 (SUMMARY.md escaping) still un-triaged (F-R02 is subsumed by DOC-053 which is done).
- Complete `docs/quality/rendering` scan (33 of 37 pages still unscanned).

**Recommended next:** wait for the critical-config batch PR to merge, run live-site verification, then pick up the critical content-accuracy batch (DOC-027 / 037 / 029 / 036) — four critical items across four files, good size for a single batch PR.

### 2026-04-23 content-accuracy batch (DOC-027 + DOC-028)

`feature/docs-accuracy-features-fixes` on `documentation` repo — 3 commits:

- `dc70138 docs: replace Pandas claim with actual DQ integrations [DOC-027]` — `Features.md:98` (Data Quality Test Results Import) and `dq_visibility.md` rewrite. Replaces "Pandas" / "Pandas Profiling" with the accurate set (Great Expectations, dbt tests, odd-collector-profiler powered by Capital One DataProfiler) + custom-framework pointer at `POST /ingestion/entities/datasets/stats`. Consumer-read: `odd-collector-profiler/pyproject.toml:18`, `opendatadiscovery-specification/specification/odd_api.yaml:27`.
- `8a62bac docs: fix SLA URL placeholder (dataset_id → data_entity_id) [DOC-028]` — `Features.md:260`. Placeholder corrected to match the OpenAPI spec + platform `SLACalculator` path template. Consumer-read: `odd-platform/odd-platform-specification/openapi.yaml:1880,1898`, `odd-platform-api/.../service/sla/SLACalculator.java:64`.
- `d82559e docs: fix wrong dbt link target in DOC-027 edit [DOC-027]` — post-review user-caught fix. `[dbt tests]` link retargeted from `odd-collectors` to `odd-dbt` in both `Features.md:98` and `dq_visibility.md:7`; both references now explicitly tag GE and dbt as "push-clients". Evidence: `odd-dbt/README.md` (CLI tool ingests dbt tests to platform), `docs/developer-guides/github-organization-overview.md:47` (separate repo listing), `docs/main-concepts.md:20,36` (push-client architecture names dbt alongside Airflow/Spark/GE).

Live URLs for `/review`:

- `https://docs.opendatadiscovery.org/features#data-quality-test-results-import` (DOC-027)
- `https://docs.opendatadiscovery.org/features#dataset-quality-statuses-sla` (DOC-028)
- `https://docs.opendatadiscovery.org/dq_visibility` (DOC-027)

No follow-ups surfaced during the consumer-read audit on this batch — both items are prose / spec-alignment fixes with no SDK integration to audit (Gate 5 N/A). DOC-027 content changed after initial `/review` signoff (the dbt-link fix on `d82559e`) — it needs a re-run of `/review DOC-027` before Gate 8 can be assessed alongside the live-site verification.
