---
doc_page: "docs/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service.md"
page_title: "Deploy to Amazon Elastic Kubernetes Service (EKS)"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/quick_launch_on_amazon_elastic_kubernetes_service"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["ODD Collector (runtime)", "Collector Token", "Auth Mode", "Platform Operator"]
  features: []
  code_nodes: ["odd-platform java CollectorController controller-method:regenerateCollectorToken"]
audience: [operator]
doc_claim_vs_code:
  - "Page deploys the platform with no mention of auth.type; the shipped default is auth.type=DISABLED (permit-all, no CSRF/CORS, no /logout handler) — application.yml:34 + DisabledAuthSecurityConfiguration; evidence: entitie:auth-mode, invariant:logout-link-404-under-disabled-auth-mode. The page's only security caveat is HTTP-vs-HTTPS; it never states that this Quick Launch ships a fully unauthenticated UI/API exposed via a public LoadBalancer (mitigated only by --set load-balancer-source-ranges)."
  - "Page sets the DB password in plaintext via helm --set config.yaml.spring.datasource.password=$POSTGRES_PASSWORD and never warns it is reachable post-deploy. /actuator/env is exposed by default (application.yml:230-231 `include: health, prometheus, env, info`; application.yml:237 env endpoint) and the password flows into Spring-managed bean props — R2DBCConfiguration.java:35; evidence: invariant:plaintext-db-credentials-default-with-actuator-env-exposed-default. Compound credential-reachability surface on the default deployment (LSN-001/LSN-002 class)."
  - "Page omits the Collector Token rotation contract: it says to regenerate the token if lost, but never states rotation is an in-place UPDATE with no overlap window — the running collector must pick up the new token (config-file change + restart) the moment the UPDATE commits, or ingestion breaks; evidence: entitie:collector-token, audience:odd-collector-runtime, CollectorController.regenerateCollectorToken."
maintainer_curated: false
---

# Deploy to Amazon Elastic Kubernetes Service (EKS) — doc understanding

Operator-facing AWS-EKS deployment walkthrough: provision an EKS cluster via the ODD CloudFormation quick-launch, install bitnami PostgreSQL via Helm, deploy `odd-platform` and `odd-collector` Helm charts, and expose the platform through a LoadBalancer locked down with `load-balancer-source-ranges`. It documents the **ODD Collector (runtime)** install path (`helm install odd-collector` + `collector-values.yaml` token substitution) and the **Collector Token** copy-once/regenerate-if-lost step — the recovery side of which is `CollectorController.regenerateCollectorToken` (confirmed via graph-node).

The page's datasource Helm flags (`config.yaml.spring.datasource.url/username/password`) are **correct**: they bind Spring Boot's standard `DataSourceProperties`, which drives the `@Primary` reactive ConnectionPool at `R2DBCConfiguration.java:29-35`. The `spring.custom-datasource.*` keys are an optional, blank-defaulted secondary pool (commented out at `application.yml:8-11`, with a fall-back to the main datasource at `R2DBCConfiguration.java:61-62`), so the page is right not to set them — no drift there.

The drift this page carries is **omission of operator-critical security posture**, not a wrong command. Following it verbatim yields an unauthenticated platform (`auth.type` defaults to `DISABLED`) with plaintext DB credentials reachable through the default-exposed `/actuator/env`, behind only an IP-range LoadBalancer filter. The page's lone security note covers HTTP-vs-HTTPS and is correct but incomplete; the auth-mode and credential-exposure caveats are the high-value gaps (see `doc_claim_vs_code`). Bound to the **Auth Mode** concept and the **Platform Operator** audience because the missing caveats are exactly what an operator needs before exposing this beyond a demo.

## Maintainer notes
