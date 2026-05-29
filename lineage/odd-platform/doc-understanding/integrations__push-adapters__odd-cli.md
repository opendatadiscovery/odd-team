---
doc_page: "docs/integrations/push-adapters/odd-cli.md"
page_title: "odd-cli"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-cli"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-cli"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: MEDIUM
describes:
  concepts: ["Collector Token", "Collector", "Regenerate Collector Token"]
  features: ["F-096"]
  code_nodes: ["odd-platform java CollectorController controller-method:regenerateCollectorToken"]
audience: [operator]
doc_claim_vs_code:
  - "Live-URL guess is broken. doc-nodes.jsonl live_url = `https://docs.opendatadiscovery.org/integrations/push-adapters/odd-cli` returns 404 (WebFetched 2026-05-29; the 404 body itself points to the real location). The page resolves 200 at `https://docs.opendatadiscovery.org/integrations/integrations/odd-cli` (all 6 H2 anchors present). GitBook collapses the on-disk `push-adapters/` segment to `integrations/` in the published slug, so every code->doc backlink built from the mechanical live_url 404s. Repo path is `docs/integrations/push-adapters/odd-cli.md` (SUMMARY.md:75). Evidence (doc-side): live fetch this session. DOC-GAP candidate (broken-page / slug-rewrite)."
  - "Cross-audience caveat absent on token creation. The page (Configuration + `odd tokens create`) tells the operator to create/use an `ODD_PLATFORM_TOKEN` but omits the operator-critical platform-side token contract: the platform stores the collector token in PLAINTEXT in the TOKEN table and returns it in PLAINTEXT in the response body, rotation is an in-place UPDATE with NO grace window (in-flight ingestion 401s the instant rotation commits), and rotation is NOT audit-logged. Evidence (code): `odd-platform java CollectorController controller-method:regenerateCollectorToken` concepts.invariants.[1-3] + regenerateCollectorToken.md security.known_security_gaps.[0,2,3] (HIGH/MEDIUM). These caveats live on the platform/security pages, not on this CLI page; a cross-link to the token-rotation contract would close the gap. DOC-GAP candidate (cross-audience caveat / LSN-002 class)."
maintainer_curated: false
---

# odd-cli — doc understanding

Operator-facing page for `opendatadiscovery/odd-cli`, the command-line companion to the ODD Platform. It delivers three operator actions to a reader who has "a folder of files to register" or wants "a token for a script" without standing up a full collector: `odd collect <folder>` (push CSV/Parquet dataset entities), `odd dbt test <project>` (run dbt tests and ingest `target/` artefacts, wrapping `odd-dbt`), and `odd tokens create <name>` (mint a collector token). Configuration is two env vars — `ODD_PLATFORM_HOST` and `ODD_PLATFORM_TOKEN`.

The CLI's own command implementation is **out of this graph** — it lives in the separate `odd-cli` repo, not in odd-platform. What odd-platform provides is the *receiving and management* surface this CLI talks to, which is where the confirmed bindings sit. The `ODD_PLATFORM_TOKEN` the page documents is exactly the `Collector Token` (entitie:collector-token) — a 40-char shared-secret bearer token authenticating `POST /ingestion/entities`. The `odd collect` and `odd dbt test` pushes land on the platform's ingestion-entities surface, feature F-096 (`POST /ingestion/entities`, single-transaction-per-batch, confirmed via graph-node). `odd tokens create` corresponds to the platform's collector + token management; the platform's enriched token operation is `regenerateCollectorToken` (operation:regenerate-collector-token / the CollectorController method), confirmed via graph-node — though the exact endpoint the CLI invokes for *creation* is in the odd-cli repo (cross-repo, not resolvable here). There is no dbt-specific platform node; `odd dbt test` reuses the same generic ingestion surface, consistent with the page's "same payload as odd-dbt" statement.

Confidence is MEDIUM rather than HIGH because the primary subject (the CLI) is cross-repo: the concept/feature/code bindings are confirmed platform-side endpoints the CLI consumes, not the CLI's own code, which the substrate does not contain.

## Maintainer notes
