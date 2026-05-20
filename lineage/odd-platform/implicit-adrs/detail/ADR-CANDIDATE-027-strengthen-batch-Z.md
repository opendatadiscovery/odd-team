## ADR-CANDIDATE-027 — STRENGTHENED BATCH Z — Ingestion auth trust gradient now spans FOUR endpoints with FIVE distinct postures; batch-Z adds 3 sibling endpoints that confirm the IngestionDataEntitiesFilter's exact-literal path matcher leaves the namespace patchily covered; ADR-CANDIDATE-192 NEW batch Z documents a fourth tier (AUTH-MODE-ORTHOGONAL S2S reads)

**Severity unchanged**: HIGH
**Updated support count**: now **4 sibling endpoints surfaced** (IngestionDataEntitiesFilter primary + 3 batch-Z confirmations: getDataEntitiesByDEGOddrn + postDataSetStatsList + ingestMetrics)
**Batch**: Z (2026-05-20)

**New surfaced_by**:
1. `getDataEntitiesByDEGOddrn.md:bugs_limitations_corner_cases.[0]` (HIGH) — "**Endpoint is UNAUTHENTICATED in EVERY shipped deployment mode** — including when the operator has enabled `auth.ingestion.filter.enabled=true` believing they have locked down the ingestion surface. The filter's path matcher is hard-coded to `POST /ingestion/entities` exactly (`IngestionDataEntitiesFilter.java:28`); GET `/ingestion/entities/{anything}` does NOT match." — EXPLICITLY confirms the exact-literal path matcher excludes the templated child path; the read-side complement of the original ADR-027 entity-write endpoint.

2. `postDataSetStatsList.md:concepts.invariants.[0]` (HIGH) — "Controller has no authorization at the method level — neither `@PreAuthorize` on `postDataSetStatsList` nor on the `IngestionApi` interface it implements... Unlike the sibling `postDataEntityList`, this path is ALSO not covered by any `AbstractIngestionFilter` subclass: `IngestionDataEntitiesFilter` binds exactly to `/ingestion/entities` POST (IngestionDataEntitiesFilter.java:28 — `PathPatternParserServerWebExchangeMatcher(\"/ingestion/entities\", HttpMethod.POST)`), and the path matcher is exact-literal — it does NOT match the sub-path `/ingestion/entities/datasets/stats`."

3. `ingestMetrics.md:concepts.invariants.[0]` (HIGH) — "Controller has no authorization at the method level — neither `@PreAuthorize` on `ingestMetrics` nor on the `IngestionApi` interface it implements... No `IngestionDataEntitiesFilter`-style path-scoped filter exists for `/ingestion/metrics` — the bundled codebase has TWO ingestion filters (`IngestionDataEntitiesFilter` matching `/ingestion/entities` POST, `IngestionDataSourceFilter` matching `/ingestion/datasources` POST), neither of which extends to the metrics path. The endpoint is unauthenticated in EVERY supported deployment posture."

4. **PRIMARY SOURCE — Live security doc evidence** (`postDataSetStatsList.md:docs_link_semantic.inferred_docs.[1]` — WebFetched 2026-05-20 status 200): "All other /ingestion/* paths (e.g. /ingestion/alert/alertmanager, /ingestion/entities/degs/children, /ingestion/entities/datasets/stats) ... remain outside the ingestion filter's coverage." AND: "Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP — even when the ingestion filter is enabled." The Security docs page EXPLICITLY documents the filter-coverage gap on the same endpoints batch-Z surfaces — strong cross-validation between code-side evidence and operator-facing doc.

**Cross-batch picture — the auth trust gradient is now FIVE-TIER**:

| Endpoint | Filter | Default | Reachability |
|---|---|---|---|
| `POST /ingestion/datasources` (datasource registration) | `IngestionDataSourceFilter` (unconditional) | ALWAYS protected | Token required in every mode |
| `POST /ingestion/entities` (data-entity ingestion) | `IngestionDataEntitiesFilter` (`@ConditionalOnProperty`) | OPT-IN protected | Default-OFF; toggle by `auth.ingestion.filter.enabled=true` |
| `POST /ingestion/alert/alertmanager` (AlertManager webhook) | NONE | OPERATOR-NETWORK-DELEGATED | Always unauthenticated; operator runs reverse proxy / network ACL |
| `POST /ingestion/entities/datasets/stats` (DQ stats — **NEW batch Z**) | NONE — sibling path NOT matched by IngestionDataEntitiesFilter's exact-literal matcher | UNAUTHENTICATED IN EVERY MODE | NO toggle changes this; live docs DOCUMENT the gap |
| `POST /ingestion/metrics` (metrics ingestion — **NEW batch Z**) | NONE — no path-scoped filter exists | UNAUTHENTICATED IN EVERY MODE | NO toggle changes this; live docs DOCUMENT the gap |
| **GET `/ingestion/entities/{deg_oddrn}` (S2S read — NEW batch Z)** | NONE — filter's POST-only matcher excludes GET + templated path | AUTH-MODE-ORTHOGONAL — UNAUTHENTICATED IN EVERY MODE | The fourth-tier surface; companion ADR-CANDIDATE-192 NEW batch Z documents this specific posture |

**The five-posture map confirms the trust gradient is INTENTIONAL** at the maintainer's authoring layer:
- **MANDATORY-TOKEN**: bootstrap requirement (datasources)
- **OPT-IN-TOKEN**: per-deployment operator choice (entity ingestion)
- **NETWORK-DELEGATED**: third-party webhook trust boundary (AlertManager)
- **NO-CONFIGURABLE-AUTH**: write surfaces siblings of `/ingestion/entities` that the operator-facing property name implies are covered but aren't (stats, metrics)
- **AUTH-MODE-ORTHOGONAL**: read surfaces under `/ingestion/**` (DEG memberships) — same property compound as the no-configurable-auth write siblings

**The architectural opinion sharpens** with batch Z:
1. **The trust gradient is real** (5 distinct postures across 6 endpoints) — the maintainer DID think about each endpoint's auth requirement separately.
2. **The implementation does NOT reflect the gradient cleanly** — the path-scoped filter pattern (one filter class per endpoint) is consistent, but the operator-facing property name (`auth.ingestion.filter.enabled`) is misleadingly broad (it gates ONE filter covering ONE endpoint, not "ingestion" generally).
3. **The live security doc DOCUMENTS the asymmetry** (WebFetched 2026-05-20 status 200 evidence above) — operators reading the security page learn the gap; operators reading the data-quality page or the metrics-storage page do not get the cross-reference.

**Companion NEW ADRs from batch Z**:
- ADR-CANDIDATE-192 NEW batch Z — read-collaborative S2S read posture with AUTH-MODE-ORTHOGONAL property — the fourth tier of the trust gradient surfaced explicitly with borderline_flag for maintainer triage

**Severity unchanged at HIGH** — the auth-architecture decision is the platform's most security-relevant configuration surface. Batch Z confirms the gradient extends to FIVE postures across SIX endpoints; the gap-shaped consequences (REFACTOR-539 NEW batch Z, REFACTOR-185 STRENGTHENED batch Z) are now triangulated across read + write + entity + stats + metrics paths.

**Updated proposed action**: Strengthen the existing `adrs/drafts/ingestion-endpoint-auth-trust-gradient.md` candidate to:
1. Document the full 5-posture × 6-endpoint matrix
2. Surface the AUTH-MODE-ORTHOGONAL fourth tier explicitly (ADR-CANDIDATE-192 NEW batch Z is the canonical primary)
3. Rename or clarify the `auth.ingestion.filter.enabled` property — the operator-facing name should signal "covers ONE endpoint exactly" rather than the namespace-scoped reading
4. Surface the cross-reference on the live data-quality + active-platform-features doc pages, not just on the security page

---
