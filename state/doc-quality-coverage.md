# Doc-quality coverage dashboard

> **What this is.** The audit-coverage record for the documentation pillar's twelve-axis quality framework (`pillars/documentation/quality-framework.md`). One row per `documentation/docs/**/*.md` page; one column per page-readable axis (A1-A10, A11-forward, A12). Cell values: `✓` (PASS), `✗(DOC-NNN)` (FAIL with link to the follow-up), `—` (N/A for this page; e.g. `SUMMARY.md` is exempt from most axes), or empty (not yet audited).

> **How this is updated.** Every `/review` invocation runs the per-page audit on every page touched by the batch + a rotating sample of one un-audited page (when the framework's baseline is in progress). The reviewer updates the corresponding rows at the end of the audit. Empty rows stay empty until they are audited; the "audited %" metric below treats empty rows as un-audited (not as PASS).

> **Baseline status.** Initial population of the per-page audit cells begins after this dashboard is committed. Cells filled progressively as the baseline audit walks the doc tree subtree-by-subtree. Code-side coverage sweep (axis A11-reverse) has not yet started — it requires its own scanner and is queued for after the per-page baseline lands.

## Headline metrics

- **Per-page coverage**: 0 / 60 pages audited (0%).
- **Per-axis pass rate**: pending baseline.
- **Open FAILs**: 13 (DOC-094 through DOC-114, all from the 2026-05-03 reactive editorial audits before the framework existed; will be re-anchored to axes during the baseline run).
- **Code-side coverage** (A11-reverse): not yet started.
- **Last audit run**: 2026-05-03 (framework codification — no per-page cells filled this run).

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
| docs/README.md | | | | | | | | | | | | | | |
| docs/SUMMARY.md | | | | | | | | | | | | | | |
| docs/Overview.md | | | | | | | | | | | | | | |
| docs/Architecture.md | | | | | | | | | | | | | | |
| docs/main-concepts.md | | | | | | | | | | | | | | |
| docs/Features.md | | | | | | | | | | | | | | |
| docs/oddrn.md | | | | | | | | | | | | | | |
| docs/quick_start.md | | | | | | | | | | | | | | |
| docs/platform.md | | | | | | | | | | | | | | |
| docs/Use_cases.md | | | | | | | | | | | | | | |
| docs/dc_data_compliance.md | | | | | | | | | | | | | | |
| docs/Data_Compliance_DS.md | | | | | | | | | | | | | | |
| docs/de_deprecation.md | | | | | | | | | | | | | | |
| docs/dq_visibility.md | | | | | | | | | | | | | | |
| docs/viz_preparation.md | | | | | | | | | | | | | | |
| docs/service_presales.md | | | | | | | | | | | | | | |
| docs/genai.md | | | | | | | | | | | | | | |
| docs/directory.md | | | | | | | | | | | | | | |
| docs/data-modelling.md | | | | | | | | | | | | | | |
| docs/data-modelling/query-examples.md | | | | | | | | | | | | | | |
| docs/data-modelling/relationships.md | | | | | | | | | | | | | | |
| docs/master-data-management.md | | | | | | | | | | | | | | |
| docs/master-data-management/lookup-tables.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/deployment.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/trylocally.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/odd-platform.md | | | | | | | | | | | | | | |
| docs/configuration-and-deployment/collectors-secrets-backend.md | | | | | | | | | | | | | | |
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

## Open FAILs from prior reactive audits

These DOC items predate the framework. During the baseline per-page audit, each will be re-anchored to its primary axis (the axis assignment listed below is provisional; the baseline audit may refine).

| DOC-NNN | Provisional axis | Page | Priority |
|---|---|---|---|
| DOC-088 | A1 | docs/developer-guides/api-reference.md | high |
| DOC-094 | A4 | docs/Features.md | high (review-ready) |
| DOC-095 | A4 | docs/Features.md | high (review-ready) |
| DOC-096 | A4 | docs/Features.md | high (review-ready) |
| DOC-097 | A1 | docs/Overview.md, docs/quick_start.md, docs/platform.md, docs/Data_Compliance_DS.md | medium |
| DOC-098 | A4 + A12 | docs/developer-guides/github-organization-overview.md | medium |
| DOC-099 | A1 + A8 | docs/Architecture.md | medium |
| DOC-100 | A12 | docs/configuration-and-deployment/odd-platform.md | low (review-ready) |
| DOC-101 | A4 | docs/Features.md, docs/main-concepts.md, docs/configuration-and-deployment/odd-platform.md, docs/developer-guides/api-reference.md | low (review-ready) |
| DOC-102 | A4 | docs/integrations/integration-wizard.md, docs/configuration-and-deployment/odd-platform.md | high |
| DOC-103 | A1 | docs/Overview.md | medium |
| DOC-104 | A1 | docs/Data_Compliance_DS.md | low |
| DOC-105 | A7 | docs/quick_start.md | high |
| DOC-106 | A1 | docs/platform.md | low |
| DOC-107 | A7 | docs/Use_cases.md | medium |
| DOC-108 | A3 + A4 | docs/configuration-and-deployment/odd-platform.md | high |
| DOC-109 | A9 | docs/Features.md, docs/integrations/integration-wizard.md, docs/configuration-and-deployment/trylocally.md, etc. | medium |
| DOC-110 | A4 | docs/Features.md | medium |
| DOC-111 | A12 + A4 | docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md | high |
| DOC-112 | A12 | docs/developer-guides/github-organization-overview.md | low |
| DOC-113 | A12 | (cross-page batch) | low |
| DOC-114 | A2 | docs/main-concepts.md | high |

## Audit history

| Date | Run label | Pages audited | New FAILs logged | Notes |
|---|---|---|---|---|
| 2026-05-03 | framework-codification | 0 | 0 | Framework written; dashboard scaffolded; no per-page cells filled this run. Baseline audit begins next session. |
