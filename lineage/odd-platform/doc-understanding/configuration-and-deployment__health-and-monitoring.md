---
doc_page: "docs/configuration-and-deployment/health-and-monitoring.md"
page_title: "Health and monitoring"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/health-and-monitoring"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/health-and-monitoring"
live_verified_at: "2026-06-11"
analysed_at_commit: "5d92250"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Advisory-lock-ID collision risk across subsystems"
    - "Plaintext DB credentials default + /actuator/env exposed default — compound credential-reachability"
  features: ["F-122", "F-030"]
  code_nodes:
    - "odd-platform java SessionConfiguration config-key-consumer:provider@L62"
audience: [operator]
doc_claim_vs_code: []
maintainer_curated: false
---

# Health and monitoring — doc understanding

New page (DOC-440, merged at documentation `5d92250`, first analysis). It is the canonical
operator home for the platform's monitoring surface: `/actuator/health` verdict semantics and
its three blindspots (Redis session store, advisory-lock wedges, ingestion write path),
Kubernetes/Compose probe wiring, `/actuator/prometheus` scraping, and the disambiguation from
the Metrics Ingestion feature. Primary binding is **F-122** (graph-node read: entry point
`GET /actuator/{env,health,prometheus,info}`, `/actuator/**` in `WHITELIST_PATHS` at
`SecurityConstants.java:95-96`) — this page is that surface's operator documentation. **F-030**
is bound for the page's two metrics-ingestion claims (the `POST /ingestion/metrics` 201-no-op
probe caveat and the `metrics.storage: PROMETHEUS` separate-instance disambiguation), confirmed
against F-030's entry point (`IngestionController.ingestMetrics`). The "what UP does not tell
you" warning documents the operator consequence of the **Advisory-lock-ID collision** invariant;
the Security-considerations section documents the exposure half of the
**plaintext-credentials + /actuator/env** invariant and routes to its hardening home. The one
bound code node, `SessionConfiguration config-key-consumer:provider@L62`, is the
`@ConditionalOnProperty(havingValue = "REDIS")` gate on the empty `RedisSessionConfiguration`
(`SessionConfiguration.java:61-65`) — the wiring whose absent health coverage the page's Redis
warning documents.

**Drift: none.** Every load-bearing claim was verified against code this session: management
block (`application.yml:226-245` — `enabled-by-default: false`, exposure include
`health, prometheus, env, info`, `management.health.{ldap,redis}.enabled: false` at 241-245);
unauthenticated `/actuator/**` in every auth mode (`SecurityConstants.java:95-96`); no custom
`HealthIndicator`/`HealthContributor` implementations (grep over `odd-platform-api/src/main/java`:
zero hits); bundled Micrometer Prometheus registry (`odd-platform-api/build.gradle:29`); port
8080 = framework default (no active `server.port` in `application.yml`). The 201-no-op ingestion
claim is the same finding already recorded in the metrics-ingestion page's sidecar
(`IngestionController.java:90-95`, no `.switchIfEmpty` guard); this page now documents it with a
link to the caveat's canonical home.

**Coverage signal (not a binding failure):** the page's primary code truths — the
`application.yml` management block, `SecurityConstants.WHITELIST_PATHS`, and the build-time
Micrometer dependency — have no CodeNode representation (searches returned empty). The extractor's
CodeNode granularity is controller-methods / config-key-consumers / config-properties-classes,
and `management.*` keys are consumed by the Spring framework, not by platform code, so
`describes.code_nodes` is thinner than the page's actual code grounding.

## Maintainer notes
<!-- preserved across re-analysis; hand-edits go here -->
