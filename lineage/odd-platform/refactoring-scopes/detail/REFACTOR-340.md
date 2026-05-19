## REFACTOR-340 — `GET /api/dataentities/{data_entity_id}/alerts` returns alerts to any authenticated user regardless of ownership; cross-owner read of per-entity alerts; STRENGTHENS REFACTOR-024 to the per-entity surface AND the audit-export workaround use case named in the live alerting doc

**Severity**: HIGH
**Category**: missing-auth (read-collaborative-blast-radius expansion to per-entity alert surface)
**Pillars affected**: [P-07-active-platform-features, P-09-security-access-control]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityAlerts.md:bugs_limitations_corner_cases.[0]` (HIGH) — "`GET /api/dataentities/{data_entity_id}/alerts` returns an entity's complete alert history to any authenticated user, regardless of ownership — the same cross-owner read posture as REFACTOR-024's `getAllAlerts`, applied to a per-entity surface. The controller has no permission gate (`DataEntityController.java:315-321`), `SecurityConstants.SECURITY_RULES` has no entry for the path (`SecurityConstants.java:98-355`), and the SQL is `WHERE DATA_ENTITY.ID = :id` with no `OWNERSHIP` join (`ReactiveAlertRepositoryImpl.java:182-199`). An attacker who enumerates `data_entity_id` values via any other read endpoint (e.g. `getDataEntityDetails`, the search endpoint) can use this endpoint to read every alert ever raised on every catalogued entity, including alert chunks (raw description text propagated from ingestion / AlertManager webhooks). The live alerting doc names this endpoint as the audit-export workaround for the housekeeping bug but does NOT say whether cross-owner access is intentional"
- `odd-platform__java__DataEntityController__controller-method__getDataEntityAlerts.md:security.known_security_gaps.[0]` (HIGH)

**Description**: The endpoint has NO authorization gate at any layer of the controller→service→repository chain:
- Controller (`DataEntityController.java:315-321`): no `@PreAuthorize`, no `@Secured`, no programmatic permission check.
- `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`): NO entry for `GET /api/dataentities/{data_entity_id}/alerts`. The path falls through to `pathMatchers('/**').authenticated()` at `AuthorizationCustomizer.java:29-30` — authentication is required; authorization is not enforced.
- Service (`AlertServiceImpl.java:138-143`): no principal pass-through; signature accepts only `(dataEntityId, page, size)`.
- Repository (`ReactiveAlertRepositoryImpl.java:182-199`): SQL is `SELECT ALERT.* FROM ALERT JOIN DATA_ENTITY ON DATA_ENTITY.ODDRN = ALERT.DATA_ENTITY_ODDRN WHERE DATA_ENTITY.ID = :id` — no `OWNERSHIP` join, no principal-derived predicate.

Every authenticated caller under LOGIN_FORM/OAUTH2/LDAP can read alerts for any data entity ID they choose to pass. The alert payload includes alert IDs, statuses, reasons, severity, the data entity reference, the status_updated_by owner identity, AND alert_chunk_list with descriptions including AlertManager-derived raw generator-URL text. An attacker who enumerates `data_entity_id` values (trivial via the search endpoint per REFACTOR-187 or the list endpoint per REFACTOR-024) can read every alert ever raised on every catalogued entity. Under `auth.type=DISABLED`, the endpoint becomes anonymously reachable.

**The audit-export workaround amplification**: the live alerting doc (WebFetched 2026-05-19 status 200) names this endpoint VERBATIM as the operator workaround for the housekeeping-cleanup bug: "GET /api/dataentities/{data_entity_id}/alerts returns the open and recently-resolved set including chunks and status history" — operators are EXPLICITLY directed to use this endpoint for compliance audit exports. The doc does NOT mention that cross-owner access is permitted; an owner using this for their own audit export is fine, but the same endpoint is also an enumeration vector for the unscoped read. The doc-vs-code asymmetry is the operator-trap.

This scope STRENGTHENS REFACTOR-024 (catalog-wide cross-owner enumeration on `getAllAlerts`) by extending the read-collaborative posture to the per-entity surface. The two together form a 2-sidecar pattern on the alert-read surface:
- REFACTOR-024 (batch A): `GET /api/alerts` (batch) — unscoped, all entities visible.
- THIS scope (batch L): `GET /api/dataentities/{id}/alerts` (per-entity) — unscoped, single-entity per call.

The per-entity surface is structurally consistent with **ADR-CANDIDATE-114 NEW batch L** (read-cardinality split — per-entity reads unscoped by design because caller chose the entity); the ADR endorses the read posture, this scope is the gap that the endorsement does not defend against (enumeration via the read posture).

**Primary source citations**:
- `DataEntityController.java:315-321` (controller method body; no permission annotations)
- `SecurityConstants.java:98-355` (rule list; no entry for the path)
- `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()` fallback)
- `AlertServiceImpl.java:138-143` (no principal parameter)
- `ReactiveAlertRepositoryImpl.java:182-199` (no OWNERSHIP join, no principal predicate)
- `ReactiveAlertRepositoryImpl.java:160-178` (`listByOwner` query — the SQL contrast; this one DOES join OWNERSHIP)
- WebFetch live alerting page 2026-05-19 status 200 (audit-export workaround named verbatim; permission posture unspecified)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-114 NEW batch L** (read-cardinality split — per-entity reads unscoped by design). The ADR endorses the read posture; this scope is the consequence the ADR does NOT defend. **ADR-CANDIDATE-003** (read-collaborative GET — every authenticated user enumerates the catalog). The implied prescription is one of three: (a) add per-entity owner-scoping at the read path (breaks the documented audit-export workaround for non-owners); (b) document the cross-owner posture at the live alerting page so operators understand the access model; (c) accept the read-collaborative posture and tighten DISABLED-mode reachability separately.

**Proposed remedy**: Three options. **(a) Add per-entity owner-scoping**: change the SQL to require an `OWNERSHIP` join + a principal-derived predicate. Add a `SecurityRule` entry for `GET /api/dataentities/{id}/alerts` with `DATA_ENTITY_ALERT_READ` permission scoped to the `data_entity_id`. Breaking change for non-owner consumers of the documented audit-export workaround. **(b) Document the cross-owner posture**: update the live alerting page to call out that any authenticated user can read any entity's alerts — operators understand the model when wiring the audit-export workaround. Lowest cost; clarifies the trade-off without changing behaviour. **(c) Two-tier permission model**: introduce a `MY_OBJECTS` mode (owner-scoped) and a `CATALOG` mode (cross-owner) as a query parameter; default to owner-scope and require an explicit `?scope=catalog` to opt into cross-owner. Breaks compatibility for the audit-export use case unless the doc is updated.

The maintainer's triage between (a), (b), and (c) depends on whether ADR-CANDIDATE-003 (read-collaborative) is a positive architectural commitment or a borderline-flag that needs maintainer resolution. The ADR-CANDIDATE-003 borderline flag was RESOLVED → intentional in batch F (per `getDataEntityDetails` confirmation); under that resolution, the consistent answer is (b) — document the cross-owner posture explicitly. The operator-trap is the doc-vs-code asymmetry, not the code itself.

**Severity rationale**: HIGH — wide blast radius (any authenticated user enumerates any entity's alerts); the alert payload contains AlertManager-derived raw text (potentially sensitive — generator URLs, alertmanager-injected labels, raw description chunks); the live doc names the endpoint as the audit-export workaround without disambiguating the access model. Combined with REFACTOR-024 (batch read counterpart), the alert-read surface is uniformly cross-owner-enumerable under the read-collaborative posture.

**Suggested backlog grouping**: `Authorization audit batch` (cluster with REFACTOR-024 — the batch counterpart; the two together cover the full alert-read surface). Companion DOC-NNN at the live alerting page (the audit-export workaround section must disclose the cross-owner posture).

---
