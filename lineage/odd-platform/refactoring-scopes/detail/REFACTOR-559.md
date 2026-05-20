## REFACTOR-559 — `ActivityServiceImpl.getDataEntityActivityList` has NO per-data-entity authorization gate — any authenticated user can read activity for any data entity they have no other permission to see, including JSON oldState/newState payloads of descriptions, ownership transitions, custom-metadata changes (STRENGTHENS REFACTOR-053 with the per-entity-endpoint primary source)

**Severity**: HIGH (cross-tenant data leak via the per-entity activity endpoint)
**Category**: missing-authz-gate
**Surfaced by**:
- `ActivityServiceImpl.md:stress_findings.S-D-3` (CANARY HEADLINE — AUTH GATE — "getDataEntityActivityList has no per-data-entity authorization — Every authenticated user can read activity for every data entity in the system, including data entities they have no other permission to see, and read the JSON old/newState payloads which may include description content, tag changes, ownership changes, term assignments")
- `ActivityServiceImpl.md:bugs_limitations_corner_cases[3]` ("getDataEntityActivityList has no per-data-entity authorization. Any authenticated user can query activity for any data entity (including data entities they have no permission to see)")
- `ActivityServiceImpl.md:security.data_exposure[1]` ("Activity payload for ANY data entity via `/api/activity/{dataEntityId}/list` → any authenticated user, no per-entity permission gate")
- `ActivityServiceImpl.md:security.known_security_gaps[0]` ("the entire Activity Feed is visible to any authenticated user across all owners — this is per-design for the global Activity Feed BUT operator-visible via the per-data-entity endpoint (`getDataEntityActivityList`) which exposes activity for entities the caller may have no other access to")
- `ReactiveActivityRepositoryImpl.md:security.data_exposure[0]` ("Activity row payload (id, event_type, old_state JSONB, new_state JSONB, is_system_event, created_at, created_by) → any authenticated caller via `findAllActivities` / `findDependentActivities` / `findDataEntityActivities`. The JSONB `old_state` / `new_state` columns carry user-supplied free-text content for DESCRIPTION_UPDATED, BUSINESS_NAME_UPDATED, internal-name edits, custom-metadata key/value pairs")
- `ActivityController.md:security.known_security_gaps[0]` (the global feed cross-owner gap — REFACTOR-053 is the canonical existing entry)
- `DataEntityController.getDataEntityActivity` sidecar (per existing batch — confirms the controller endpoint binds to this service method)

**Description**: `ActivityServiceImpl.getDataEntityActivityList(beginDate, endDate, size, dataEntityId, eventType, lastEventId, lastEventDateTime)` (`:119-136`) is the SERVICE-side implementation of the per-data-entity Activity tab. It:

1. Validates `beginDate`/`endDate` non-null (lines 128-130 — `BadUserRequestException` on null).
2. Calls `activityRepository.findDataEntityActivities(beginDate, endDate, size, dataEntityId, eventType, lastEventId, lastEventDateTime)` (line 132-133 — delegates to repo).
3. Maps the resulting `Flux<ActivityDto>` to `Activity` via the mapper.

**There is NO authorization check at any layer**:
- The controller (`DataEntityController.getDataEntityActivity` per existing sidecar) has NO `@PreAuthorize`.
- The OpenAPI-generated `DataEntityApi` interface carries no authorization annotations on this method.
- `SecurityConstants.SECURITY_RULES` has no entry covering `/api/dataentities/{id}/activity` — falls through to the catch-all `pathMatchers("/**").authenticated()`.
- The service method (this REFACTOR's surface) has no `@PreAuthorize`, no `permissionService.hasPermission(...)`, no owner-scoping check.
- The repository (`ReactiveActivityRepositoryImpl.findDataEntityActivities`) issues `DATA_ENTITY.ID.eq(dataEntityId)` unconditionally.

**The operator-visible consequence**: any authenticated user under LOGIN_FORM/OAUTH2/LDAP can probe the per-entity activity endpoint with arbitrary `dataEntityId` values and read:

- Description updates (full markdown content, possibly containing PII / customer identifiers / incident notes).
- Business name updates (rename history; potentially confidential codenames).
- Ownership transitions (who owns what, useful for org structure recon).
- Term assignments (the term taxonomy applied to the entity).
- Tag assignments (the tag set applied to the entity).
- Custom-metadata values (often free-text, often sensitive).
- Internal-name updates (dataset field internal_names; technical identifiers).
- Status transitions (data-entity lifecycle history).
- Alert configuration changes (data-quality halt-config edits).

For a data entity the caller HAS NO OTHER ACCESS TO — they cannot read the entity itself via `getDataEntityDetails` (REFACTOR-200 covers that for read-collaborative posture), but the per-entity activity surface exposes the SAME content via the audit-log payloads.

**Combination with REFACTOR-053**: REFACTOR-053 (`getActivity` cross-owner exposure) covers the GLOBAL feed endpoint. This REFACTOR is the PER-ENTITY counterpart — even if the global feed were eventually gated (Option 2 of REFACTOR-053), the per-entity surface bypass remains. The two together cover the read-collaborative-blast-radius family from both angles.

**Under `auth.type=DISABLED`**: anonymous traffic reaches both endpoints. The full audit trail of any data entity is anonymously readable. This is the REFACTOR-185 cross-cutting bypass.

**Cross-reference to VAL-LSN-019 canary A (Tag)**: REFACTOR-547 (TagServiceImpl ZERO service-tier auth) is the SAME class of finding at a different service. Both are instances of ADR-CANDIDATE-002 (centralized SECURITY_RULES at perimeter, no service-tier defence-in-depth) consequences. Where REFACTOR-547 covers Tag, this REFACTOR covers per-entity Activity. The cross-cutting story: ANY service whose endpoint is not covered by `SECURITY_RULES` AND whose controller has no `@PreAuthorize` falls through to catch-all `.authenticated()` — and the operator must trust the perimeter to enforce. This Activity-tier instance is one of N.

**Primary source citations**:
- `ActivityServiceImpl.java:119-136` (the service method body — verified absence of auth check)
- `ActivityServiceImpl.java:33-273` end-to-end (verified absence of @PreAuthorize, programmatic permission check, owner-scoping)
- `ReactiveActivityRepositoryImpl.java:128-142` (the repo method — verified no auth check; `DATA_ENTITY.ID.eq(dataEntityId)` unconditional)
- `SecurityConstants.java:95-356` end-to-end (verified absence of entry for `/api/dataentities/*/activity`)
- `AuthorizationCustomizer.java:29-30` (the catch-all `.authenticated()` fallback)
- `DataEntityController.getDataEntityActivity` (per existing batch sidecar — no controller-tier gate)
- WebFetch `/features/active-platform-features/activity-feed` (2026-05-20, status 200 — no per-entity visibility caveat)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (GET endpoints intentionally outside SECURITY_RULES — reads uniformly authenticated-only) prescribes this pattern. The per-entity Activity tab is consistent with that posture. The GAP is: ADR-CANDIDATE-003 was originally framed for the global activity feed; the per-entity surface inherits the same posture by default. The maintainer should EXPLICITLY decide whether per-entity activity should inherit the global posture OR whether per-entity activity should be gated by the same permission as `DATA_ENTITY_VIEW` (the entity-read permission).

**Proposed remedy**: Three options the maintainer can choose between:

1. **Accept and document (LOWEST cost — consistent with ADR-CANDIDATE-003)**: Add an admonition to `activity-feed.md`: "The per-entity Activity tab is visible to every authenticated user for every data entity. No per-entity authorization is enforced — the audit-trail payloads (descriptions, ownership history, custom-metadata changes) for any data entity can be read by any authenticated caller via `/api/dataentities/{id}/activity`. This is consistent with the platform's read-collaborative posture (ADR-CANDIDATE-003)."

2. **Tighten — add `DATA_ENTITY_VIEW` gate to per-entity activity (MEDIUM cost)**: Add a SECURITY_RULES entry for `/api/dataentities/{data_entity_id}/activity` gated by `DATA_ENTITY_VIEW` permission. The caller must be able to view the entity to read its activity log. Trade-off: breaks the read-collaborative posture (users without `DATA_ENTITY_VIEW` can't see audit history of entities they discover via other surfaces). UX impact: a data-quality engineer investigating "who changed this dataset last week" needs `DATA_ENTITY_VIEW`. Most teams already grant `DATA_ENTITY_VIEW` to authenticated users — so the UX impact is bounded.

3. **Tighten — add explicit `ACTIVITY_VIEW` permission (HIGHEST cost)**: Introduce a new permission key `ACTIVITY_VIEW` (or `AUDIT_TRAIL_READ`). Default-grant to admin role; operators choose which roles see activity. Trade-off: new permission key requires a backend ROLE/POLICY migration, UI permission-explorer update, doc page changes. Provides the cleanest separation but heaviest change.

**Recommended**: Option 1 + Option 2 hybrid. Document the current posture (Option 1 — closes the docs gap immediately). Pursue Option 2 in a future hardening sprint, paired with REFACTOR-053 (the global feed gate) — the per-entity gate would inherit from the global decision.

**Severity rationale**: HIGH — cross-tenant data leak. The audit-trail payloads carry user-supplied free-text content (descriptions, custom-metadata) that operators commonly use for sensitive information. Combined with the read-collaborative posture (every authenticated user has discovery access), this is a wide-blast-radius surface. Severity is bounded by:
- ADR-CANDIDATE-003 codifies the read-collaborative posture as intentional — the platform's design accepts this.
- The information leaked is per-entity activity, not platform-wide credentials.
- The fix is incremental (one SECURITY_RULES entry for Option 2).

**Suggested backlog grouping**: `SEC-NNN authorization-audit sprint` — pair with REFACTOR-053 (global feed cross-owner), REFACTOR-024 (cross-owner alerts), REFACTOR-200 (cross-owner data-entity-details), REFACTOR-203 (lineage enumeration), REFACTOR-187 (read-collaborative posture family). The Activity-per-entity instance completes the read-collaborative-blast-radius cataloguing.

---
