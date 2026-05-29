---
doc_page: "docs/configuration-and-deployment/collectors-secrets-backend.md"
page_title: "Collector secrets backend"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/collectors-secrets-backend"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/collectors-secrets-backend"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: []
  features: []
  code_nodes: []
audience: [operator]
doc_claim_vs_code: []
cross_repo_subject: "odd-collectors"
maintainer_curated: false
---

# Collector secrets backend — doc understanding

This page is an **operator** runbook for loading a collector's sensitive
`collector_config.yaml` values (Platform token, per-plugin DB passwords, cloud
credentials) from an external secrets backend — AWS SSM Parameter Store today,
pluggable via the `BaseSecretsBackend` abstract class — instead of plaintext on
disk. It covers the supported-provider table, the consume order (backend wins
over local YAML), the `secrets_backend.*` configuration reference, the SSM
parameter-naming convention, a 4-step worked example, the required IAM
(`ssm:GetParameter` / `ssm:GetParametersByPath` + conditional `kms:Decrypt`),
and four `Known limitations` (a silent 10-parameter SSM cap, no custom
`endpoint_url`, no timeout/retry overrides, fetch-time YAML parsed without
schema validation).

**Subject lives in a different repo — no bindings recorded.** Every code claim
on this page is about the **`odd-collector-sdk`** (Python): `BaseSecretsBackend`,
the `AWSSystemsManagerParameterStore` provider, `boto3.client("ssm", ...)`,
`get_parameters_by_path(..., Recursive=True)`, the Pydantic `extra="allow"`
settings loader. That code lives in the `odd-collectors` repository. This
analysis ran against the **odd-platform** ontology, whose graph contains the
Java/Spring platform — not the collector SDK. Per the contract's Rule 2 and
failure-mode #3, no `describes` target is recorded because none could be
confirmed via `graph-node` in this graph:

- **Concept search** (`graph-search --label Concept`) surfaced only
  `entitie:collector` (score 0.68) — the platform-side notion of a Collector
  (shared-secret bearer-token auth on `/ingestion/entities`, lifecycle via
  `/api/collectors/*`, in-place token rotation). That concept is **not** what
  this page documents: the page never touches token rotation or the collector
  management API; it documents how a collector process loads its *own* config
  from SSM. Binding to `entitie:collector` would be padding, so it is omitted.
- **Feature search** (`graph-search --label Feature`) returned empty — there is
  no `F-NNN` for the collector secrets backend in the odd-platform ontology.
- **CodeNode search** returned only unrelated Java config consumers
  (`attachment.remote.secret-key`, `attachment.storage`, `auth.s2s.enabled`,
  `datacollaboration`); the top hit at score 0.68 is the platform's S3
  attachment credentials, not the collector SDK's `secrets_backend`.

**Drift not code-cited (substrate absent).** The page makes several
operator-critical, falsifiable claims that are exactly the LSN-001/LSN-002
class — most notably the danger hint that "the backend loads at most 10 plugin
parameters from SSM" because the SDK calls `get_parameters_by_path` once without
paginating and the AWS default `MaxResults` is 10, dropping plugin 11+ silently
with no error or log. The contract requires every `doc_claim_vs_code` entry to
carry `node_id` + `file:line` code evidence; that evidence lives in the
`odd-collectors` SDK source, which is **neither checked out locally**
(`../odd-collectors` is absent from this workspace) **nor present as an ontology
graph** (`lineage/odd-collectors/` does not exist). No drift entry is fabricated
without code evidence. The page's own framing already treats these as known
limitations rather than undocumented behaviour.

**Signal for doc-gaps (cross-repo coverage hole).** This page is reachable from
core navigation (linked from `Features.md#alternative-secrets-backend`,
`integrations/README.md`, `developer-guides/build-and-run/custom-collectors.md`,
`main-concepts.md`) yet documents a subject the ontology has never ingested. To
mechanically verify its claims (especially the 10-parameter silent cap, the
absent `endpoint_url`, the absent `botocore.config.Config`, and the
fetch-time-YAML-parse abort), the `odd-collectors` repo — specifically the
`odd-collector-sdk/odd_collector_sdk/secrets/` package — must be enriched into a
graph. Until then this page's doc↔code linkage is structurally unverifiable from
the odd-platform substrate. Recommend a `doc-gap-finder` /
`pillar-undocumented`-class follow-up: *ingest odd-collector-sdk secrets backend
so collectors-secrets-backend.md claims become code-citable.*

## Maintainer notes
