# Progress Dashboard

Last updated: 2026-04-23 — **DOC-063 review-ready** on `feature/docs-canonical-vocabulary` (documentation) + `feature/docs-canonical-vocabulary-state` (odd-team bookkeeping). Seeds the canonical vocabulary (Adapter / Plugin / Collector / Push adapter) into `docs/main-concepts.md` so DOC-042 (Integrations hub) and DOC-062 (tree-wide sweep) can reference it as SoT.

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
| DOC | 41 | 0 | 3 | 17 | 0 | 2 | 63 |
| TST | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| NAV | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| SPC | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **41** | **0** | **3** | **17** | **0** | **2** | **63** |

Notes on counts: DOC-005/006/008/018 flipped `review-ready` → `done` on 2026-04-23 after `/review` verified all eight Quality Bar gates in a session separate from the implementer. Per-item verdicts appended to each backlog file; the common thread across the four reviews is PASS on Gates 1–8 (Gate 8 confirmed via live-site fetch of `docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` — no GitHub fallback URLs, all in-scope admonitions rendered). Two follow-up items discovered by the re-audit (`DOC-059` session-provider caveats, `DOC-060` third `odd.platform-base-url` consumer) remain `pending` and are tracked for future triage.

On 2026-04-23 the Phase C `/review` pass (separate session) flipped all 13 review-ready items → `done`: DOC-001, 003, 013, 029, 035, 036, 052, 053, 054, 055, 056, 057, 058. Per-item verdicts appended to each backlog file with cited evidence per Quality Bar gate. One Gate-6 follow-up was logged on disk during the review: **DOC-061** (pending, high) — Azure AD `logout-uri` documentation gap (consumer: `AzureLogoutSuccessHandler.java:30-48`; NPE without it). Pending count rises 41 → 42 from this addition; review-ready 13 → 0; done 4 → 17; total 60 → 61.

On 2026-04-23 Phase C flipped 13 older self-closed done items to `review-ready`: DOC-001, 003, 013, 029, 035, 036, 052, 053, 054, 055, 056, 057, 058. Each carries a `## Re-Audit (2026-04-23)` section with per-gate evidence. Two items (DOC-001, DOC-013) required in-scope amendments: DOC-013 added four caveat admonitions to `collectors-secrets-backend.md`, DOC-001 fixed the Azure admin-groups claim default description on `oauth2-oidc.md`. Amendments shipped on `feature/phase-c-reaudit-amendments` (documentation). The remaining 11 items passed without amendment; most are small cross-reference or hygiene items, the two feature items (DOC-003 S2S, DOC-029 activity events) were verified against current consumer code with no drift.

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
| odd-platform | 1 | 0 | 0 | 0 | 1 |
| odd-collectors | 1 | 0 | 0 | 0 | 1 |
| **Total** | **2** | **0** | **0** | **0** | **2** |

### Active drafts

- **PLT-001** (bug, low severity) — Defensive null handling in `S2sTokenProvider.isValidToken`. Discovered during `/review` of DOC-003 (2026-04-23). Unreachable NPE path under normal deployment because the S2S filter is conditionally registered; but the method is `public` and a 1-line `StringUtils.isBlank(s2sToken)` guard closes it permanently. Doc-side: no caveat needed; DOC-003 already describes the feature correctly. Draft at `issues/odd-platform/PLT-001.md`.
- **COL-001** (bug, high severity) — AWS SSM secrets backend silently truncates plugin parameters at 10. `_get_secrets_by_prefix` does a single `get_parameters_by_path` call with no paginator; default `MaxResults=10` drops every plugin beyond the first ten with no error and no log warning. Production-critical for any collector with >10 plugins. Doc-side caveat already shipped under DOC-013 ("Known limitations" admonition). Draft at `issues/odd-collectors/COL-001.md`.

## Current Status

Phase: **Audit In Progress + content-accuracy batch Gates 1–7 signed off, Gate 8 deferred pending merge** — 4 scanners complete, 1 in progress, 22 remaining. 17 DOC items `done`; DOC-027 + DOC-028 remain `review-ready` with a 2026-04-23 `/review` verdict attached (ACCEPTED WITH DEFERRAL on Gate 8 until the PR merges into `documentation` main and GitBook rebuilds). Next critical candidate after this batch closes out is DOC-037 (regenerate permissions list from OpenAPI spec).

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

**Batch: continuation on `odd-platform.md` (non-critical, same file)**
- **DOC-007** metrics config
- **DOC-009** housekeeping TTL
- **DOC-010** odd.* top-level
- **DOC-011** spring.session.timeout / spring.codec.max-in-memory-size
- **DOC-019** AlertManager endpoint reference
- Natural follow-on once the critical batch merges — one file, sequential commits.

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
