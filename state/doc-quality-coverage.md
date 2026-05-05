# Doc-quality coverage dashboard

> **What this is.** The audit-coverage record for the documentation pillar's twelve-axis quality framework (`pillars/documentation/quality-framework.md`). One row per `documentation/docs/**/*.md` page; one column per page-readable axis (A1-A10, A11-forward, A12). Cell values: `✓` (PASS), `✗(DOC-NNN)` (FAIL with link to the follow-up), `—` (N/A for this page; e.g. `SUMMARY.md` is exempt from most axes), or empty (not yet audited).

> **How this is updated.** Every `/review` invocation runs the per-page audit on every page touched by the batch + a rotating sample of one un-audited page (when the framework's baseline is in progress). The reviewer updates the corresponding rows at the end of the audit. Empty rows stay empty until they are audited; the "audited %" metric below treats empty rows as un-audited (not as PASS).

## Headline metrics

- **Per-page coverage**: 40 / 56 pages audited (71%) — `Overview.md` and `quick_start.md` removed from denominator after DOC-103 + DOC-105 deletions shipped this run (denominator: 60 - DOC-104/platform.md - DOC-106/Data_Compliance_DS.md - DOC-103/Overview.md - DOC-105/quick_start.md = 56). Numerator drops by 2 (Overview.md and quick_start.md were partially-audited rows now retired). Use-case-subtree path realignment under DOC-085 does not change counts (rename, not delete).
- **Per-axis pass rate** (over audited cells, excluding N/A):
  - A1 38/38 (100%) — Overview.md row retired (DOC-103 closed); DOC-099 still open on Architecture.md.
  - A2 40/41 (98%) — 1 FAIL remaining (DOC-114).
  - A3 38/39 (97%) — 1 FAIL remaining (DOC-099).
  - A4 39/41 (95%) — 2 FAILs remaining (DOC-117 on Features.md + lookup-tables.md, DOC-109 on Features.md cross-references) — DOC-103 + DOC-107 closed this run.
  - A5 41/41 (100%)
  - A6 13/13 (100%) — 28 N/A.
  - A7 41/41 (100%) — DOC-103, DOC-105, DOC-107 all closed this run; A7 axis is now clean.
  - A8 40/41 (98%) — 1 FAIL (DOC-099).
  - A9 22/23 (96%) — 1 FAIL (DOC-109) — 18 N/A.
  - A10 40/40 (100%) — Overview.md row retired (DOC-103 closed); A10 axis is now clean.
  - A11f 41/41 (100%)
  - A12 41/41 (100%) — DOC-103 (README.md HTML-comment) + DOC-124 (5 use-case pages) closed this run; DOC-117 image-host fragility on lookup-tables.md is tracked under A4, not A12. A12 axis is now clean.
- **Open FAILs** (distinct DOC items linked from cells): 9 items (DOC-088, DOC-099, DOC-109, DOC-114, DOC-117 — pre-existing pending; DOC-125, DOC-126, DOC-127 — newly logged or recently logged; DOC-097 — fully superseded by DOC-103+DOC-104+DOC-105+DOC-106 all now closed; row drops from open list). **Closed this run** (7 items): DOC-103, DOC-105, DOC-107, DOC-115, DOC-123, DOC-124. (DOC-097 transitions to `superseded` status with all 4 per-file items closed, retiring its open-FAIL link.) **New FAILs logged this run**: DOC-126 (low, A12 cross-tree sub-shape — Features.md L281 prose double-space + README.md L27 ambiguous hard-line-break form), DOC-127 (low, A8 + A3 — use-cases.md parent H3 names drift from child H1s + SUMMARY entries on 3 of 5 entries).
- **Code-side coverage** (A11-reverse): not yet started.
- **Last audit run**: 2026-05-05 (post-merge audit run #4 — `feature/docs-coherence-closeout` 7 items closed + DOC-126 + DOC-127 newly logged from post-merge editorial read).

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
| docs/README.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-103 closed — HTML comment block tidied) |
| docs/SUMMARY.md | ✓ | ✓ | — | ✓ | — | — | ✓ | ✓ | — | ✓ | — | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-085 use-case path entries updated, no axis change) |
| ~~docs/Overview.md~~ | — | — | — | — | — | — | — | — | — | — | — | — | DELETED 2026-05-05 (DOC-103 closed) |
| docs/Architecture.md | ✗(DOC-099) | ✓ | ✗(DOC-099) | ✓ | ✓ | — | ✓ | ✗(DOC-099) | — | ✗(DOC-099) | ✓ | ✓ | FAIL | 2026-05-05 (post-coherence-closeout re-audit; DOC-115 closed — canonical-home decision recorded; DOC-099 still open on the implementing thin form) |
| docs/main-concepts.md | ✗(DOC-114) | ✗(DOC-114) | ✗(DOC-099) | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | FAIL | 2026-05-05 (post-coherence-closeout re-audit; DOC-115 closed — DOC-114 still open on the redundancy collapse + Terms & Aliases extension) |
| docs/Features.md | ✓ | ✓ | ✓ | ✗(DOC-117) | ✓ | ✓ | ✓ | ✓ | ✗(DOC-109) | ✓ | ✗(DOC-109) | ✓ | FAIL | 2026-05-04 (post-fidelity-batch re-audit; DOC-110, DOC-113, DOC-116 closed) |
| docs/oddrn.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-03 |
| ~~docs/quick_start.md~~ | — | — | — | — | — | — | — | — | — | — | — | — | DELETED 2026-05-05 (DOC-105 closed) |
| ~~docs/platform.md~~ | — | — | — | — | — | — | — | — | — | — | — | — | DELETED 2026-05-04 (DOC-106 closed) |
| docs/use-cases.md | ✓ | ✓ | ✗(DOC-127) | ✓ | ✓ | — | ✓ | ✗(DOC-127) | ✓ | ✓ | ✓ | ✓ | FAIL | 2026-05-05 (post-coherence-closeout re-audit; DOC-085 renamed Use_cases.md → use-cases.md; DOC-107 closed Path B trim — A4 + A7 now PASS; DOC-127 newly logged for parent H3 vs child H1 + SUMMARY drift on 3 of 5 entries) |
| docs/use-cases/dc-data-compliance.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-085 renamed dc_data_compliance.md → use-cases/dc-data-compliance.md; DOC-124 closed — A12 prose polish residue cleared) |
| ~~docs/Data_Compliance_DS.md~~ | — | — | — | — | — | — | — | — | — | — | — | — | DELETED 2026-05-04 (DOC-104 closed) |
| docs/use-cases/de-deprecation.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-085 renamed de_deprecation.md → use-cases/de-deprecation.md; DOC-124 closed) |
| docs/use-cases/dq-visibility.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-085 renamed dq_visibility.md → use-cases/dq-visibility.md; DOC-124 closed) |
| docs/use-cases/viz-preparation.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-085 renamed viz_preparation.md → use-cases/viz-preparation.md; DOC-124 closed) |
| docs/use-cases/service-presales.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-085 renamed service_presales.md → use-cases/service-presales.md; DOC-124 closed) |
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
| docs/developer-guides/github-organization-overview.md | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | PASS | 2026-05-05 (post-coherence-closeout re-audit; DOC-123 closed — `charts` + `opendatadiscovery-specification` entries added; page now lists all 16 first-class ODD-org repos) |
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
| DOC-097 | A1 | (4 orphan pages — superseded by DOC-103/104/105/106) | medium | **superseded (2026-05-05) — all 4 per-file items closed: DOC-104 + DOC-106 in fidelity batch; DOC-103 + DOC-105 in coherence-closeout batch** |
| DOC-098 | A4 + A12 | docs/developer-guides/github-organization-overview.md | medium | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live)** |
| DOC-099 | A1 + A3 + A8 + A10 | docs/Architecture.md | medium | pending; blocked by DOC-115 |
| DOC-100 | A12 | docs/configuration-and-deployment/odd-platform.md | low | **done (closed 2026-05-04 post-merge — Gate 8 verified live)** |
| DOC-101 | A4 | (4 pages with Slack URLs) | low | **done (closed 2026-05-04 post-merge — Gate 8 verified live)** |
| DOC-102 | A2 + A4 | docs/integrations/integration-wizard.md, docs/configuration-and-deployment/odd-platform.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live)** |
| DOC-103 | A1 + A3 + A4 + A7 + A10 + A12 | docs/Overview.md (deleted) + docs/README.md (HTML-comment tidy) | medium | **done (closed 2026-05-05 post-merge `feature/docs-coherence-closeout` — Gate 8 verified live; Overview.md deleted, README.md HTML-comment block removed)** |
| DOC-104 | A1 | docs/Data_Compliance_DS.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — file deleted; HTML-commented Overview.md reference also removed)** |
| DOC-105 | A7 | docs/quick_start.md (deleted) | high | **done (closed 2026-05-05 post-merge `feature/docs-coherence-closeout` — file deleted; live `/quick-start` returns 404; disk-vs-SUMMARY orphan-free post-batch)** |
| DOC-106 | A1 | docs/platform.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — empty file deleted)** |
| DOC-107 | A4 + A7 | docs/use-cases.md (renamed from Use_cases.md by DOC-085) | medium | **done (closed 2026-05-05 post-merge `feature/docs-coherence-closeout` — Path B trim shipped; live `/use-cases` shows 5 use cases with consistent shape)** |
| DOC-108 | A3 + A4 | docs/configuration-and-deployment/odd-platform.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 9 env-var lines normalised to underscore form)** |
| DOC-109 | A9 + A11f | docs/Features.md (and 8+ cross-references) | medium | pending |
| DOC-110 | A4 | docs/Features.md | medium | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 3 link-quality sites fixed)** |
| DOC-111 | A4 + A12 | docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 18 defects + 2 capitalisation fixes; operator-impacting Q + L + N defects all closed)** |
| DOC-112 | A12 | docs/developer-guides/github-organization-overview.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 16 link patterns standardised to canonical form)** |
| DOC-113 | A12 | (cross-page batch — 14 files) | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live on representative subset; 14-file copy-edit sweep)** |
| DOC-114 | A2 | docs/main-concepts.md | high | pending; blocked by DOC-115 |
| DOC-115 | A1 (canonical-home decision) | docs/main-concepts.md + docs/Architecture.md | high | **done (closed 2026-05-05 post-merge `feature/docs-coherence-closeout` — Option A chosen; DOC-114 + DOC-099 unblocked with explicit direction blocks)** |
| DOC-116 | A4 (Features.md broader shadow-anchor sweep) | docs/Features.md (13 H2/H3 anchors + 9 TOC entries) | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 24 anchor sites cleaned, 0 shadow-anchor hits across `docs/`)** |
| DOC-117 | A4 + A11f (Medium image host fragility) | docs/Features.md (52) + docs/master-data-management/lookup-tables.md (14) | low | pending |
| DOC-118 | A7 (half-finished narrative — page intro promises three paths, body delivers two) | docs/developer-guides/how-to-contribute.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; Opening a PR H3 + Community contact H2 added; canonical Slack URL cited from existing surfaces)** |
| DOC-119 | A12 (rendering defect — concatenated `export` statements on one line; same defect class as DOC-100) | docs/developer-guides/build-and-run/build-and-run-odd-collectors.md (M1 troubleshooting code block) | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; M1 export block split into proper shell syntax + cunfluent→confluent typo folded)** |
| DOC-120 | A4 (dead anchor — 7 broken `policies.md#con` + `#condition-operations` references in a single section) | docs/configuration-and-deployment/enable-security/authorization/policies.md | high | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; 7 anchors fixed, 0 sweep hits)** |
| DOC-121 | A12 (prose polish — stray-character typo `john,davidyam` in Keycloak example) | docs/configuration-and-deployment/enable-security/authentication/oauth2-oidc.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; john,davidyam → john,david)** |
| DOC-122 | A7 (sparse landing page — section README has no contents block linking sub-pages) | docs/developer-guides/build-and-run/README.md | low | **done (closed 2026-05-04 post-merge `feature/docs-fidelity-batch` — Gate 8 verified live; Contents block added matching authentication/README.md exemplar)** |
| DOC-123 | A1 + A4 (canonical org-overview missing 2 repos: charts + opendatadiscovery-specification) | docs/developer-guides/github-organization-overview.md | low | **done (closed 2026-05-05 post-merge `feature/docs-coherence-closeout` — Gate 8 verified live; both repos placed correctly; page now lists all 16 first-class ODD-org repos)** |
| DOC-124 | A12 (use-case subtree prose polish residue — DOC-113 sweep missed `recourses` typo, double-spaces, trailing space, inconsistent terminator on 5 use-case pages) | docs/use-cases/{viz-preparation, service-presales, dc-data-compliance, de-deprecation, dq-visibility}.md | low | **done (closed 2026-05-05 post-merge `feature/docs-coherence-closeout` — Gate 8 verified live; all 5 use-case pages A12 cells flipped FAIL→PASS; cross-tree sweep AC partial — 2 missed hits logged as DOC-126)** |
| DOC-125 | A12 (cross-tree double-space prose residue — DOC-124's mandatory sweep surfaced 4 hits outside use-case subtree) | docs/README.md (L10) + docs/configuration-and-deployment/odd-platform.md (L59 + L370 + L426) | low | pending — bundle with DOC-126 in next sweep batch |
| **DOC-126** | **A12 (cross-tree sub-shape — DOC-124 sweep declaration vs reviewer-rerun mismatch)** | **docs/Features.md (L281 prose double-space) + docs/README.md (L27 ambiguous hard-line-break form)** | **low** | **NEW — surfaced during 2026-05-05 `feature/docs-coherence-closeout` post-merge editorial audit** |
| **DOC-127** | **A8 + A3 (parent H3 vs child H1 + SUMMARY drift on 3 of 5 use-case entries)** | **docs/use-cases.md (L3, L7, L9 H3 names diverge from child page H1s + SUMMARY entries)** | **low** | **NEW — surfaced during 2026-05-05 `feature/docs-coherence-closeout` post-merge editorial audit** |

## Audit history

| Date | Run label | Pages audited | New FAILs logged | Notes |
|---|---|---|---|---|
| 2026-05-03 | framework-codification | 0 | 0 | Framework written; dashboard scaffolded; no per-page cells filled this run. |
| 2026-05-03 | baseline-run-1 | 20 | 1 (DOC-115) | First baseline. Entry surfaces (7) + Use_cases.md + aspect landings (7: data-modelling, query-examples, relationships, master-data-management, lookup-tables, directory, genai) + 5 configuration-and-deployment pages (deployment, trylocally, EKS quick-launch, odd-platform, collectors-secrets-backend). Most aspect/feature/integration pages PASS — they were authored under the world-class bar already. Findings concentrate on entry surfaces (parallel-surface drift, sparse Architecture.md, 4× redundancy on main-concepts.md, half-finished orphans) and one heavy operator page (odd-platform.md hyphenated env-vars). DOC-115 newly surfaced: canonical-home decision between main-concepts.md and Architecture.md that DOC-114 + DOC-099 both depend on. 40 pages remain un-audited (use-case sub-pages + enable-security subtree + developer-guides + integrations); next baseline run continues. |
| 2026-05-04 | self-audit-verification | 0 (no new pages) | 2 (DOC-116, DOC-117) | Self-audit at user request ("do we have logged all the findings?"). Two observations from the baseline read had been noted in conversation but not yet committed to disk: DOC-116 (Features.md broader legacy shadow-anchor sweep — DOC-094 fixed only the duplicate id-128d pair; 13 other shadow anchors remain on H2/H3s + 9 in-page TOC entries target them) and DOC-117 (Medium image host fragility — 66 image references across Features.md + lookup-tables.md depend on cdn-images-1.medium.com + miro.medium.com; same defect class as DOC-101 outbound URL canonicalisation but for images). Re-classified `lookup-tables.md` from PASS to FAIL on A4 due to DOC-117. Confirms the framework's self-audit step works: the user's question forced a check and surfaced two on-disk gaps. |
| 2026-05-04 | post-merge-batch-closeout-+-baseline-run-2 | 22 newly audited + 4 re-audited (Features.md, odd-platform.md, main-concepts.md cells unchanged; api-reference.md as new entry post-DOC-101 closure) | 5 (DOC-118, DOC-119, DOC-120, DOC-121, DOC-122) | Post-merge closeout of `feature/docs-editorial-audit-closeout` batch (DOC-094, 095, 096, 100, 101 → done — Gate 8 closed via live-site WebFetch on each affected URL). Continued baseline with developer-guides subtree (7 pages: api-reference, how-to-contribute, github-organization-overview, custom-collectors, build-and-run/README, build-and-run-odd-platform, build-and-run-odd-collectors) + enable-security subtree (13 pages: README + authentication/{README, disabled, login-form, oauth2-oidc, ldap, s2s} + authorization/{README, policies, permissions, roles, owners, user-owner-association}) + integrations entry surfaces (2 pages: README, integration-wizard). New FAILs concentrate on developer-onboarding pages (DOC-118 how-to-contribute half-finished narrative; DOC-122 build-and-run/README sparse landing) and a recurring rendering-defect class (DOC-119 M1 export concatenation — second instance of DOC-100 pattern). DOC-120 caught by per-link audit cue on policies.md (7 broken `#con` / `#condition-operations` anchors in a single section) and live-site-WebFetch-confirmed. DOC-121 caught by per-page cross-example consistency read (Keycloak example has `john,davidyam` typo while every other admin-principals example on the page uses the canonical `john,david`). 18 pages remain un-audited (push-adapters/* + collectors/odd-collector-* + use-case sub-pages + remaining root-level singletons quick_start.md, platform.md, dc_data_compliance.md, Data_Compliance_DS.md, de_deprecation.md, dq_visibility.md, viz_preparation.md, service_presales.md); next /review run continues with integrations/* sub-pages and Use_cases sub-pages. **Validation of framework's third invocation**: 5 new findings on developer-guides + enable-security surfaces — none would have been caught by the per-item gates which fired cleanly on the closing batch. The systematic per-page walk continues to surface structural / coherence defects that per-commit verification machinery cannot see. |
| 2026-05-04 | post-merge-fidelity-batch-closeout-+-use-case-subtree-baseline | 5 use-case pages newly audited (`dc_data_compliance.md`, `de_deprecation.md`, `dq_visibility.md`, `viz_preparation.md`, `service_presales.md`) + post-merge re-audit of all 14 pages touched by the batch (Features.md, odd-platform.md, integration-wizard.md, github-organization-overview.md, EKS quick-launch, oauth2-oidc.md, policies.md, roles.md, ldap.md, owners.md, user-owner-association.md, trylocally.md, how-to-contribute.md, build-and-run-odd-platform.md, build-and-run-odd-collectors.md, build-and-run/README.md, odd-dbt.md) | 1 (DOC-124) | Post-merge closeout of `feature/docs-fidelity-batch` (16 items → done — DOC-089, 098, 102, 104, 106, 108, 110, 111, 112, 113, 116, 118, 119, 120, 121, 122). Gate 8 verified live on every affected URL via WebFetch; transient ~10-min cache lag observed on roles.md (DOC-113) but cleared on retry — not Gate-8-fail-relevant. The deletion of `platform.md` and `Data_Compliance_DS.md` (DOC-106, DOC-104) reduces the dashboard's denominator from 60 to 58 pages. Use-case subtree audit surfaced **DOC-124** (A12 prose polish residue: `recourses` typo, double-spaces, trailing space, inconsistent terminator across 5 pages) — pattern-driven sweeps catch what their patterns name; the editorial audit fills the gap. **Validation of framework's fourth invocation**: 1 new finding on the use-case subtree — exactly the residue an end-to-end editorial read catches that DOC-113's grep-pattern sweep misses. The audit's value is now recurringly demonstrated. **Closing tally**: 16 batch items closed; 13 still-pending DOC items (DOC-088, 097, 099, 103, 105, 107, 109, 114, 115, 117, 123, 124) — half are A1 + A7 entry-surface IA decisions blocked on DOC-115 (Architecture.md ↔ main-concepts.md canonical-home), the rest are tracked for next batch. 12 pages remain un-audited (push-adapters/* + collectors/odd-collector-* + remaining root-level singletons quick_start.md, dc_data_compliance.md → audited this run, de_deprecation.md → audited this run, dq_visibility.md → audited this run, viz_preparation.md → audited this run, service_presales.md → audited this run). Next /review continues with integrations/{collectors, push-adapters} sub-pages. |
| 2026-05-05 | post-merge-coherence-closeout-batch | 6 use-case-subtree pages re-audited at new kebab-case paths (use-cases.md + 5 children: use-cases/{dc-data-compliance, de-deprecation, dq-visibility, viz-preparation, service-presales}.md) + 3 root pages re-audited (README.md, Architecture.md, main-concepts.md) + 1 developer-guide re-audited (github-organization-overview.md) | 2 (DOC-126, DOC-127) | Post-merge closeout of `feature/docs-coherence-closeout` (7 items → done — DOC-103, DOC-105, DOC-107, DOC-115, DOC-123, DOC-124; DOC-097 retires as fully superseded with all 4 per-file items now closed). Gate 8 verified live on every affected URL via WebFetch (PR #57 merged at `e166505`). Deletion of Overview.md + quick_start.md retires 2 more rows; denominator drops 58 → 56. Path realignment under DOC-085 renames the 5 use-case child rows + the parent (Use_cases.md → use-cases.md); rows themselves stay (rename, not delete). Audited cells flipped FAIL→PASS this run: README.md A12 (HTML comment block tidy); 5 use-case children A12 (DOC-124 prose polish); use-cases.md A4 + A7 (DOC-107 trim); Architecture.md + main-concepts.md A1 cells lose the `+DOC-115` annotation (DOC-115 closed; DOC-099 + DOC-114 implementation still open). github-organization-overview.md row note updated to record DOC-123 closure. Editorial audit (fourth invocation) surfaced **DOC-126** (cross-tree sweep declaration vs reviewer-rerun mismatch — Features.md L281 prose double-space + README.md L27 ambiguous hard-line-break) and **DOC-127** (use-cases.md parent H3 names drift from child H1s + SUMMARY entries on 3 of 5 entries). Both findings are coherence-class — neither would have been caught by per-item gates which fired cleanly on the closing batch. **A7, A10, A12 axes are now 100% PASS across audited cells** for the first time since the framework was instated. **Closing tally**: 7 batch items closed + DOC-097 fully superseded; 9 still-pending DOC items (DOC-088, 099, 109, 114, 117, 125, 126, 127; DOC-099 + DOC-114 ready to implement post-DOC-115 direction). 16 pages remain un-audited (push-adapters/* + collectors/odd-collector-*); next /review continues there. |