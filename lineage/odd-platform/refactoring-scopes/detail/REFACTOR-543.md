## REFACTOR-543 — `postDataSetStatsList` TAG_CREATE-permission bypass — statistics payloads with arbitrary `tags` arrays cause `tagService.getOrCreateTagsByName(...)` to mint new catalog tags UNAUTHENTICATEDLY via the EXTERNAL_STATISTICS origin side-channel

**Severity**: HIGH
**Category**: missing-auth-side-channel + permission-bypass + missing-validation
**Batch**: Z (2026-05-20)
**Pillars affected**: [P-04-data-quality (the stats path), P-01-data-discovery (tag taxonomy is searchable), P-08-management-administration (the Tags management UI is RBAC-gated; this is the side-channel), P-09-security-access-control (the permission-bypass surface)]

**Surfaced by**:
- `postDataSetStatsList.md:bugs_limitations_corner_cases.[5]` (MEDIUM, escalated by cross-batch context to HIGH per the unauthenticated-reach compound) — "Tag-creation-as-side-effect is reachable WITHOUT authentication AND WITHOUT TAG_CREATE permission. `tagService.getOrCreateTagsByName(...)` (DatasetFieldServiceImpl.java:202) is called inside `updateStatistics` and creates any tag name in the payload. The normal Tags-management UI surface is RBAC-gated; the stats path is the side-channel. An attacker can populate the catalog's tag taxonomy with arbitrary tag names by submitting `DatasetStatisticsList` payloads. The tags will be discoverable by all authenticated users via the catalog's tag search and tag-filter facet."
- `postDataSetStatsList.md:security.known_security_gaps.[2]` (MEDIUM) — "Tag-creation-as-side-effect bypasses `TAG_CREATE` permission. Statistics payloads with `DataSetFieldStat.tags = [{name: 'attacker-controlled'}]` create new catalog tags unauthenticatedly. The Tags management UI is RBAC-gated; the stats path is the bypass. Tags persist in the global tag namespace and are discoverable by all authenticated users via tag search and tag-filter facets."

**Statement**: The platform's Tags management UI is gated by the `TAG_CREATE` permission (per `SecurityConstants.SECURITY_RULES` — verified at the Management-tier sidecars in batches W and V). The `TagController.createTag` endpoint requires the caller to have `TAG_CREATE` in their Policy set. This is the intended RBAC surface for catalog tag taxonomy curation.

The stats-ingestion path provides an UNAUTHENTICATED SIDE-CHANNEL into the same write surface:

1. `POST /ingestion/entities/datasets/stats` is unauthenticated in every mode (per REFACTOR-539).
2. The `DataSetFieldStat` payload type carries an optional `tags: List<Tag>` array per field (per the OpenAPI ingestion contract).
3. `DatasetFieldServiceImpl.updateFieldsTags` (lines 191-231) calls `tagService.getOrCreateTagsByName(...)` (line 202) on every tag name in the payload — CREATING new `tag` rows in the catalog if they don't exist.
4. The created tags are stamped with `TagOrigin.EXTERNAL_STATISTICS` (TagOrigin.java:6 — to distinguish from `INTERNAL` (UI-curated) tags).
5. The created tags are discoverable by ALL authenticated users via the catalog's tag search + tag-filter facet (per the platform-wide read-collaborative posture — ADR-CANDIDATE-003).

**The attack vector**: an unauthenticated network probe submitting a `DatasetStatisticsList` payload with arbitrary `tags` arrays populates the catalog's tag namespace with attacker-controlled tag names. The tags persist; they appear in search; they affect operator UX (tag-filter facet aggregations); they may be used as a forensic-confusion vector (polluting the tag namespace before another attack).

**The architectural justification (TagOrigin.EXTERNAL_STATISTICS) does NOT defend this surface.** The origin field exists so that re-ingestion can distinguish "tags I previously stamped via EXTERNAL_STATISTICS" from "tags the UI user manually attached" — the reconciliation logic at `DatasetFieldServiceImpl.java:221-223` only removes EXTERNAL_STATISTICS-origin relations on replay. The intent is correct (don't trample UI-curated tags); the gap is that the unauthenticated CREATE was not on the architect's threat model.

**Primary source citations**:
- `IngestionController.java:81-87` (postDataSetStatsList — no auth)
- `DatasetFieldServiceImpl.java:191-231` (`updateFieldsTags` — calls `getOrCreateTagsByName`)
- `DatasetFieldServiceImpl.java:202` (the `tagService.getOrCreateTagsByName(tagNames)` call)
- `DatasetFieldServiceImpl.java:273-278` (`createExternalStatisticsRelation` — stamps `TagOrigin.EXTERNAL_STATISTICS`)
- `TagOrigin.java:6` (the enum value)
- `TagController` SecurityConstants entry — `TAG_CREATE` permission (per the management-tier sidecars)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-027 STRENGTHENED batch Z (ingestion auth trust gradient — this endpoint is unauthenticated). ADR-CANDIDATE-061 (ingestion controller-side semantic validation — the architectural opinion is "controller enforces semantics"; the absent semantic IS "tag-creation-as-side-effect should not happen via an unauthenticated path"). ADR-CANDIDATE-192 NEW batch Z (read-collaborative posture — but TAG_CREATE is a WRITE permission; this surface deserves the WRITE-side gating).

**Proposed remedy** (multi-option):

**Option A — Inline `TAG_CREATE` check on the stats path (LOW effort)**:
- Once the endpoint has auth (per REFACTOR-539's cross-cutting fix), add a programmatic permission check inside `updateFieldsTags`: if the caller lacks `TAG_CREATE`, drop new tag names from the payload (don't fail the entire request; just silently drop unsafe tags from the EXTERNAL_STATISTICS reconciliation)
- Trade-off: silent dropping may surprise operators; alternative is to fail the request with 403

**Option B — Allowlist-only tag creation on the stats path (MEDIUM effort)**:
- Pre-populate an "EXTERNAL_STATISTICS allowed tags" config list (admin-curated)
- Stats payloads can attach EXISTING allowed tags but cannot CREATE new tag names
- Operators wanting to add a new EXTERNAL_STATISTICS-origin tag must do it via the Management UI (gated by `TAG_CREATE`)
- Trade-off: rigid; collectors that emit novel tags fail until an operator pre-creates them

**Option C — Cross-cutting: route ALL tag creation through the same RBAC surface (HIGH effort)**:
- Refactor `tagService.getOrCreateTagsByName` to require a permission context
- Every call site (UI, ingestion, etc.) supplies the caller's permission set
- Centralized RBAC enforcement; eliminates the side-channel structurally
- Recommended for the long-term but requires touching every consumer

Recommend: **Option B (immediate)** as a defensible default + **Option C (medium-term)** as the structural fix. Option A is the minimum bar once REFACTOR-539's auth fix lands.

**Severity rationale**: HIGH — unauthenticated permission-bypass into a Management-UI-gated surface; catalog tag namespace pollution is operator-visible across the entire platform; the architectural justification (TagOrigin.EXTERNAL_STATISTICS) does NOT defend the unauthenticated CREATE; cross-link with REFACTOR-539 (the broader unauth ingestion cluster) and REFACTOR-542 (the cross-dataset stats-write on the same endpoint) makes postDataSetStatsList the most-attacker-friendly write surface in the platform.

**Suggested backlog grouping**: `Ingestion-write validation hardening sprint` co-batched with REFACTOR-542, REFACTOR-539, REFACTOR-540. A single sprint covering the postDataSetStatsList endpoint can close the cross-dataset write + the TAG_CREATE bypass + the missing-auth + the missing-tenant-isolation simultaneously.

---
