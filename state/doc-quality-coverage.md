# Doc-quality coverage dashboard

> **What this is.** The audit-coverage record for the documentation pillar's twelve-axis quality framework (`pillars/documentation/quality-framework.md`). One row per `documentation/docs/**/*.md` page; one column per page-readable axis (A1-A10, A11-forward, A12). Cell values: `✓` (PASS), `✗(DOC-NNN)` (FAIL with link to the follow-up), `—` (N/A for this page; e.g. `SUMMARY.md` is exempt from most axes), or empty (not yet audited).

> **How this is updated.** Every `/review` invocation runs the per-page audit on every page touched by the batch + a rotating sample of one un-audited page (when the framework's baseline is in progress). The reviewer updates the corresponding rows at the end of the audit. Empty rows stay empty until they are audited; the "audited %" metric below treats empty rows as un-audited (not as PASS).

## Headline metrics

- **Per-page coverage**: 42 / 58 pages audited (72%) — `platform.md` and `Data_Compliance_DS.md` removed from denominator after DOC-106 + DOC-104 deletions shipped this run.
- **Per-axis pass rate** (over audited cells, excluding N/A):
  - A1 39/39 (100%) — DOC-097's `platform.md` + `Data_Compliance_DS.md` rows retired with DOC-106 + DOC-104 closed this run; DOC-099, DOC-103 still open on Architecture.md + Overview.md.
  - A2 41/42 (98%) — 1 FAIL remaining (DOC-114) — DOC-102 closed this run.
  - A3 39/40 (98%) — 1 FAIL remaining (DOC-099) — DOC-108 closed this run.
  - A4 38/42 (90%) — 4 FAILs remaining (DOC-117 on Features.md + lookup-tables.md, DOC-107 on Use_cases.md, DOC-103 on Overview.md, DOC-109 on Features.md/cross-references) — DOC-098, DOC-102, DOC-108, DOC-110, DOC-111, DOC-116, DOC-120 closed this run.
  - A5 42/42 (100%)
  - A6 13/13 (100%) — 29 N/A (developer-facing pages without operator-relevant claims)
  - A7 40/42 (95%) — 2 FAILs remaining (DOC-105 on quick_start.md, DOC-103 on Overview.md, DOC-107 on Use_cases.md) — DOC-118 + DOC-122 closed this run.
  - A8 41/42 (98%) — 1 FAIL (DOC-099)
  - A9 22/23 (96%) — 1 FAIL (DOC-109) — 19 N/A (single-audience pages)
  - A10 41/42 (98%) — 1 FAIL (DOC-103)
  - A11f 42/42 (100%)
  - A12 39/42 (93%) — 3 FAILs remaining (DOC-103 on Overview.md, DOC-117 on lookup-tables.md image-host fragility, DOC-124 on use-case subtree prose-polish residue) — DOC-111, DOC-112, DOC-113, DOC-119, DOC-121 closed this run.
- **Open FAILs** (distinct DOC items linked from cells): 13 items (DOC-088 — pending; DOC-097 — partially closed by DOC-104+DOC-106 this run, DOC-103+DOC-105 still open; DOC-099, DOC-103, DOC-105, DOC-107, DOC-109, DOC-114, DOC-115, DOC-117, DOC-123 — pending; DOC-124 — newly logged this run). **Closed this run** (16 items + 5 from prior batch closeout per dashboard): DOC-089, DOC-098, DOC-102, DOC-104, DOC-106, DOC-108, DOC-110, DOC-111, DOC-112, DOC-113, DOC-116, DOC-118, DOC-119, DOC-120, DOC-121, DOC-122 (this batch's 16). DOC-094, DOC-095, DOC-096, DOC-100, DOC-101 closed in the prior `feature/docs-editorial-audit-closeout` batch.
- **Code-side coverage** (A11-reverse): not yet started.
- **Last audit run**: 2026-05-04 (post-merge audit run #3 — `feature/docs-fidelity-batch` 16 items closed + DOC-124 newly logged from use-case-subtree editorial read).

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
| docs/Features.md | ✓ | ✓ | ✓ | ✗(DOC-117) | ✓ | ✓ | ✓ | ✓ | ✗(DOC-109) | ✓ | ✗(DOC-109) | ✓ | FAIL | 2026-05-04 (post-fidelity-batch re-audit; DOC-110, DOC-113, DOC-116 closed) |
| docs/oddrn.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/quick_start.md | | | | | | | | ✗(DOC-105) | | | | ✗(DOC-105) | FAIL | DOC-105 already logged; full per-axis read deferred to its implementation pass |
| ~~docs/platform.md~~ | — | — | — | — | — | — | — | — | — | — | — | — | DELETED 2026-05-04 (DOC-106 closed) |
| docs/Use_cases.md | ✓ | ✓ | ✓ | ✗(DOC-107) | ✓ | — | ✗(DOC-107) | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | 2026-05-03 |
| docs/dc_data_compliance.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✗(DOC-124) | FAIL | 2026-05-04 (use-case subtree audit) |
| ~~docs/Data_Compliance_DS.md~~ | — | — | — | — | — | — | — | — | — | — | — | — | DELETED 2026-05-04 (DOC-104 closed) |
| docs/de_deprecation.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✗(DOC-124) | FAIL | 2026-05-04 (use-case subtree audit) |
| docs/dq_visibility.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✗(DOC-124) | FAIL | 2026-05-04 (use-case subtree audit) |
| docs/viz_preparation.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✗(DOC-124) | FAIL | 2026-05-04 (use-case subtree audit) |
| docs/service_presales.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✗(DOC-124) | FAIL | 2026-05-04 (use-case subtree audit) |
| docs/genai.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/directory.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/data-modelling.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/data-modelling/query-examples.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/data-modelling/relationships.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/master-data-management.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/master-data-management/lookup-tables.md | ✓ | ✓ | ✓ | ✗(DOC-117) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | 2026-05-03 |
| docs/configuration-and-deployment/deployment.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/configuration-and-deployment/trylocally.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-113 closed) |
| docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-111 closed) |
| docs/configuration-and-deployment/odd-platform.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-089, DOC-102, DOC-108, DOC-113, DOC-116-cross-doc-edit closed) |
| docs/configuration-and-deployment/collectors-secrets-backend.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| docs/configuration-and-deployment/enable-security/README.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/configuration-and-deployment/enable-security/authentication/README.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/configuration-and-deployment/enable-security/authentication/disabled-authentication.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/configuration-and-deployment/enable-security/authentication/login-form.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/configuration-and-deployment/enable-security/authentication/oauth2-oidc.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-121 closed) |
| docs/configuration-and-deployment/enable-security/authentication/ldap.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-113 closed) |
| docs/configuration-and-deployment/enable-security/authentication/s2s.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/configuration-and-deployment/enable-security/authorization/README.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/configuration-and-deployment/enable-security/authorization/policies.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-120 + DOC-113 closed) |
| docs/configuration-and-deployment/enable-security/authorization/permissions.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/configuration-and-deployment/enable-security/authorization/roles.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-113 closed) |
| docs/configuration-and-deployment/enable-security/authorization/owners.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-113 closed) |
| docs/configuration-and-deployment/enable-security/authorization/user-owner-association.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-113 closed) |
| docs/developer-guides/api-reference.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (DOC-101 closed) |
| docs/developer-guides/how-to-contribute.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-118 + DOC-113 closed) |
| docs/developer-guides/github-organization-overview.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-098 + DOC-112 closed; DOC-123 deferred follow-up for `charts` + `opendatadiscovery-specification` entries) |
| docs/developer-guides/custom-collectors.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/developer-guides/build-and-run/README.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-122 closed) |
| docs/developer-guides/build-and-run/build-and-run-odd-platform.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/developer-guides/build-and-run/build-and-run-odd-collectors.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-119 closed) |
| docs/integrations/README.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 |
| docs/integrations/integration-wizard.md | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-04 (post-fidelity-batch re-audit; DOC-102 closed) |
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

Total: 58 pages (excluding `.gitbook/includes/auth-type-oauth2-oa....md` which is a GitBook editor include fragment, not a published page; `platform.md` and `Data_Compliance_DS.md` deleted 2026-05-04 — DOC-104 + DOC-106).

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
| DOC-089 | A5 (factual claim provenance) | docs/configuration-and-deployment/odd-platform.md (GenAI Configuration H2) | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 + Gate 4 verified via Read of GenAIProperties.java:10)** |
| DOC-094 | A4 | docs/Features.md | high | **done (closed 2026-05-04 post-merge — Gate 8 verified live)** |
| DOC-095 | A4 | docs/Features.md | high | **done (closed 2026-05-04 post-merge — Gate 8 verified live)** |
| DOC-096 | A4 | docs/Features.md | high | **done (closed 2026-05-04 post-merge — Gate 8 verified live)** |
| DOC-097 | A1 | (4 orphan pages — superseded by DOC-103/104/105/106) | medium | pending — partially closed (DOC-104 + DOC-106 deletions shipped 2026-05-04 fidelity batch); DOC-103 (Overview.md) + DOC-105 (quick_start.md) still pending |
| DOC-098 | A4 + A12 | docs/developer-guides/github-organization-overview.md | medium | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live)** |
| DOC-099 | A1 + A3 + A8 + A10 | docs/Architecture.md | medium | pending; blocked by DOC-115 |
| DOC-100 | A12 | docs/configuration-and-deployment/odd-platform.md | low | **done (closed 2026-05-04 post-merge — Gate 8 verified live)** |
| DOC-101 | A4 | (4 pages with Slack URLs) | low | **done (closed 2026-05-04 post-merge — Gate 8 verified live)** |
| DOC-102 | A2 + A4 | docs/integrations/integration-wizard.md, docs/configuration-and-deployment/odd-platform.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live)** |
| DOC-103 | A1 + A3 + A4 + A7 + A10 + A12 | docs/Overview.md | medium | pending |
| DOC-104 | A1 | docs/Data_Compliance_DS.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — file deleted; HTML-commented Overview.md reference also removed)** |
| DOC-105 | A7 | docs/quick_start.md | high | pending |
| DOC-106 | A1 | docs/platform.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — empty file deleted)** |
| DOC-107 | A4 + A7 | docs/Use_cases.md | medium | pending |
| DOC-108 | A3 + A4 | docs/configuration-and-deployment/odd-platform.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 9 env-var lines normalised to underscore form)** |
| DOC-109 | A9 + A11f | docs/Features.md (and 8+ cross-references) | medium | pending |
| DOC-110 | A4 | docs/Features.md | medium | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 3 link-quality sites fixed)** |
| DOC-111 | A4 + A12 | docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 18 defects + 2 capitalisation fixes; operator-impacting Q + L + N defects all closed)** |
| DOC-112 | A12 | docs/developer-guides/github-organization-overview.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 16 link patterns standardised to canonical form)** |
| DOC-113 | A12 | (cross-page batch — 14 files) | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live on representative subset; 14-file copy-edit sweep)** |
| DOC-114 | A2 | docs/main-concepts.md | high | pending; blocked by DOC-115 |
| DOC-115 | A1 (canonical-home decision) | docs/main-concepts.md + docs/Architecture.md | high | pending |
| DOC-116 | A4 (Features.md broader shadow-anchor sweep) | docs/Features.md (13 H2/H3 anchors + 9 TOC entries) | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 24 anchor sites cleaned, 0 shadow-anchor hits across `docs/`)** |
| DOC-117 | A4 + A11f (Medium image host fragility) | docs/Features.md (52) + docs/master-data-management/lookup-tables.md (14) | low | pending |
| DOC-118 | A7 (half-finished narrative — page intro promises three paths, body delivers two) | docs/developer-guides/how-to-contribute.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; Opening a PR H3 + Community contact H2 added; canonical Slack URL cited from existing surfaces)** |
| DOC-119 | A12 (rendering defect — concatenated `export` statements on one line; same defect class as DOC-100) | docs/developer-guides/build-and-run/build-and-run-odd-collectors.md (M1 troubleshooting code block) | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; M1 export block split into proper shell syntax + cunfluent→confluent typo folded)** |
| DOC-120 | A4 (dead anchor — 7 broken `policies.md#con` + `#condition-operations` references in a single section) | docs/configuration-and-deployment/enable-security/authorization/policies.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 7 anchors fixed, 0 sweep hits)** |
| DOC-121 | A12 (prose polish — stray-character typo `john,davidyam` in Keycloak example) | docs/configuration-and-deployment/enable-security/authentication/oauth2-oidc.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; john,davidyam → john,david)** |
| DOC-122 | A7 (sparse landing page — section README has no contents block linking sub-pages) | docs/developer-guides/build-and-run/README.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; Contents block added matching authentication/README.md exemplar)** |
| DOC-123 | A1 + A4 (canonical org-overview missing 2 repos: charts + opendatadiscovery-specification) | docs/developer-guides/github-organization-overview.md | low | pending — surfaced during DOC-098 Gate-9 sweep, scope-deferred from `feature/docs-fidelity-batch` |
| **DOC-124** | **A12 (use-case subtree prose polish residue — DOC-113 sweep missed `recourses` typo, double-spaces, trailing space, inconsistent terminator on 5 use-case pages)** | **docs/{viz_preparation, service_presales, dc_data_compliance, de_deprecation, dq_visibility}.md** | **low** | **NEW — surfaced during 2026-05-04 `feature/docs-fidelity-batch` post-merge editorial audit** |

## Audit history

| Date | Run label | Pages audited | New FAILs logged | Notes |
|---|---|---|---|---|
| 2026-05-03 | framework-codification | 0 | 0 | Framework written; dashboard scaffolded; no per-page cells filled this run. |
| 2026-05-03 | baseline-run-1 | 20 | 1 (DOC-115) | First baseline. Entry surfaces (7) + Use_cases.md + aspect landings (7: data-modelling, query-examples, relationships, master-data-management, lookup-tables, directory, genai) + 5 configuration-and-deployment pages (deployment, trylocally, EKS quick-launch, odd-platform, collectors-secrets-backend). Most aspect/feature/integration pages PASS — they were authored under the world-class bar already. Findings concentrate on entry surfaces (parallel-surface drift, sparse Architecture.md, 4× redundancy on main-concepts.md, half-finished orphans) and one heavy operator page (odd-platform.md hyphenated env-vars). DOC-115 newly surfaced: canonical-home decision between main-concepts.md and Architecture.md that DOC-114 + DOC-099 both depend on. 40 pages remain un-audited (use-case sub-pages + enable-security subtree + developer-guides + integrations); next baseline run continues. |
| 2026-05-04 | self-audit-verification | 0 (no new pages) | 2 (DOC-116, DOC-117) | Self-audit at user request ("do we have logged all the findings?"). Two observations from the baseline read had been noted in conversation but not yet committed to disk: DOC-116 (Features.md broader legacy shadow-anchor sweep — DOC-094 fixed only the duplicate id-128d pair; 13 other shadow anchors remain on H2/H3s + 9 in-page TOC entries target them) and DOC-117 (Medium image host fragility — 66 image references across Features.md + lookup-tables.md depend on cdn-images-1.medium.com + miro.medium.com; same defect class as DOC-101 outbound URL canonicalisation but for images). Re-classified `lookup-tables.md` from PASS to FAIL on A4 due to DOC-117. Confirms the framework's self-audit step works: the user's question forced a check and surfaced two on-disk gaps. |
| 2026-05-04 | post-merge-batch-closeout-+-baseline-run-2 | 22 newly audited + 4 re-audited (Features.md, odd-platform.md, main-concepts.md cells unchanged; api-reference.md as new entry post-DOC-101 closure) | 5 (DOC-118, DOC-119, DOC-120, DOC-121, DOC-122) | Post-merge closeout of `feature/docs-editorial-audit-closeout` batch (DOC-094, 095, 096, 100, 101 → done — Gate 8 closed via live-site WebFetch on each affected URL). Continued baseline with developer-guides subtree (7 pages: api-reference, how-to-contribute, github-organization-overview, custom-collectors, build-and-run/README, build-and-run-odd-platform, build-and-run-odd-collectors) + enable-security subtree (13 pages: README + authentication/{README, disabled, login-form, oauth2-oidc, ldap, s2s} + authorization/{README, policies, permissions, roles, owners, user-owner-association}) + integrations entry surfaces (2 pages: README, integration-wizard). New FAILs concentrate on developer-onboarding pages (DOC-118 how-to-contribute half-finished narrative; DOC-122 build-and-run/README sparse landing) and a recurring rendering-defect class (DOC-119 M1 export concatenation — second instance of DOC-100 pattern). DOC-120 caught by per-link audit cue on policies.md (7 broken `#con` / `#condition-operations` anchors in a single section) and live-site-WebFetch-confirmed. DOC-121 caught by per-page cross-example consistency read (Keycloak example has `john,davidyam` typo while every other admin-principals example on the page uses the canonical `john,david`). 18 pages remain un-audited (push-adapters/* + collectors/odd-collector-* + use-case sub-pages + remaining root-level singletons quick_start.md, platform.md, dc_data_compliance.md, Data_Compliance_DS.md, de_deprecation.md, dq_visibility.md, viz_preparation.md, service_presales.md); next /review run continues with integrations/* sub-pages and Use_cases sub-pages. **Validation of framework's third invocation**: 5 new findings on developer-guides + enable-security surfaces — none would have been caught by the per-item gates which fired cleanly on the closing batch. The systematic per-page walk continues to surface structural / coherence defects that per-commit verification machinery cannot see. |
| 2026-05-04 | post-merge-fidelity-batch-closeout-+-use-case-subtree-baseline | 5 use-case pages newly audited (`dc_data_compliance.md`, `de_deprecation.md`, `dq_visibility.md`, `viz_preparation.md`, `service_presales.md`) + post-merge re-audit of all 14 pages touched by the batch (Features.md, odd-platform.md, integration-wizard.md, github-organization-overview.md, EKS quick-launch, oauth2-oidc.md, policies.md, roles.md, ldap.md, owners.md, user-owner-association.md, trylocally.md, how-to-contribute.md, build-and-run-odd-platform.md, build-and-run-odd-collectors.md, build-and-run/README.md, odd-dbt.md) | 1 (DOC-124) | Post-merge closeout of `feature/docs-fidelity-batch` (16 items → done — DOC-089, 098, 102, 104, 106, 108, 110, 111, 112, 113, 116, 118, 119, 120, 121, 122). Gate 8 verified live on every affected URL via WebFetch; transient ~10-min cache lag observed on roles.md (DOC-113) but cleared on retry — not Gate-8-fail-relevant. The deletion of `platform.md` and `Data_Compliance_DS.md` (DOC-106, DOC-104) reduces the dashboard's denominator from 60 to 58 pages. Use-case subtree audit surfaced **DOC-124** (A12 prose polish residue: `recourses` typo, double-spaces, trailing space, inconsistent terminator across 5 pages) — pattern-driven sweeps catch what their patterns name; the editorial audit fills the gap. **Validation of framework's fourth invocation**: 1 new finding on the use-case subtree — exactly the residue an end-to-end editorial read catches that DOC-113's grep-pattern sweep misses. The audit's value is now recurringly demonstrated. **Closing tally**: 16 batch items closed; 13 still-pending DOC items (DOC-088, 097, 099, 103, 105, 107, 109, 114, 115, 117, 123, 124) — half are A1 + A7 entry-surface IA decisions blocked on DOC-115 (Architecture.md ↔ main-concepts.md canonical-home), the rest are tracked for next batch. 12 pages remain un-audited (push-adapters/* + collectors/odd-collector-* + remaining root-level singletons quick_start.md, dc_data_compliance.md → audited this run, de_deprecation.md → audited this run, dq_visibility.md → audited this run, viz_preparation.md → audited this run, service_presales.md → audited this run). Next /review continues with integrations/{collectors, push-adapters} sub-pages. |