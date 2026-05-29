---
doc_page: "docs/integrations/collectors/odd-collector-aws.md"
page_title: "odd-collector-aws"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-collector-aws"
live_url_verified_status: "redirected"          # guessed slug 307 -> resolved slug 200
live_url_resolved_slug: "integrations/integrations/odd-collector-aws"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: MEDIUM
describes:
  concepts: ["Collector"]
  features: []
  code_nodes: []
audience: [operator]
doc_claim_vs_code:
  - "Live-URL drift (verified): the mechanical guess docs/integrations/collectors/odd-collector-aws.md -> /integrations/collectors/odd-collector-aws returns HTTP 307 and redirects to the resolved GitBook slug /integrations/integrations/odd-collector-aws (200). The doubled `integrations/integrations/` segment is the real served path. Evidence: curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' on the guessed slug = 307 -> /integrations/integrations/odd-collector-aws; curl -sSL on the resolved slug = 200 with anchors id=\"common-aws-authentication\", id=\"spotlight-glue-type-glue\", id=\"known-limitations\", id=\"per-adapter-feature-matrix\" all present and <title>odd-collector-aws | ODD Platform</title>. Doc-gaps signal: GitBook's own 404 search-suggestion emits a malformed href ending in `.md` (.../integrations/integrations/odd-collector-aws.md) — cosmetic, the canonical redirect works."
  - "Cross-repo coverage hole (not fabricated drift): every implementation claim on this page — the 11 Pydantic plugin classes in odd_collector_aws/domain/plugin.py, KinesisPlugin re-declaring aws_account_id as required, SagemakerPlugin re-declaring AWS auth + experiments without defaults, the S3Plugin validate_datasets rejection of the legacy datasets: field, S3DeltaPlugin.delta_tables being a single object vs gcs_delta's list — lives in the odd-collectors repo, which is NOT ingested into this odd-platform graph. None of these field/default/validator claims are verifiable against this graph (graph-search --label CodeNode and --label Feature both returned [] for AWS/Glue/S3/adapter terms). Verifying this page's code-doc drift requires an odd-collectors substrate; flag for the doc-gap-finder as a cross-repo gap, NOT as a confirmed drift finding here."
maintainer_curated: false
---

# odd-collector-aws — doc understanding

Operator-facing reference for the `odd-collector-aws` binary: a daemon container that hosts one or more configured AWS pull adapters (11 type literals — `glue`, `s3`, `athena`, `dms`, `dynamodb`, `kinesis`, `quicksight`, `s3_delta`, `sagemaker`, `sagemaker_featurestore`, `sqs`). The page delivers the per-adapter YAML config schema, the shared `AwsPlugin` auth-field set (boto3 default-credential-chain fallback when unset), two deployment spotlights (Glue, S3), a feature matrix, and a known-limitations list. It is a concrete instance of the platform-side **Collector** concept (`entitie:collector`, confirmed via graph-node) — "Container of pull adapters plus the runtime around them," authenticated to the platform by a shared-secret bearer token over the S2S ingestion path. The page's `platform_host_url` + `token` minimal-config keys are the collector→platform handshake that the platform's collector/S2S concepts receive; the platform graph corroborates that handshake exists but does not implement the AWS adapters.

No Feature (`F-NNN`) or CodeNode binding is recorded: the AWS adapters are odd-collectors code, outside this graph's repo scope (`graph-search --label Feature` / `--label CodeNode` both empty for the page's discriminating terms). Two platform-side operation concepts surfaced in vector search — `operation:register-data-source-from-collector-s2s` and `operation:regenerate-collector-token` — were read via graph-node and deliberately NOT bound: this page documents neither the S2S `POST /ingestion/datasources` partial-merge endpoint nor token regeneration; binding them would be padding (Rule 3). Live-URL and cross-repo findings are recorded in `doc_claim_vs_code` above.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
