---
doc_page: "docs/developer-guides/build-and-run/build-and-run-odd-platform.md"
page_title: "Build and run ODD Platform"
live_url: "https://docs.opendatadiscovery.org/developer-guides/build-and-run/build-and-run-odd-platform"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/build-and-run/build-and-run-odd-platform"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: []
  features: []
  code_nodes: []
audience: [developer]
doc_claim_vs_code:
  - "Page (source_line 107) instructs `PLATFORM_HOST_URL=http://localhost:8080 APP_PATH=./docker/injector python docker/injector/inject.py`, but the injector script ships at repo-root `injector/inject.py`, NOT `docker/injector/inject.py` — from the repo root the documented command fails file-not-found and `APP_PATH=./docker/injector` points at a non-existent dir. The shipped `docker/demo.yaml` enricher service confirms the canonical location: it mounts `../injector:/injector` and runs `./injector/start.sh`. Evidence: odd-platform `injector/inject.py` exists; `docker/injector/` absent; `odd-platform/docker/demo.yaml` enricher `volumes: - ../injector:/injector`."
maintainer_curated: false
---

# Build and run ODD Platform — doc understanding

A developer-facing build-and-run guide: tech stack, prerequisites, building the
platform into a JAR (`./gradlew clean build`) and a Docker image
(`./gradlew clean jibDockerBuild ...` via JIB), running locally (PostgreSQL via
`docker-compose -f docker/demo.yaml up -d database` + `./gradlew bootRun`),
injecting demo metadata, a frontend-engineer Docker path, and running tests. Its
subject is the gradle/JIB/docker-compose build chain and the local dev loop —
not a runtime code path — so it does not `DESCRIBES`-bind to any modelled
Concept, Feature, or CodeNode. The build-tooling and local-dev surface is
unmodelled in the current substrate; recording empty `describes` rather than
padding (per contract Rule 2/3).

The datasource instructions the page shows (`SPRING_DATASOURCE_URL=jdbc:postgresql://...`,
`SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`) are CORRECT and were
verified against source — they are NOT drift. ODD Platform is WebFlux/R2DBC, but
`R2DBCConfiguration.connectionFactory` (the `@Primary` pool) consumes Spring
Boot's standard `spring.datasource.*` via `DataSourceProperties` and rewrites the
URL itself (`dataSourceProperties.getUrl().replace("jdbc", "r2dbc")`), so the
`jdbc:` URL the page shows is right. `application.yml` ships those same
`spring.datasource.{url,username,password}` defaults and `docker/demo.yaml:17-19`
sets the `SPRING_DATASOURCE_*` env vars verbatim. The graph carries
`config-key-consumer` nodes only for the SECONDARY `spring.custom-datasource.*`
pool (`R2DBCConfiguration.databaseClientForCustomSchema`, `@Value` at L56-58, a
custom lookup-tables schema that falls back to the main datasource when blank) —
that pool is not what this page documents, so it is deliberately NOT bound here.
The primary `spring.datasource.*` keys are bound implicitly via Spring Boot
autoconfiguration (no explicit `@Value`), which is why the substrate has no
config-key-consumer node for them — a substrate-coverage observation, not a doc
defect.

The one real drift is the demo-injector path (see `doc_claim_vs_code`): the page
points operators at `docker/injector/inject.py`, but the script lives at repo-root
`injector/`. This is an operator-copy-paste-off-a-cliff defect (the script the
docker compose mounts from `../injector` runs fine; the hand-typed manual command
in the page does not) → a DOC-GAP candidate for `doc-gaps.md` / the maintainer to
triage.

## Maintainer notes
