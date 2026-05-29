---
doc_page: "docs/configuration-and-deployment/deployment.md"
page_title: "Deployment Options"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/deployment"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/deployment"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: MEDIUM
describes:
  concepts:
    - "Collector"
    - "Collector Token"
    - "Regenerate Collector Token"
  features:
    - "F-020"
  code_nodes:
    - "odd-platform java CollectorController controller-method:regenerateCollectorToken"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (Option 4 gotcha 'Token regeneration', L247; Option 2 install step 3-4) frames the Collector token as 'not recoverable from the platform — you must regenerate it', presenting regeneration as a benign recovery action. Code adds an operator-critical consequence the page omits: regeneration is an in-place UPDATE with NO rotation grace period — `IngestionDataEntitiesFilter` starts rejecting old-token requests the moment the UPDATE commits, so an already-running Collector (the normal state in a Helm/EKS deployment) starts 401-ing on `POST /ingestion/entities` immediately and stops ingesting until the new token is redeployed. Evidence: concept `operation:regenerate-collector-token` ('In-place UPDATE — no rotation grace, no old/new pair'); F-020 ('Invalidates the prior secret IMMEDIATELY (no grace period); in-flight ingestion using the prior token starts 401-ing immediately'); odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/CollectorController.java:47. DOC-GAP candidate: add a caveat that token regeneration breaks active ingestion until the Collector is redeployed with the new token."
  - "Page (Option 3 gotcha L205, Option 4 gotcha L243) warns 'HTTPS is not configured / HTTP only — don't send sensitive data over it' but stops at the transport layer. It omits that the default quick-launch posture also leaves the platform's own credential surface anonymously reachable: `/actuator/env` is exposed by default (application.yml:230-231 `management.endpoints.web.exposure.include: health,prometheus,env,info`; application.yml:237-238 `management.endpoint.env.enabled: true`) and, under the quick-launch demo's effective auth posture, is reachable without authentication (`DisabledAuthSecurityConfiguration.java:13-18` `.anyExchange().permitAll()`). Spring's default value mask hides `password` but NOT the JDBC URL — `spring.datasource.url` (DB host/port/db-name) and the Slack/webhook URLs are returned verbatim. Evidence: invariant `plaintext-db-credentials-default-with-actuator-env-exposed-default` (application.yml:230-238; R2DBCConfiguration.java:35; DisabledAuthSecurityConfiguration.java:13-18). DOC-GAP candidate: the demo-grade options should note that over plain HTTP the actuator/env endpoint also leaks DB endpoint location, compounding the HTTP-only caveat."
maintainer_curated: false
---

# Deployment Options — doc understanding

This page is the operator-facing entry point to ODD's five supported deployment paths (Docker Compose for evaluation, Helm on self-managed Kubernetes, Helm Quick Launch all-in-one, AWS EKS via CloudFormation, and build-from-source) plus the optional `odd-tracing-gateway` companion. It is largely a router into the `charts` repo, `odd-platform`'s `docker/` demo stack, and the developer-guides build pages, so most of its mechanics live OUTSIDE the enriched odd-platform Java/TS substrate (Helm values, the Bitnami PostgreSQL sub-chart, the CloudFormation template) and have no confirmable substrate node — that is expected for a deployment-options overview, not a coverage gap in this repo.

What the page DOES bind into the odd-platform substrate is the Collector token-wiring workflow that Options 2 and 4 walk operators through. The page's "create a Collector entity, copy the issued token, wire it into the install" steps map to the `Collector` / `Collector Token` concepts (the shared-secret bearer token used by `IngestionDataEntitiesFilter` on `/ingestion/entities`) and the Collector Lifecycle Management feature (F-020); its EKS gotcha "you must regenerate it" maps to `operation:regenerate-collector-token`, implemented by `CollectorController.regenerateCollectorToken` (`CollectorController.java:47`). Both regeneration claims confirmed via graph-node carry a caveat the page omits (no grace period; immediate 401 of in-flight ingestion) — recorded as drift.

The page's primary datasource-configuration claim (Helm `config.yaml.spring.datasource.*`) is deliberately NOT bound to a code node: the only datasource config-key consumer in the substrate is `R2DBCConfiguration`'s `spring.custom-datasource.*` pool, which per the `custom-connection-pool-exists-solely-for-lookup-tables-schema-injection` invariant is a separate concern from the main `spring.datasource.*` the page configures (that one is consumed by Spring Boot autoconfig / Flyway, which is not enriched as a node). Binding it would be a wrong edge. The credential-exposure consequence of that same datasource config is captured instead as drift via the `plaintext-db-credentials-default-with-actuator-env-exposed-default` invariant.

## Maintainer notes
