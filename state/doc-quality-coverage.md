# Doc-quality coverage dashboard

> **What this is.** The audit-coverage record for the documentation pillar's twelve-axis quality framework (`pillars/documentation/quality-framework.md`). One row per `documentation/docs/**/*.md` page; one column per page-readable axis (A1-A10, A11-forward, A12). Cell values: `✓` (PASS), `✗(DOC-NNN)` (FAIL with link to the follow-up), `—` (N/A for this page; e.g. `SUMMARY.md` is exempt from most axes), or empty (not yet audited).

> **How this is updated.** Every `/review` invocation runs the per-page audit on every page touched by the batch + a rotating sample of one un-audited page (when the framework's baseline is in progress). The reviewer updates the corresponding rows at the end of the audit. Empty rows stay empty until they are audited; the "audited %" metric below treats empty rows as un-audited (not as PASS).

## Headline metrics

- **Per-page coverage**: 20 / 60 pages audited (33%).
- **Per-axis pass rate** (over audited cells, excluding N/A):
  - A1 17/19 (89%) — 2 FAILs (DOC-099, DOC-103)
  - A2 19/20 (95%) — 1 FAIL (DOC-114)
  - A3 17/19 (89%) — 2 FAILs (DOC-099, DOC-108)
  - A4 14/20 (70%) — 6 FAILs (DOC-094, DOC-095, DOC-096, DOC-101, DOC-103, DOC-108, DOC-110, DOC-111)
  - A5 20/20 (100%)
  - A6 7/7 (100%) — 13 N/A
  - A7 18/20 (90%) — 2 FAILs (DOC-103, DOC-105+DOC-107)
  - A8 19/20 (95%) — 1 FAIL (DOC-099)
  - A9 14/15 (93%) — 1 FAIL (DOC-109) — 5 N/A
  - A10 19/20 (95%) — 1 FAIL (DOC-103)
  - A11f 20/20 (100%)
  - A12 16/20 (80%) — 4 FAILs (DOC-103, DOC-111, DOC-113)
- **Open FAILs** (DOC items linked from cells): 14 distinct items (DOC-094, DOC-095, DOC-096, DOC-099, DOC-100, DOC-101, DOC-102, DOC-103, DOC-105, DOC-107, DOC-108, DOC-109, DOC-110, DOC-111, DOC-113, DOC-114, DOC-115).
- **Code-side coverage** (A11-reverse): not yet started.
- **Last audit run**: 2026-05-03 (baseline run #1 — 20 pages from entry surfaces + aspect landings + 5 config-deployment pages).

## Per-page audit cells

Twelve columns per page:
- **A1** Canonical-home discipline
- **A2** Intra-page coherence
- **A3** Cross-page coherence
- **A4** Reference integrity
- **A5** Claim provenance
- **A6** Operator depth
- **A7** Reader-flow integrity
- **A8** Vocabulary consistency
- **A9** Audience completeness
- **A10** IA placement
- **A11f** Bidirectional code↔doc fidelity (forward only — reverse is in the code-side sweep)
- **A12** Prose and rendering

| Page | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9 | A10 | A11f | A12 | Overall | Audited |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| docs/README.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✗(DOC-103) | FAIL | 2026-05-03 |
| docs/SUMMARY.md | ✓ | ✓ | — | ✓ | — | — | ✓ | ✓ | — | ✓ | — | ✓ | PASS | 2026-05-03 |
| docs/Overview.md | ✗(DOC-103) | ✓ | ✗(DOC-103) | ✗(DOC-103) | ✓ | — | ✗(DOC-103) | ✓ | — | ✗(DOC-103) | ✓ | ✗(DOC-103) | FAIL | 2026-05-03 |
| docs/Architecture.md | ✗(DOC-099+DOC-115) | ✓ | ✗(DOC-099) | ✓ | ✓ | — | ✓ | ✗(DOC-099) | — | ✗(DOC-099) | ✓ | ✓ | FAIL | 2026-05-03 |
| docs/main-concepts.md | ✗(DOC-114+DOC-115) | ✗(DOC-114) | ✗(DOC-099) | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | FAIL | 2026-05-03 |
| docs/Features.md | ✓ | ✓ | ✓ | ✗(DOC-094,095,096,101,110) | ✓ | ✓ | ✓ | ✓ | ✗(DOC-109) | ✓ | ✗(DOC-109) | ✗(DOC-113) | FAIL | 2026-05-03 |
| docs/oddrn.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/quick_start.md | | | | | | | | | | | | | | |
| docs/platform.md | | | | | | | | | | | | | | |
| docs/Use_cases.md | ✓ | ✓ | ✓ | ✗(DOC-107) | ✓ | — | ✗(DOC-107) | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | 2026-05-03 |
| docs/dc_data_compliance.md | | | | | | | | | | | | | | |
| docs/Data_Compliance_DS.md | | | | | | | | | | | | | | |
| docs/de_deprecation.md | | | | | | | | | | | | | | |
| docs/dq_visibility.md | | | | | | | | | | | | | | |
| docs/viz_preparation.md | | | | | | | | | | | | | | |
| docs/service_presales.md | | | | | | | | | | | | | | |
| docs/genai.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/directory.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/data-modelling.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/data-modelling/query-examples.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/data-modelling/relationships.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/master-data-management.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/master-data-management/lookup-tables.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/configuration-and-deployment/deployment.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/configuration-and-deployment/trylocally.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗(DOC-113) | FAIL | 2026-05-03 |
| docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md | ✓ | ✓ | ✓ | ✗(DOC-111) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗(DOC-111) | FAIL | 2026-05-03 |
| docs/configuration-and-deployment/odd-platform.md | ✓ | ✗(DOC-102) | ✗(DOC-108) | ✗(DOC-108) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | 2026-05-03 |
| docs/configuration-and-deployment/collectors-secrets-backend.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/configuration-and-deployment/enable-security/README.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authentication/README.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authentication/disabled-authentication.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authentication/login-form.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authentication/oauth2-oidc.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authentication/ldap.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authentication/s2s.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authorization/README.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authorization/policies.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authorization/permissions.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authorization/roles.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authorization/owners.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/enable-security/authorization/user-owner-association.md | | | | | | | | | | | | | | |
| docs/developer-guides/api-reference.md | | | | | | | | | | | | | | |
| docs/developer-guides/how-to-contribute.md | | | | | | | | | | | | | | |
| docs/developer-guides/github-organization-overview.md | | | | | | | | | | | | | | |
| docs/developer-guides/custom-collectors.md | | | | | | | | | | | | | | |
| docs/developer-guides/build-and-run/README.md | | | | | | | | | | | | | | |
| docs/developer-guides/build-and-run/build-and-run-odd-platform.md | | | | | | | | | | | | | | |
| docs/developer-guides/build-and-run/build-and-run-odd-collectors.md | | | | | | | | | | | | | | |
| docs/integrations/README.md | | | | | | | | | | | | | | |
| docs/integrations/integration-wizard.md | | | | | | | | | | | | | | |
| docs/integrations/collectors/odd-collector.md | | | | | | | | | | | | | | |
| docs/integrations/collectors/odd-collector-aws.md | | | | | | | | | | | | | | |
| docs/integrations/collectors/odd-collector-azure.md | | | | | | | | | | | | | | |
| docs/integrations/collectors/odd-collector-gcp.md | | | | | | | | | | | | | | |
| docs/integrations/collectors/odd-collector-profiler.md | | | | | | | | | | | | | | |
| docs/integrations/push-adapters/odd-airflow-2.md | | | | | | | | | | | | | | |
| docs/integrations/push-adapters/odd-dbt.md | | | | | | | | | | | | | | |
| docs/integrations/push-adapters/odd-spark-adapter.md | | | | | | | | | | | | | | |
| docs/integrations/push-adapters/odd-great-expectations.md | | | | | | | | | | | | | | |
| docs/integrations/push-adapters/odd-cli.md | | | | | | | | | | | | | | |

Total: 60 pages (excluding `.gitbook/includes/auth-type-oauth2-oa....md` which is a GitBook editor include fragment, not a published page).

## Code-side coverage sweep (axis A11-reverse)

Each row is a code-feature catalogue from axis A11's reverse audit cue. Columns are the audience surfaces the catalogue's features may warrant.

| Catalogue | Repo | User-facing | Operator-facing | Developer-facing | Last sweep |
|---|---|---|---|---|---|
| `@RestController` / `@Controller` | odd-platform | | | | not yet swept |
| `@Configuration` + `@Bean` factories | odd-platform | | | | not yet swept |
| `@Value` / `@ConfigurationProperties` consumers | odd-platform | | | | not yet swept |
| `@Scheduled` jobs | odd-platform | | | | not yet swept |
| Security configurations | odd-platform | | | | not yet swept |
| SDK client builders (MinioAsyncClient, JavaMailSender, WebClient, …) | odd-platform | | | | not yet swept |
| Collector adapter registries (`PLUGIN_FACTORY` per repo) | odd-collectors | | | | not yet swept |
| Push adapter entry-points | odd-airflow-2, odd-dbt, odd-spark-adapter, odd-great-expectations, odd-cli | | | | not yet swept |

Cell legend for the code-side table: `✓` (every code-feature in this catalogue has an entry on this surface), `✗(N undocumented)` (count of features missing on this surface; each missing one logged as a DOC-NNN), `—` (catalogue not relevant for this surface).

## Open FAILs from prior reactive audits + first baseline

These DOC items predate or were surfaced during the framework's first baseline. Each is anchored to its primary axis(es) below.

| DOC-NNN | Axis(es) | Page | Priority | Status |
|---|---|---|---|---|
| DOC-088 | A1 | docs/developer-guides/api-reference.md | high | pending |
| DOC-094 | A4 | docs/Features.md | high | review-ready |
| DOC-095 | A4 | docs/Features.md | high | review-ready |
| DOC-096 | A4 | docs/Features.md | high | review-ready |
| DOC-097 | A1 | (4 orphan pages — superseded by DOC-103/104/105/106) | medium | pending |
| DOC-098 | A4 + A12 | docs/developer-guides/github-organization-overview.md | medium | pending |
| DOC-099 | A1 + A3 + A8 + A10 | docs/Architecture.md | medium | pending; blocked by DOC-115 |
| DOC-100 | A12 | docs/configuration-and-deployment/odd-platform.md | low | review-ready |
| DOC-101 | A4 | (4 pages with Slack URLs) | low | review-ready |
| DOC-102 | A2 + A4 | docs/integrations/integration-wizard.md, docs/configuration-and-deployment/odd-platform.md | high | pending |
| DOC-103 | A1 + A3 + A4 + A7 + A10 + A12 | docs/Overview.md | medium | pending |
| DOC-104 | A1 | docs/Data_Compliance_DS.md | low | pending |
| DOC-105 | A7 | docs/quick_start.md | high | pending |
| DOC-106 | A1 | docs/platform.md | low | pending |
| DOC-107 | A4 + A7 | docs/Use_cases.md | medium | pending |
| DOC-108 | A3 + A4 | docs/configuration-and-deployment/odd-platform.md | high | pending |
| DOC-109 | A9 + A11f | docs/Features.md (and 8+ cross-references) | medium | pending |
| DOC-110 | A4 | docs/Features.md | medium | pending |
| DOC-111 | A4 + A12 | docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md | high | pending |
| DOC-112 | A12 | docs/developer-guides/github-organization-overview.md | low | pending |
| DOC-113 | A12 | (cross-page batch — 13 files) | low | pending |
| DOC-114 | A2 | docs/main-concepts.md | high | pending; blocked by DOC-115 |
| **DOC-115** | **A1** (canonical-home decision) | **docs/main-concepts.md + docs/Architecture.md** | **high** | **NEW — baseline-audit finding** |

## Audit history

| Date | Run label | Pages audited | New FAILs logged | Notes |
|---|---|---|---|---|
| 2026-05-03 | framework-codification | 0 | 0 | Framework written; dashboard scaffolded; no per-page cells filled this run. |
| 2026-05-03 | baseline-run-1 | 20 | 1 (DOC-115) | First baseline. Entry surfaces (7) + Use_cases.md + aspect landings (7: data-modelling, query-examples, relationships, master-data-management, lookup-tables, directory, genai) + 5 configuration-and-deployment pages (deployment, trylocally, EKS quick-launch, odd-platform, collectors-secrets-backend). Most aspect/feature/integration pages PASS — they were authored under the world-class bar already. Findings concentrate on entry surfaces (parallel-surface drift, sparse Architecture.md, 4× redundancy on main-concepts.md, half-finished orphans) and one heavy operator page (odd-platform.md hyphenated env-vars). DOC-115 newly surfaced: canonical-home decision between main-concepts.md and Architecture.md that DOC-114 + DOC-099 both depend on. 40 pages remain un-audited (use-case sub-pages + enable-security subtree + developer-guides + integrations); next baseline run continues. |
