# Progress Dashboard

Last updated: 2026-04-23 — Pipeline hardening landed on `feature/pipeline-hardening` (commit `96b28c4`) after a spot-check uncovered a silent data-loss caveat in the DOC-008 batch that the old bar had passed. The Implementation Quality Bar now has eight gates, two of which (Consumer-read #4, Unset-parameter audit #5) are new and require cited evidence. Work-item lifecycle now includes `review-ready` between `in-progress` and `done`; the implementer cannot self-close. `/review` runs in a separate session. Phase B re-audit of DOC-005/006/008/018 under the new bar surfaced 4 missed caveats (2 in-scope amendments + 2 new backlog items DOC-059/060). Phase C (re-audit of all older done items) is the next standing obligation before any new `/implement` batch may start.

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
| DOC | 45 | 0 | 0 | 13 | 0 | 2 | 60 |
| TST | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| NAV | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SPC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **45** | **0** | **0** | **13** | **0** | **2** | **60** |

Notes on counts: DOC pending increased by 2 (DOC-059 session-provider caveats, DOC-060 third base-url consumer — both discovered by the 2026-04-23 re-audit). The `review-ready` column is zero here because the DOC-005/006/008/018 flips live on `batch/critical-odd-platform-config-state`, which has not merged yet — after that branch merges, main's Done will drop by 4 and Review-Ready will rise by 4 until `/review` runs in a separate session.

### 2026-04-23 pipeline hardening (Phase A) + re-audit (Phase B)

On 2026-04-23 a user spot-check uncovered that `MinioConfig.java` never calls `.region(...)` on the MinIO builder, silently locking attachment storage to `us-east-1`. The miss had shipped on `feature/critical-odd-platform-config` with DOC-008 marked `done`. Root cause: the old Quality Bar stated "verify every functional claim against the code" as a principle but not as a testable gate. Scanners read `application.yml`; they did not read `@Value` consumers or SDK builders.

**Phase A** (commit `96b28c4` on `feature/pipeline-hardening`): rewrote CLAUDE.md (new "The project and the maintainer" attitude section, Quality Bar expanded from six principles to eight gates, two new gates Consumer-read and Unset-parameter audit, workflow ends at `review-ready` not `done`). Updated `scanners/docs/accuracy/config-options.md` and `feature-behavior.md` with consumer-code / SDK audit passes. Created `scanners/docs/accuracy/integration-caveats.md` as a dedicated SDK-builder-audit scanner. Updated `.claude/skills/implement/SKILL.md` (consumer-read audit gate, mandatory `Consumer-read:` commit footer, Phase 2 ends at `review-ready`) and rewrote `.claude/skills/review/SKILL.md` (separate-session requirement, reject-by-default, eight-gate checklist, concrete DOC-008 FAIL example). Updated `backlog/README.md` lifecycle.

**Phase B** (same branch): re-audited DOC-005/006/008/018 under the new bar. Findings in `findings/docs-accuracy-integration-caveats/2026-04-23-reaudit-critical-odd-platform-config.md`:
- **F-CAV-001 (DOC-005 in-scope)** — `JavaMailSenderImpl` leaves SMTP connect/read/write timeouts unset (infinite default), no implicit-TLS support, no self-signed CA hook, no charset; `EmailNotificationSender.send()` silently aborts recipient loop on first failure. **Severity: high.** Ship as PR amendment.
- **F-CAV-002 (DOC-008 in-scope)** — `MinioAsyncClient.builder()` leaves `.httpClient(...)` unset (5-min MinIO-SDK-default timeouts); `RemoteFileUploadServiceImpl.completeFileUpload` stages chunks on local filesystem before REMOTE upload (K8s restart mid-upload loses chunks — same data-loss class as the LOCAL warning already in DOC-008); no retry on transient MinIO/S3 failures. **Severity: high.** Ship as PR amendment.
- **F-CAV-003 (new DOC-059)** — session-provider caveats: IN_MEMORY no eviction beyond TTL, INTERNAL_POSTGRESQL housekeeping hardcoded to 1 hour, REDIS requires undocumented `spring.data.redis.*` keys. **Severity: medium.** New backlog item.
- **F-CAV-004 (new DOC-060)** — third `odd.platform-base-url` consumer `StaticArgumentMappingContext.java:16` has a **different default** (`http://your.odd.platform` vs notifications' `http://localhost:8080`) and is undocumented. **Severity: medium.** New backlog item.

**Phase C obligation**: every `done` item closed before 2026-04-23 was self-closed by the implementer. Finding density in Phase B (4 missed caveats across 4 items) is the prior — treat all 13 done items as candidates for re-audit until each passes `/review` under the new bar.

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

Totals across all 4 triaged scanners + discovered work: **11 critical, 19 high, 27 medium** (57 items; 58 including done DOC-052, minus 2 rejected = 56 actionable; 12 already done).

### Triage complete for all 4 completed scanners

Ready for human review of priority ordering before implementation begins (per `backlog/README.md` review gate). Next actions after review:
- Pick priority ordering (suggested: critical → high → medium)
- Kick off implementation via `/implement DOC-NNN`
- OR continue audit phase: enumerate one of the 22 remaining scanners

## Current Status

Phase: **Audit In Progress** — 4 scanners complete, 1 in progress, 22 remaining. All triage complete for completed scanners (56 DOC items). Ready for human review of the backlog.

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

Two batches shipped in sequence: the docs-quality cleanup (DOC-052..057) and the authoring-hygiene sweep (DOC-058). Remaining candidates for the next `/implement` batch, grouped by theme:

**Batch: critical odd-platform config (serialize on `odd-platform.md`, all critical)**
- **DOC-005** email config key names + missing keys
- **DOC-006** SESSION_PROVIDER default
- **DOC-008** attachment storage warning (user-reported data loss risk)
- **DOC-027** DataProfiler / Pandas claim fix (Features.md + dq_visibility.md)
- **DOC-037** regenerate permissions list from OpenAPI spec
- All under the new pre-authoring sweep protocol. DOC-005/006/008 share `odd-platform.md` — implement sequentially on one batch branch.

**Unblocked audit work:**
- `findings/docs-quality-rendering/2026-04-22.md` — F-R01 (8 orphan files) + F-R03 (SUMMARY.md escaping) still un-triaged (F-R02 is subsumed by DOC-053 which is done).
- Complete `docs/quality/rendering` scan (33 of 37 pages still unscanned).

**Recommended next:** open the critical `odd-platform.md` config batch (DOC-005 / 006 / 008 serialized) — user-facing data-loss risk on DOC-008 makes it the highest-value chunk left. Alternative: triage the remaining two `docs/quality/rendering` findings (F-R01 orphan files + F-R03 SUMMARY escaping) for a quick-win next batch while the doc PR for DOC-058 is in review.
