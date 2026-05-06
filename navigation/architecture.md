# ODD Architecture Map — Integration Patterns and Canonical Repos

This file is the **Gate 9 Source of Truth for repo-and-integration claims** (see `CLAUDE.md` → Implementation Quality Bar → Gate 9). When an item is about to claim "feature X is implemented in repo Y" or "tool Z is an adapter / collector / push-client", this file resolves the claim in O(1) without grepping or WebFetching.

This is the semantic layer. `navigation/repos.yaml` is the mechanical layer (paths, tech stacks, commands). The two must agree — if a repo appears in one but not the other, that is a navigation gap, log it.

Published overview for user-facing reference: <https://docs.opendatadiscovery.org/developer-guides/github-organization-overview>. That page is the doc-repo companion to this file — when either changes, the other must be checked.

## Canonical vocabulary

These are the authoritative definitions. Every doc change touching integrations must use these terms exactly; silently introducing a different word for the same thing is a Gate 9 failure.

ODD's adapter taxonomy is **two-axis**: a **pull / push strategy axis** (who initiates the data flow) crossed with a **deployment-shape axis** (where the adapter physically runs). Both axes matter — operators ask "what do I install?", which is the deployment shape; architects ask "how does the data flow?", which is the strategy.

- **Adapter** — a set of scripts that map metadata from a source system (PostgreSQL, MySQL, Airflow, Kafka, …) to the ODD specification's concepts (Data Entity, data types, lineage edges, quality tests). The adapter's job is extract-and-map — nothing more. Every adapter is classified by **strategy** (one of the two below) and **deployment shape** (one of the four below).

  **Strategy axis**:
  - **Pull adapter** — adapter is the initiator; reads from the source on a cadence; knows the source endpoint and credentials.
  - **Push adapter** (a.k.a. **push-client**) — source is the initiator; the adapter emits from inside (or alongside) the source's runtime; knows the platform endpoint.

  **Deployment-shape axis**:
  - **Collector-hosted** (pull only) — the pull adapter runs as a plugin inside a generic [collector](#canonical-vocabulary) container. Today's pull adapters all use this shape (`odd-collector` and the cloud / profiler siblings).
  - **In-process plugin / extension** (push only) — the push adapter is embedded in the source system's own runtime: a dbt plugin, a Great Expectations checkpoint action, an Airflow plugin, a Spark listener.
  - **Standalone gateway** (push only) — the push adapter is its own service; source systems push to the gateway over an externally-defined wire protocol (today: OpenTelemetry/OTLP for `odd-tracing-gateway`), and the gateway exposes the inferred entities for the Platform to pull. Operators reason about this as "push" because the source's mental model is `service → gateway`; technically the Platform-side leg is a pull, hidden behind the gateway's standalone deployment.
  - **Direct SDK / CLI use** (push only) — push via a CLI or library call from custom code (`odd-cli`, `odd-models-package`); no long-running process between the source and the Platform.

- **Collector** — a container of **pull** adapters + supporting runtime (adapter launcher, logging, Platform-API client, config reader, scheduling). A collector is one of the deployment shapes for pull adapters; it is **not** an adapter itself, and "pull adapter" is **not** a synonym for "collector".
- **Plugin** — a *configured* pull adapter inside a collector. One plugin carries one adapter's runtime settings (source host, database, credentials, schedule). A collector can host many plugins — several of the same adapter type (two PostgreSQL plugins pointing at different hosts) or several of different types. Push adapters do not use the plugin term; their configuration lives in the host tool's own configuration surface.
- **Integration** — umbrella term covering every path metadata takes from a source into the Platform. In user-facing prose prefer "integration" unless strategy (pull / push) or deployment shape is the point of the sentence.

Why the two-axis taxonomy matters: operators ask "what do I install?", which is the **deployment shape** — "a collector container", "a dbt plugin", "a standalone gateway service", "an `odd-cli` invocation". Architects ask "how does the data flow?", which is the **strategy** — "the source pushes, or the adapter pulls?". Collapsing the two questions into one ("collector vs push adapter") orphans deployment shapes that don't fit the two named slots — which is exactly what happened to `odd-tracing-gateway` under the legacy "Auxiliary platform component" pattern. The two-axis vocabulary keeps every adapter findable from either question.

### Aliases to log in `docs/main-concepts.md` Terms & Aliases

- "integration" — umbrella for all adapters + collectors; avoid the bare word "adapter" in prose because it is now ambiguous with the pre-collector legacy service.
- "pull adapter" — a pull-strategy adapter. Today always paired with the collector-hosted deployment shape (configured via a plugin).
- "push adapter" = "push-client" — a push-strategy adapter; deployment shape is one of in-process plugin / standalone gateway / direct SDK use.
- "collector" — the container/runtime that hosts pull adapters; the collector-hosted deployment shape. **Not** a synonym for "pull adapter".
- "standalone gateway" — a push-adapter deployment shape: a separate service that source systems push to (today: `odd-tracing-gateway`).
- "plugin" — a configured pull-adapter instance inside a collector. Push adapters do not use the plugin term.
- Retire in prose: "connector" (unless referring to third-party vocabulary) — collides with our "collector". Retire: "auxiliary platform component" — superseded by "push adapter (standalone gateway)" with the two-axis taxonomy.

## Integration patterns

Every repo fits one pattern. Classify any new repo mention against this list before authoring. Adapter rows carry the two-axis classification (strategy + deployment shape); non-adapter rows describe role.

| Pattern | Strategy | Deployment shape | Runtime | How it feeds the Platform | Example repos |
|---------|----------|------------------|---------|---------------------------|---------------|
| **Platform** | — | — | Long-running Spring Boot server + React UI | Owns the Ingress API + UI + storage | `odd-platform` |
| **Spec** | — | — | Static artifact | Defines the Ingress API contract (OpenAPI) and ODDRN format | `opendatadiscovery-specification` |
| **Pull adapter (collector-hosted)** | Pull | Collector container | Long-running Python container | Runs configured pull adapters (plugins) on an interval and POSTs to `/ingestion/entities` | `odd-collector`, `odd-collector-aws`, `odd-collector-azure`, `odd-collector-gcp`, `odd-collector-profiler` |
| **Push adapter (in-process plugin)** | Push | In-process plugin / extension | In-process listener / checkpoint action / plugin in the source tool | Reports metadata or quality results to the Platform from inside the source tool's process | `odd-dbt`, `odd-great-expectations`, `odd-airflow-2`, `odd-spark-adapter` |
| **Push adapter (standalone gateway)** | Push | Standalone service | Long-running JVM process operators deploy alongside the Platform | Source systems push (over an externally-defined wire protocol — today OpenTelemetry/OTLP) to the gateway, which infers ODD entities and exposes them to the Platform via the standard adapter-contract entities API. Operator-mental-model is "push"; the Platform-side leg is a pull hidden behind the gateway's standalone deployment. | `odd-tracing-gateway` |
| **Push adapter (direct SDK / CLI)** | Push | CLI / SDK call | Operator-invoked CLI or library call from custom code | One-shot push of metadata constructed by the operator's own code or a CI step | `odd-cli`, custom uses of `odd-models-package` |
| **SDK** | — | — | Library | Shared code for building adapters, push adapters, and collector runtimes | `odd-collector-sdk` (inside the `odd-collectors` monorepo), `odd-models-package`, `oddrn-generator` |
| **Generated contracts** | — | — | Generated artifact | Language-specific stubs from the spec | `opendatadiscovery-specification-contracts` |
| **Tooling** | — | — | CLI / helper | Operator-facing utility (`odd-cli` is also classified as a Push adapter — direct SDK / CLI shape — when used to push metadata) | `odd-cli` |
| **Deployment** | — | — | Helm charts | Packaged install for Platform, collectors, and gateway | `charts` |
| **Examples** | — | — | Reference configs | Reproducible runs for new users | `odd-examples` |
| **Meta / registry** | — | — | YAML/JSON manifests | Registry of supported adapters and capabilities | `opendatadiscovery-integration-manifests` |

The legacy "Auxiliary platform component" pattern is retired: `odd-tracing-gateway` is now classified as a **Push adapter (standalone gateway)** under the two-axis taxonomy. The retire-in-prose alias is logged above.

The public GitHub Organization Overview page (link above) classifies the same repos using the same vocabulary. If this file and the live page disagree, the doc-repo page is the user-visible source; this file is the implementer SoT — resolve by auditing both against the repo list and opening a DOC item.

## Canonical Repo Table

Every row states the repo's role and the single URL that is its SoT. When an item needs to cite a repo, copy the canonical URL from here.

| Repo | Pattern | Role | Canonical URL | Local path |
|------|---------|------|---------------|------------|
| `odd-platform` | Platform | Server + UI; owns Ingress API implementation, auth, UI | <https://github.com/opendatadiscovery/odd-platform> | `../odd-platform` |
| `opendatadiscovery-specification` | Spec | Source of truth for Ingress API and ODDRN | <https://github.com/opendatadiscovery/opendatadiscovery-specification> | `../opendatadiscovery-specification` |
| `opendatadiscovery-specification-contracts` | Generated contracts | Multi-language stubs from the spec | <https://github.com/opendatadiscovery/opendatadiscovery-specification-contracts> | — |
| `odd-collector` | Pull adapter (collector-hosted) | Generic collector; hosts pull adapters for DBs, BI, streams | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector> | `../odd-collectors/odd-collector` |
| `odd-collector-aws` | Pull adapter (collector-hosted) | Collector hosting AWS-service pull adapters | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector-aws> | `../odd-collectors/odd-collector-aws` |
| `odd-collector-azure` | Pull adapter (collector-hosted) | Collector hosting Azure-service pull adapters | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector-azure> | `../odd-collectors/odd-collector-azure` |
| `odd-collector-gcp` | Pull adapter (collector-hosted) | Collector hosting GCP-service pull adapters | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector-gcp> | `../odd-collectors/odd-collector-gcp` |
| `odd-collector-sdk` | SDK | Python SDK used by collector packages and pull adapters | (inside `odd-collectors` monorepo) | `../odd-collectors/odd-collector-sdk` |
| `odd-collector-profiler` | Pull adapter (collector-hosted) | Statistical data profiler collector; uses Capital One `DataProfiler` | <https://github.com/opendatadiscovery/odd-collector-profiler> | `../odd-collector-profiler` |
| `odd-dbt` | Push adapter (in-process plugin) | dbt plugin — maps dbt test results + lineage and pushes from dbt runs | <https://github.com/opendatadiscovery/odd-dbt> | — |
| `odd-great-expectations` | Push adapter (in-process plugin) | GE checkpoint action — maps expectation results and pushes | <https://github.com/opendatadiscovery/odd-great-expectations> | `../odd-great-expectations` |
| `odd-airflow-2` | Push adapter (in-process plugin) | Airflow 2 plugin — maps DAG/task metadata and pushes | <https://github.com/opendatadiscovery/odd-airflow-2> | — |
| `odd-spark-adapter` | Push adapter (in-process plugin) | Spark listener — maps lineage from Spark jobs and pushes | <https://github.com/opendatadiscovery/odd-spark-adapter> | — |
| `odd-tracing-gateway` | Push adapter (standalone gateway) | Optional standalone Java service: receives OpenTelemetry/OTLP traces from operator microservices, infers ODD service entities and their dependencies, and exposes them via the standard adapter-contract entities API for the Platform to pull. | <https://github.com/opendatadiscovery/odd-tracing-gateway> | `../odd-tracing-gateway` |
| `odd-models-package` | SDK | Python Pydantic models generated from the spec | <https://github.com/opendatadiscovery/odd-models-package> | `../odd-models-package` |
| `oddrn-generator` | SDK | Python helper library: per-source `Generator` subclasses (`PostgresqlGenerator`, `SnowflakeGenerator`, `KafkaGenerator`, `FeastGenerator`, …) for assembling [ODDRN](https://docs.opendatadiscovery.org/oddrn) identifiers. Used by every Python collector and push adapter; also used by the platform's `DirectoryService` to parse incoming ODDRNs. | <https://github.com/opendatadiscovery/oddrn-generator> | — |
| `odd-cli` | Tooling / Push adapter (direct SDK / CLI) | CLI for interacting with the Platform; can push ad-hoc metadata. Dual-classified — primary pattern is Tooling; when used to push metadata, the deployment shape is "direct SDK / CLI". | <https://github.com/opendatadiscovery/odd-cli> | — |
| `charts` | Deployment | Helm charts for Platform, collectors, and the tracing gateway | <https://github.com/opendatadiscovery/charts> | `../charts` |
| `odd-examples` | Examples | Docker Compose + config examples | <https://github.com/opendatadiscovery/odd-examples> | `../odd-examples` |
| `opendatadiscovery-integration-manifests` | Meta / registry | Registry of supported adapters and capabilities | <https://github.com/opendatadiscovery/opendatadiscovery-integration-manifests> | — |
| `documentation` | Doc | Published at `docs.opendatadiscovery.org` | <https://github.com/opendatadiscovery/documentation> | `../documentation` |
| `odd-docs` | Doc (to be merged) | Legacy DevOps run books — target for consolidation into `documentation` | <https://github.com/opendatadiscovery/odd-docs> | — |

## Gate 9 usage cheatsheet

**"Which repo implements X?"** → find X in the canonical table and copy the URL.

**"What kind of adapter is Y?"** → answer in two parts:
- **Strategy** (pull vs push) — does the source initiate the data flow (push) or does the adapter (pull)?
- **Deployment shape** — collector-hosted (pull only), in-process plugin / extension (push), standalone gateway (push), or direct SDK / CLI (push)?

A pull adapter without a deployment shape is not yet deployable; "pull adapter" by itself is not a deployment unit — today's pull adapters all live inside collectors. Conversely, "push adapter" is a strategy; the deployment shape determines what the operator installs (an in-process plugin embedded in the source tool, a standalone gateway service, or a CLI invocation).

**"Does this doc link to the right repo?"** → copy the canonical URL from this file and compare character-for-character. Common failure: treating every Python integration as a subdirectory of `odd-collectors` when it's actually a standalone repo (2026-04-23 DOC-027 shipped `/odd-collectors/tree/main/odd-dbt` for a push adapter that lives at `/odd-dbt`).

**Missing from this table?** → the scan / implement skill must both update this file when they discover new integration-layer paths. A missing row is a navigation gap, not a reason to ship a claim without SoT.

## Related navigation files

- `navigation/repos.yaml` — tech stacks, paths, build commands (mechanical)
- `navigation/features.yaml` — user-facing feature index
- `navigation/domains/*.md` — per-feature code pointers (controllers, services, bean factories, builders)

## How to update

- When a scanner or implementer finds a new repo or integration not listed here, add a row in the same commit that introduces the claim using it.
- When a repo changes role (e.g., an SDK graduates to a standalone package), update Pattern + Role + cross-check `docs.opendatadiscovery.org/developer-guides/github-organization-overview`.
- When the canonical URL changes (repo rename, org move), run `grep -rn "github.com/opendatadiscovery/{old-name}" ../documentation/docs/` and open a backlog item for the sweep.

Keep rows one-per-repo; if a repo maps to multiple patterns, that's a sign the split is wrong in the code — surface the modeling question, don't paper over it here.
