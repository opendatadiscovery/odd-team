# ODD Architecture Map — Integration Patterns and Canonical Repos

This file is the **Gate 9 Source of Truth for repo-and-integration claims** (see `CLAUDE.md` → Implementation Quality Bar → Gate 9). When an item is about to claim "feature X is implemented in repo Y" or "tool Z is an adapter / collector / push-client", this file resolves the claim in O(1) without grepping or WebFetching.

This is the semantic layer. `navigation/repos.yaml` is the mechanical layer (paths, tech stacks, commands). The two must agree — if a repo appears in one but not the other, that is a navigation gap, log it.

Published overview for user-facing reference: <https://docs.opendatadiscovery.org/developer-guides/github-organization-overview>. That page is the doc-repo companion to this file — when either changes, the other must be checked.

## Canonical vocabulary

These are the authoritative definitions. Every doc change touching integrations must use these terms exactly; silently introducing a different word for the same thing is a Gate 9 failure.

- **Adapter** — a set of scripts that map metadata from a source system (PostgreSQL, MySQL, Airflow, Kafka, …) to the ODD specification's concepts (Data Entity, data types, lineage edges, quality tests). Adapters can be **pull** (read from the source) or **push** (emit from inside the source's runtime). The adapter's job is extract-and-map — nothing more.
- **Collector** — a container of **pull** adapters + supporting runtime (adapter launcher, logging, Platform-API client, config reader, scheduling). A collector is what you deploy; the adapters inside it are the mappers. A collector is **not** an adapter, and "pull adapter" is **not** a synonym for "collector".
- **Plugin** — a *configured* adapter inside a collector. One plugin carries one adapter's runtime settings (source host, database, credentials, schedule). A collector can host many plugins — several of the same adapter type (two PostgreSQL plugins pointing at different hosts) or several of different types.
- **Push adapter** (a.k.a. **push-client**) — a push-strategy adapter that runs **inside** the source system's own runtime (a dbt Cloud/Core plugin, a Great Expectations checkpoint action, an Airflow plugin, a Spark listener). It is still an adapter: the job is extract-and-map. The difference from a pull adapter is deployment topology — the adapter lives in the source's process, not in a collector container.
- **Integration** — umbrella term covering every path metadata takes from a source into the Platform. In user-facing prose prefer "integration" unless direction (pull / push) is the point of the sentence.

Why the distinction matters: operators ask "what do I install?" The answer is usually "a collector" (deploy a container, register plugins) or "a push adapter" (embed the package inside your existing dbt / Airflow / Spark / GE setup). Conflating "collector" with "pull adapter" erases the deploy/configure distinction that makes the operator's choice obvious.

### Aliases to log in `docs/main-concepts.md` Terms & Aliases

- "integration" — umbrella for all adapters + collectors; avoid the bare word "adapter" in prose because it is now ambiguous with the pre-collector legacy service.
- "pull adapter" — a pull-strategy adapter. A **component** of a collector; configured via a plugin.
- "push adapter" = "push-client" — a push-strategy adapter embedded in the source's runtime.
- "collector" — the container/runtime that hosts pull adapters; **not** a synonym for "pull adapter".
- "plugin" — a configured adapter instance inside a collector.
- Retire in prose: "connector" (unless referring to third-party vocabulary) — collides with our "collector".

## Integration patterns

Every repo fits one pattern. Classify any new repo mention against this list before authoring.

| Pattern | Topology | Runtime | How it feeds the Platform | Example repos |
|---------|----------|---------|---------------------------|---------------|
| **Platform** | — | Long-running Spring Boot server + React UI | Owns the Ingress API + UI + storage | `odd-platform` |
| **Spec** | — | Static artifact | Defines the Ingress API contract (OpenAPI) and ODDRN format | `opendatadiscovery-specification` |
| **Collector (container of pull adapters)** | Standalone process, scheduled | Long-running Python container | Runs configured pull adapters (plugins) on an interval and POSTs to `/ingestion/entities` | `odd-collector`, `odd-collector-aws`, `odd-collector-azure`, `odd-collector-gcp`, `odd-collector-profiler` |
| **Push adapter (push-client)** | Embedded in source's runtime | In-process plugin / listener / checkpoint action | Reports metadata or quality results to the Platform from inside the source tool's process | `odd-dbt`, `odd-great-expectations`, `odd-airflow-2`, `odd-spark-adapter` |
| **SDK** | — | Library | Shared code for building adapters, push adapters, and collector runtimes | `odd-collector-sdk` (inside the `odd-collectors` monorepo), `odd-models-package` |
| **Generated contracts** | — | Generated artifact | Language-specific stubs from the spec | `opendatadiscovery-specification-contracts` |
| **Tooling** | — | CLI / helper | Operator-facing utility (can also act as a push adapter for ad-hoc pushes) | `odd-cli` |
| **Deployment** | — | Helm charts | Packaged install for K8s | `charts` |
| **Examples** | — | Reference configs | Reproducible runs for new users | `odd-examples` |
| **Meta / registry** | — | YAML/JSON manifests | Registry of supported adapters and capabilities | `opendatadiscovery-integration-manifests` |

The public GitHub Organization Overview page (link above) classifies the same repos using the same vocabulary. If this file and the live page disagree, the doc-repo page is the user-visible source; this file is the implementer SoT — resolve by auditing both against the repo list and opening a DOC item.

## Canonical Repo Table

Every row states the repo's role and the single URL that is its SoT. When an item needs to cite a repo, copy the canonical URL from here.

| Repo | Pattern | Role | Canonical URL | Local path |
|------|---------|------|---------------|------------|
| `odd-platform` | Platform | Server + UI; owns Ingress API implementation, auth, UI | <https://github.com/opendatadiscovery/odd-platform> | `../odd-platform` |
| `opendatadiscovery-specification` | Spec | Source of truth for Ingress API and ODDRN | <https://github.com/opendatadiscovery/opendatadiscovery-specification> | `../opendatadiscovery-specification` |
| `opendatadiscovery-specification-contracts` | Generated contracts | Multi-language stubs from the spec | <https://github.com/opendatadiscovery/opendatadiscovery-specification-contracts> | — |
| `odd-collector` | Collector | Generic collector; hosts pull adapters for DBs, BI, streams | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector> | `../odd-collectors/odd-collector` |
| `odd-collector-aws` | Collector | Collector hosting AWS-service pull adapters | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector-aws> | `../odd-collectors/odd-collector-aws` |
| `odd-collector-azure` | Collector | Collector hosting Azure-service pull adapters | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector-azure> | `../odd-collectors/odd-collector-azure` |
| `odd-collector-gcp` | Collector | Collector hosting GCP-service pull adapters | <https://github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector-gcp> | `../odd-collectors/odd-collector-gcp` |
| `odd-collector-sdk` | SDK | Python SDK used by collector packages and pull adapters | (inside `odd-collectors` monorepo) | `../odd-collectors/odd-collector-sdk` |
| `odd-collector-profiler` | Collector | Statistical data profiler collector; uses Capital One `DataProfiler` | <https://github.com/opendatadiscovery/odd-collector-profiler> | `../odd-collector-profiler` |
| `odd-dbt` | Push adapter | dbt plugin — maps dbt test results + lineage and pushes from dbt runs | <https://github.com/opendatadiscovery/odd-dbt> | — |
| `odd-great-expectations` | Push adapter | GE checkpoint action — maps expectation results and pushes | <https://github.com/opendatadiscovery/odd-great-expectations> | `../odd-great-expectations` |
| `odd-airflow-2` | Push adapter | Airflow 2 plugin — maps DAG/task metadata and pushes | <https://github.com/opendatadiscovery/odd-airflow-2> | — |
| `odd-spark-adapter` | Push adapter | Spark listener — maps lineage from Spark jobs and pushes | <https://github.com/opendatadiscovery/odd-spark-adapter> | — |
| `odd-models-package` | SDK | Python Pydantic models generated from the spec | <https://github.com/opendatadiscovery/odd-models-package> | `../odd-models-package` |
| `odd-cli` | Tooling | CLI for interacting with the Platform; can push ad-hoc metadata | <https://github.com/opendatadiscovery/odd-cli> | — |
| `charts` | Deployment | Helm charts for Platform + collectors | <https://github.com/opendatadiscovery/charts> | `../charts` |
| `odd-examples` | Examples | Docker Compose + config examples | <https://github.com/opendatadiscovery/odd-examples> | `../odd-examples` |
| `opendatadiscovery-integration-manifests` | Meta / registry | Registry of supported adapters and capabilities | <https://github.com/opendatadiscovery/opendatadiscovery-integration-manifests> | — |
| `documentation` | Doc | Published at `docs.opendatadiscovery.org` | <https://github.com/opendatadiscovery/documentation> | `../documentation` |
| `odd-docs` | Doc (to be merged) | Legacy DevOps run books — target for consolidation into `documentation` | <https://github.com/opendatadiscovery/odd-docs> | — |

## Gate 9 usage cheatsheet

**"Which repo implements X?"** → find X in the canonical table and copy the URL.

**"Is Y a collector or a push adapter?"** → look at Pattern column. A collector is a deployable container that hosts pull adapters via plugins. A push adapter runs inside the source system's own runtime and emits metadata from there. "Pull adapter" by itself is not a deployment unit — pull adapters live inside collectors.

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
