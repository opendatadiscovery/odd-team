# Sprint-close ontology finalisation — 9 batches (ZD–ZL)

**Branch:** `feature/ontology-finalize-2026-05-25`
**Compare URL:** https://github.com/opendatadiscovery/odd-team/compare/main...feature/ontology-finalize-2026-05-25?expand=1
**Suggested PR title:** `ontology sprint-close — 40 sidecars / 11 features / 209→97.7% effective (ZD-ZL)`

## Summary

This PR finalises the rev-2 agentic-ontology sprint that began with the 2026-05-19 batch H seed. Nine autonomous batches (ZD–ZL) ran end-to-end under `/loop /next-batch`, each producing 5 file-analyser sidecars + 5 reducer artefacts (concepts + ADRs + refactor-scopes + doc-gaps + test-gaps + feature-flows).

**Coverage shift (substrate denominator 395):**
- Direct enrichment: 169 → **209 sidecars (+40 net)** = 42.8% → **52.9%**
- Effective coverage (substrate touched by any sidecar OR feature-flow): 82.0% → **97.7%**

**Feature-flow growth:**
- Features discovered: 32 → **43** (+11 new pillar-anchored features)
- New features minted this sprint: F-033 Integration Wizard / F-034 Platform Feature-Flag Exposure / F-035 Operator-Configured Additional Links / F-036 Owner-Relationship Title Directory / F-037 ERD-Graph Relationships (first P-02 feature) / F-038 Data Collaboration / F-039 GenAI Assistant / F-040 DQ Test Run History / F-041 Application Toolbar / F-042 Page-level UI Error Display / F-043 Multilingual UI

**Finding deltas:**
- Implicit ADRs: 208 → **247** (+39 new; 16 strengthened)
- Refactoring scopes: 591 → **720** (+129 new)
- Doc-gaps: 272 → **318** (+46 new)
- Test-gaps: 854 → **1036** (+182 new; CRITICAL 144 → 168; +24)
- Probe-skeletons: 104 new (P-090 → P-194)

## Headline architectural findings

1. **No React error boundary anywhere in the SPA** (ZJ AppErrorPage) — repo-wide grep returns zero matches for `componentDidCatch|ErrorBoundary|getDerivedStateFromError`. Any uncaught render exception blanks the whole UI. TEST-GAP-1013 CRITICAL + REFACTOR-685 HIGH.

2. **`WithPermissionsProvider` is context-seed-only, NOT a route gate** (ZH–ZL) — 14-sidecar triangulation. Operator mental-model "wrapped routes are protected" is wrong across 11+ route-mount sites in 3 pillars. DOC-GAP-302 META.

3. **REFACTOR-185 → 24-sidecar (strongest single triangulation)** — DISABLED-mode bypass family. Anonymous-fingerprint kill chain via /whoami → admin literal + every Permission enum value + Logout 404 + EventApi forgeable webhook + IntegrationWizard internal-hostname leak + ToolbarTabs 9-tabs-for-everyone.

4. **EventApiController Slack webhook unauth + unsigned + undeduplicated** (ZF) — internet-reachable forgeable replayable webhook. Default deployment ships with `/api/slack/events` open to any internet caller in all 4 auth modes with NO `X-Slack-Signature` verification and NO idempotency on Slack's at-least-once delivery. TEST-GAP-959/960/961 CRITICAL trio.

5. **TRUE SQL injection at SearchController.highlightDataEntity** (ZE) — `String.formatted(text, tsQuery)` direct interpolation into raw SQL at `ReactiveDataEntityRepositoryImpl.java:798-806`. First HTTP-entry confirmation for REFACTOR-229 FTS-injection family. TEST-GAP-946 CRITICAL.

6. **F-006 audit-silence pattern → 11-sidecar at controller-class tier** (ZF) — every RBAC mutation controller forensically silent at line:1-N. Schema-rooted via V0_0_48 NOT NULL FK.

7. **LSN-019 dashboard fire** (ZG DataQualityRunsController) — `getDataQualityTestsRuns` named "runs" but counts TESTS by latest-run status. Dashboard flagship indicator semantically diverges from name. DOC-GAP-297 HIGH.

8. **LSN-020 i18n channel** (ZJ en.json) — Activity User-filter label "performed by" drift binds USER_OWNER_MAPPING.OWNER_ID; same drift shipped uniformly to all 6 locales via natural-keys fallback. 14+ code-referenced keys absent from every locale.

9. **DatasetFieldController TWO SecurityConstants copy-paste wiring bugs** (ZG) — `POST /api/datasetfields/{id}/terms` gated by `DATA_ENTITY_ADD_TERM` (wrong); `PUT /api/alerts/{id}/status` mis-gated on `DATASET_FIELD_ADD_TERM`. Static visible code defects.

10. **LDAP password unmasked + no LDAPS + adminGroups substring collision** (ZK ODDLDAPProperties) — admin escalation class. Password field has Lombok `@Data` toString that leaks. AD pairing has no `domain` validation.

## Methodology improvements landed this sprint

- **rev-7.1 graph-search dedup operational across all 9 batches** — reducers no longer grep indexes; semantic vector retrieval against `detail/` corpora.
- **SKILL slimmed Phase 3** (commit `b8c5dd1`) — dropped `rebuild_indexes.py all` and the `index-batch-*-append.md` merge step. Index files (`concepts/index.yaml`, `test-map/index.yaml`, `feature-flows/index.yaml`, registry `index.md` aggregates) are decommissioned as drift-generating denormalisation. `detail/` is now the sole canonical source.
- **LSN-018 phantom-prevention fired and was load-bearing** — caught `MasterData.tsx` (ZL), `LoginForm.tsx` (Q), `LineageInteractive.tsx` (ZA), Term/Tag/Role/Owner list components (Q), MS Teams sender (Y), `feature/ontology-finalize-2026-05-20` legacy hardcode in SKILL (cleaned to read from `policy.push_target_branch`).
- **Graph dry-run mid-sprint** confirmed 20/20 random nodes verified against ground truth; `skipped_files=10` all explained (broken-yaml quarantines + 1 off-convention filename + 1 unrecognised sidecar shape).

## What's NOT in this PR (deferred follow-ups)

1. **1 Rule-6 CONTRADICTS surfaced** (state/coherence-conflicts-batch-ZK.md) — ODDLDAPProperties substring-collision claim vs auth-mode-quartet full-string-equality on `OperationUtils.containsIgnoreCase`. Needs primary-source pin.
2. **16 unfixable YAML quarantines** persistent (5 concepts + 2 test-map + 8-9 batch-churn). `yaml_safe_fix.py` keeps failing to recover them.
3. **No probe-runner executions** — 104 new probe-skeletons enqueued; runtime validation deferred to a probe sprint.
4. **No new ADRs promoted** — 247 implicit-ADR candidates; the maintainer-curated `adrs/` directory unchanged this sprint.

## Trace artefacts

- Per-batch trace files: `state/batch-{ZD..ZL}-trace.yaml`
- Coherence sweeps: `state/coherence-sweep-batch-{ZD..ZL}.md` (regex-noise baseline — non-blocking)
- 1 Rule-6 conflict logged: `state/coherence-conflicts-batch-ZK.md`
- Investigator log: `lineage/odd-platform/investigator-log.md` (final 9 entries are ZD-ZL)
- 29 commits on the branch / 762 files changed (+114,912 / -5,456)

## Test plan

This PR contains only ontology/sidecar additions — no functional code changes. Verification:
- [ ] `python3 lineage/_extractor/registry-shard/yaml_safe_fix.py` reports `unfixable: 16` (all pre-existing quarantines)
- [ ] `python3 lineage/_extractor/registry-shard/coverage.py --write-manifest` reports direct≥52.9%, effective≥97.7%, features=43
- [ ] `lineage/_extractor/.venv/bin/lineage-extractor graph-build odd-platform` reports `embeddings_available=True vectors≥5797`, `skipped_files=10`
- [ ] Spot-check the 5 Phase-1 sidecars per batch: each carries `stress_findings` block + `confidence_per_field` + file:line citations
- [ ] Review the 1 Rule-6 CONTRADICTS in state/coherence-conflicts-batch-ZK.md for primary-source pin

## Commits (29 total)

See `git log --oneline main..feature/ontology-finalize-2026-05-25` — each batch follows the pattern `{lock} → {batch} → {done}` (3 commits/batch).
