## REFACTOR-185 — STRENGTHENED BATCH Z — DISABLED-mode bypass + AUTH-MODE-ORTHOGONAL S2S-read surface — 17-sidecar (write paths) + 18-sidecar (read paths); the trust-gradient extends to read with the NEW AUTH-MODE-ORTHOGONAL property — the largest single security finding in the catalog gains the READ-side bookend complementing the centerpiece WRITE-side coverage

**Severity unchanged**: HIGH
**Updated support count**: now **17 + 18 sidecars** (16 prior at batch P + 1 batch-Z write side: postDataSetStatsList/ingestMetrics confirm WRITE pattern; +1 batch-Z read side: getDataEntitiesByDEGOddrn confirms the NEW AUTH-MODE-ORTHOGONAL READ surface property)
**Batch**: Z (2026-05-20)

**New surfaced_by**:
1. `postDataSetStatsList.md:bugs_limitations_corner_cases.[0]` (HIGH) — "Endpoint is UNAUTHENTICATED under EVERY combination of `auth.type` AND `auth.ingestion.filter.enabled`. `IngestionDataEntitiesFilter` (the only `AbstractIngestionFilter` subclass on the entity path) uses exact-literal path matcher `/ingestion/entities` POST (IngestionDataEntitiesFilter.java:28) — the sub-path `/ingestion/entities/datasets/stats` is NOT matched." — 17th supporting sidecar; ANOTHER write-side surface confirming the destructive-write bypass pattern
2. `ingestMetrics.md:bugs_limitations_corner_cases.[0]` (HIGH) — "`POST /ingestion/metrics` is UNAUTHENTICATED in every supported deployment posture. The controller has no `@PreAuthorize` (line 89-95). `IngestionDataEntitiesFilter` exact-matches `/ingestion/entities` POST only ... `IngestionDataSourceFilter` exact-matches `/ingestion/datasources` POST only ... `/ingestion/**` is in `SecurityConstants.WHITELIST_PATHS` ..." — yet another write-side surface confirming the destructive-write bypass pattern (the 17th batch-Z sidecar may be considered as 17a + 17b for postDataSetStatsList + ingestMetrics; depending on whether the maintainer wants distinct sidecar counts per endpoint or per method)
3. **NEW READ-SIDE SURFACE** — `getDataEntitiesByDEGOddrn.md:bugs_limitations_corner_cases.[0]` (HIGH) + `security.auth_mode_relevance` — "Endpoint is UNAUTHENTICATED in EVERY shipped deployment mode — including when the operator has enabled `auth.ingestion.filter.enabled=true` believing they have locked down the ingestion surface." — the **18th sidecar AND the first READ-side surface** in the family. The pattern extends from "destructive-write" to "cross-owner read enumeration" — both anonymously reachable under bundled defaults.

**Cross-batch picture — the AUTH-MODE-ORTHOGONAL property emerges**:

The original REFACTOR-185 framing was "DISABLED-mode bypass" (focused on the auth.type=DISABLED default that exempts everything). Batches B through Y enumerated 16 sidecars under this framing.

Batch Z surfaces a NEW STRUCTURAL PROPERTY: **AUTH-MODE-ORTHOGONAL reachability** for the `/ingestion/**` sibling endpoints (NOT just POST /ingestion/entities — also stats, metrics, AND the GET /ingestion/entities/{deg_oddrn} read endpoint):

| Endpoint | Filter coverage | Default reachable in DISABLED? | Default reachable in LOGIN_FORM/OAUTH2/LDAP? |
|---|---|---|---|
| `POST /ingestion/entities` | IngestionDataEntitiesFilter (off by default) | YES (REFACTOR-185 OG) | YES under default (filter OFF + UI-auth whitelisted) |
| `POST /ingestion/entities/datasets/stats` | NONE (sibling — path not matched) | YES | YES — TOGGLE DOES NOT HELP |
| `POST /ingestion/metrics` | NONE (no path-scoped filter) | YES | YES — TOGGLE DOES NOT HELP |
| **GET `/ingestion/entities/{deg_oddrn}`** (NEW batch Z) | NONE (POST-only matcher excludes GET) | YES | YES — TOGGLE DOES NOT HELP |
| `POST /ingestion/alert/alertmanager` | NONE (ADR-CANDIDATE-006 — network-delegated) | YES | YES — INTENTIONAL (operator runs reverse proxy) |
| `POST /ingestion/datasources` | IngestionDataSourceFilter (always on) | NO | NO |

The original REFACTOR-185 covered the DISABLED-mode bypass. Batch Z reveals that the 3 sibling endpoints (stats / metrics / GET DEG-members) are **uncovered even when the operator enables every shipped auth toggle**. The `auth.ingestion.filter.enabled=true` toggle covers ONLY `POST /ingestion/entities`; the operator-facing property name implies broader coverage than it delivers.

**Updated full triangulation enumeration (now 17 + 18 sidecars)**:
- Batch B/C/E/F/M/O/P (prior 16): per the batch-P strengthen — IngestionDataEntitiesFilter + DisabledAuthSecurityConfiguration + the 12 controller methods + the OwnerController write paths
- **NEW Batch Z write-side**: postDataSetStatsList + ingestMetrics — confirming the destructive-write surface extends beyond `POST /ingestion/entities` to 2 sibling write endpoints (17th surface, double-counted)
- **NEW Batch Z read-side**: getDataEntitiesByDEGOddrn — confirming the AUTH-MODE-ORTHOGONAL property for read endpoints (18th surface; the architectural bookend to the write-side coverage)

**The architectural picture — F-008 5-vertex + AUTH-MODE-ORTHOGONAL READ surface**:
- F-008 (Batch Ingestion) covers `POST /ingestion/entities` destructive-write under default-off auth
- Batch Z adds 3 sibling endpoints under DIFFERENT auth-coverage (stats, metrics, GET DEG-members)
- Together: the entire `/ingestion/**` namespace is anonymously reachable under bundled defaults — with NO toggle protecting the 3 batch-Z siblings
- Combined with REFACTOR-024 (cross-owner read posture) + REFACTOR-203 (lineage cross-owner enumeration): the cross-owner enumeration vector now extends to the S2S surface AND the cross-owner write vector extends to stats/metrics

**Severity unchanged at HIGH**: the deployment-default risk INTENSIFIES with batch Z's enumeration. The maintainer's prescription (boot-time validator per REFACTOR-073) remains the highest-leverage cross-cutting fix — and the validator should compound-check ALL FIVE `/ingestion/*` paths (per REFACTOR-539's enumeration), not just the OG POST /ingestion/entities surface.

**Updated proposed remedy** (extended from prior batches):
1. **Boot-time security-posture validator** (REFACTOR-073 prescription) — extended to compound-check `auth.type=DISABLED + auth.ingestion.filter.enabled=false + the 3 sibling endpoints' unauthenticated reachability`; emit fail-loud WARN per the 5-endpoint matrix
2. **Per-endpoint filters for stats / metrics / DEG-read** (per REFACTOR-539) — close the structural gap
3. **Doc-side cross-link** — the live data-quality + active-platform-features pages MUST surface the auth posture (the security page already documents it; the feature pages do not cross-reference)
4. **Property rename** (per REFACTOR-539) — `auth.ingestion.filter.enabled` → `auth.ingestion.entities-filter.enabled` for operator clarity

**Triangulation count**: 17 + 18 sidecars depending on counting convention. The strongest single finding in the catalog by a significant and now AUTH-MODE-ORTHOGONALLY-extended margin.

---
