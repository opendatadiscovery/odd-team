# SHB-001 — Data Entity staleness signal

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators see a per-entity "source has stopped publishing" indicator across every UI surface that lists or shows a Data Entity, computed from a single predicate `lastIngestedAt + odd.data-entity-stale-period < now()`. The signal exists because acting on silently-stale data is a primary failure mode for data platforms — it is product-essential, not cosmetic. As of 2026-05-26 there is no `F-NNN` anchored on this; the methodology references it only tangentially in F-035 (config-key drift discussion).

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityStaleDetector.java:13` — the predicate, the only place the rule is stated: `pojo.getLastIngestedAt() != null && stalePeriod != null && DateTimeUtil.generateNow().isAfter(pojo.getLastIngestedAt().plusDays(stalePeriod))`. Five-line `@Component`, no scheduling, no caching — pure synchronous predicate consumed by mappers.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityStaleDetector.java:11` — config-key binding `@Value("${odd.data-entity-stale-period}")` → integer days; `@Value` ⇒ read once at startup, threshold cannot be changed without restart.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/DataEntityMapperImpl.java:163,279,492,547` — four callsites imprint `.isStale(...)` on at least four distinct response-DTO variants (search results, list items, details, sub-projection).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/LineageMapper.java:143` — a fifth callsite imprints `isStale` on lineage-graph nodes; staleness propagates into the Data Lineage pillar's primary view.
- `odd-platform-specification/components.yaml:609,918,2010` — `is_stale: boolean` is a **REQUIRED** field on three distinct DTOs (DataEntityRef, DataEntity, DataEntityDetails — the schemas every list/detail/lineage endpoint returns).
- `odd-platform-ui/src/components/shared/elements/MetadataStale/MetadataStale.tsx` — dedicated UI primitive for rendering the indicator (badge/icon shape TBD; need to read).
- `odd-platform-ui/src/components/Search/Results/ResultItem/ResultItem.tsx`, `.../Directory/Entities/EntitiesList/EntityItem/EntityItem.tsx`, `.../DataEntityDetails/DataEntityDetailsHeader/DataEntityDetailsHeader.tsx`, `.../Terms/TermDetails/TermLinkedEntitiesList/LinkedEntity/LinkedEntity.tsx`, `.../Overview/OwnerAssociation/OwnerEntitiesList/DataEntityList/DataEntityList.tsx`, `.../DataModelling/QueryExampleDetails/QuertExampleDetailsLinkedEntitiesItem.tsx`, `.../DataEntityDetails/DataEntityDetails.tsx`, `.../Directory/Entities/EntitiesList/EntitiesList.tsx`, `.../lib/hooks/api/dataEntity.ts` — **ten** UI consumers; the indicator is cross-cutting across Search / Directory / Detail / Lineage / Terms / Owner-Association / Data-Modelling surfaces.
- `odd-platform-api/src/main/resources/application.yml:208-214` — the `odd:` block where `data-entity-stale-period` lives; tangentially referenced in F-035's @ConfigurationProperties discussion as "consumed via scattered @Value reads."

## Notes

- The predicate is O(1) per row, no DB calls — performance contract is implicit and trivially met.
- **Caveat 1 (likely Class-1 silent-default footgun):** if `odd.data-entity-stale-period` is unset in `application.yml` (or set to null), the predicate's `stalePeriod != null` guard returns `false` → **every entity reports `is_stale: false` silently.** No log, no warning, no admin-visible signal that the indicator is dead. Same shape as LSN-001 (attachment-ephemeral default) and LSN-002 (minio-region-unset). Verify by reading defaults in `application.yml`; if absent, file a refactoring-scope.
- **Caveat 2 (semantic edge case):** `pojo.getLastIngestedAt() != null` guard means an entity that has NEVER been ingested (e.g. a manually-created data entity, or an entity pending its first ingestion) is shown as `is_stale: false` — which is misleading. The operator sees "fresh" for an entity that has no data at all. Worth confirming by reading the ingestion path: does `lastIngestedAt` get set on registration or only on first ingestion event?
- **Caveat 3 (integrity boundary):** anyone with ingestion-write capability can forge freshness by emitting an ingestion event with a current timestamp; the predicate has no notion of source authenticity. This is a real boundary, not a hypothetical — but it may be deliberate (multi-tenant ingestion is part of the threat model). Confirm against the ingestion-auth Sidecar(s).
- **Caveat 4 (clock-skew flicker):** predicate uses `DateTimeUtil.generateNow()` per mapper invocation. If platform nodes have wall-clock skew and an entity's lastIngestedAt is within `stalePeriod ± skew` of "now," the `is_stale` value flickers across requests depending on which node mapped the response. Probably immaterial in single-node deployments; relevant if the platform is horizontally scaled.
- The config key is **deployment-wide** — there is no per-tenant / per-namespace / per-data-source threshold. Operators of mixed-cadence environments (some sources update hourly, some weekly) get a single global window. Known limitation, not a bug.
- F-035 (Spring @ConfigurationProperties binding fragility) mentions `DataEntityStaleDetector` only as one example of "@Value reads scattered across services" — i.e. the staleness logic is referenced as evidence of a *different* drift (binding-style inconsistency), never anchored as its own feature.
- This thread is "clustering" not "open" because evidence is already mature — 11 evidence refs spanning service-tier predicate / mapper-tier imprinting / spec DTOs / 10 UI consumers / config binding. The graduation-to-feature gate (>3 evidence, ≥2 axes, hypothesis falsifiable) is met. The deferral is *capacity*, not *evidence*.

## Next

1. **Graduate.** On the next `/next-batch` or `/code-walk`, the feature-flow-builder should mint `F-044 — Data Entity Staleness Indicator` with `seeded_from: SHB-001` and `primary_subject: [DataEntityStaleDetector, DataEntityMapperImpl, LineageMapper, components.yaml:DataEntityRef/DataEntity/DataEntityDetails:is_stale, MetadataStale.tsx]`. Pillar: Data Discovery (or Data Quality if the mission file calls one out). Test matrix: predicate-unit (cheap) / config-binding-integration / mapper-integration / UI-render. Coverage estimate: probably 0 — there is no test file for `DataEntityStaleDetector`.
2. **Open follow-ups** for the four caveats:
   - REFACTOR-NNN — unset-`odd.data-entity-stale-period` silently disables the indicator (verify default; if absent, classify HIGH).
   - REFACTOR-NNN — never-ingested entity reported as `is_stale: false` (semantic correctness).
   - SEC-NNN — ingestion-write forgery of `lastIngestedAt` (integrity boundary; may already be a known limitation — check threat model).
   - REFACTOR-NNN — clock-skew flicker across nodes in horizontally-scaled deployments.
3. **DOC-NNN** — `docs.opendatadiscovery.org` does not currently describe "what makes a data entity stale." Verify via WebFetch; if absent, file a DOC-GAP citing the predicate file:line as the source-of-truth.

## Links

- cluster_with: []
- merged_into: (set when graduated to F-044)
- supersedes: []

## evaluation

(feature-flow-builder will append a dated entry here on its next run.)
