# REFACTOR-641 — `createOwner` and `updateOwner` declare HTTP `201 Created` in OpenAPI but return HTTP `200 OK` — class-wide drift on mutating endpoints; tests assert `isOk()` locking in the drift

**Severity**: MEDIUM
**Category**: openapi-spec-impl-drift + status-code-drift
**Pillars affected**: [P-08 Management & Administration (Owner), P-06 Configuration & Deployment]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**OpenAPI vs implementation status-code drift is class-wide on mutating endpoints** — `createOwner` declares `201` returns `200` (`openapi.yaml:165-171` vs `OwnerController.java:26`); `updateOwner` declares `201` returns `200` (`openapi.yaml:195-201` vs `OwnerController.java:53`). Sibling write operations across the platform (`PUT /api/policies/{id}`, `PUT /api/tags/{id}`, `PUT /api/roles/{id}`) show similar drift per the F-006 batch sidecars — this is platform-wide pattern, but the OwnerController exhibits it on two of its three mutating methods."
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:concepts.invariants.[OpenAPI-vs-implementation-status-code-drift]` — class-wide enumeration: createOwner (201→200), updateOwner (201→200), deleteOwner (204→204 align), getOwnerList (200→200 align). The two mutating-create/update methods drift; the read/delete align.

**Description**: Owner-side instance of the platform-wide OpenAPI 201-vs-200 drift pattern (REFACTOR-545 cluster):

| Endpoint | OpenAPI declares | Impl returns | Test asserts |
|---|---|---|---|
| `POST /api/owners` | 201 Created | 200 OK | isOk() (200) — none currently |
| `PUT /api/owners/{id}` | 201 Created | 200 OK | isOk() (200) — none currently |
| `DELETE /api/owners/{id}` | 204 No Content | 204 No Content | align — none currently |
| `GET /api/owners` | 200 OK | 200 OK | align — none currently |

The drift is locked in by the IMPLEMENTATION; the spec is wrong. A spec-conformant OpenAPI-codegen client expecting `201 Created` on a successful create or update treats the `200 OK` response as "unexpected" — typically falling into a generic-response path rather than the typed-response path.

Cross-batch context: the SAME drift exists on:
- DataSourceController (REFACTOR-591 — POST + PUT 201 declared, 200 returned)
- TagController (REFACTOR-492 — createTag + updateTag 200 returned, 201 declared)
- PolicyController, RoleController, etc. (per ZD batch findings)

The platform-wide cluster anchor is **REFACTOR-545** (OpenAPI status-code drift cluster — 9+ endpoint-level instances across 7+ controllers; the maintenance principle is fix-spec-not-code).

**Operator-visible failure modes**:

1. **Spec-generated clients mis-handle** — third-party developers using the OpenAPI spec to generate clients write code asserting `status == 201` on create / update; the actual 200 falls into the `default` branch (typically an error case).
2. **API contract drift** — operators reading the live OpenAPI page see "201 Created" on the endpoint description; the actual 200 confuses debugging when responses don't match documentation.
3. **Locked-in by tests** (when added) — any future test asserting `isCreated()` (201) will fail; the test author adapts by changing to `isOk()`, cementing the drift.

**Primary source citations**:
- `<odd-platform-specification>/openapi.yaml:165-171` (createOwner 201 declaration).
- `<odd-platform-specification>/openapi.yaml:195-201` (updateOwner 201 declaration).
- `<odd-platform-api>/src/main/java/.../OwnerController.java:26` (createOwner returns `.map(ResponseEntity::ok)`).
- `<odd-platform-api>/src/main/java/.../OwnerController.java:53` (updateOwner returns `.map(ResponseEntity::ok)`).

**Existing-ADR-or-implied-prescription**: No specific ADR; the pattern of fix-spec-not-code (preserve impl, fix spec, lock in with tests) is the platform-wide maintenance principle. Sibling: REFACTOR-545 (the cluster anchor) + REFACTOR-591 / 492 (sibling instances).

**Proposed remedy**: Three-part fix:

1. **Fix the OpenAPI spec** (in the upstream `opendatadiscovery-specification` repo's `openapi.yaml`):

```yaml
# /api/owners POST — change 201 to 200
'200':
  description: OK (Owner created)
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/Owner'

# /api/owners/{owner_id} PUT — same change
```

2. **Add 403 declarations** to all three mutating endpoints (per the sidecar's docs_link_semantic.doc_drift_findings[1] — createOwner declares 403 but updateOwner and deleteOwner do not):

```yaml
'403':
  $ref: './components.yaml/#/components/responses/Forbidden'
```

3. **Add integration tests** asserting `isOk()` (200) on successful create/update — locks the choice in.

4. **Update live docs / api-reference page** once the spec is fixed.

**Severity rationale**: MEDIUM — operator-actionable spec-vs-code drift; third-party clients are the affected population; the fix is upstream-spec + tests-lock-in. Pairs with REFACTOR-545 (the cluster anchor) — Owner is the latest instance in the 9+ cluster.

**Suggested backlog grouping**: `OpenAPI spec drift hardening sprint` — bundle with REFACTOR-545's existing instances + sibling new entries from batch ZF (REFACTOR-639 DataCollab 302-vs-301 + REFACTOR-642 MetadataField PageInfo theatre).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-545 (cluster anchor — 10th instance); REFACTOR-491 (Tag); REFACTOR-591 (DataSource).
- SUPERSEDES: none.
- CONFLICTS: none.

---
