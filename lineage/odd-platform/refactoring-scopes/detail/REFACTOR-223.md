## REFACTOR-223 — Tag side-door — `DATA_ENTITY_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE` permission; scope-asymmetry pollutes the tag dropdown across tenants

**Severity**: MEDIUM
**Category**: permission-bypass
**Surfaced by**:
- `createDataEntityTagsRelations.md:bugs_limitations_corner_cases[0]` (the side-door)
- `createDataEntityTagsRelations.md:security.known_security_gaps[0]`
- `createDataEntityTagsRelations.md:security.known_security_gaps[1]` (cross-tenant pollution)

**Description**: A caller with `DATA_ENTITY_TAGS_UPDATE` on any single data entity can submit `tag_name_list: ['arbitrary-new-name']` and a new row appears in the global `tag` directory (visible to every other user via `GET /api/tags/popular`). The documented permission story ("`TAG_CREATE` controls the Tag directory") is incomplete: `DATA_ENTITY_TAGS_UPDATE` also grows the directory, by spec-acknowledged design (ADR-CANDIDATE-065 — auto-create-on-miss). The **scope asymmetry** exacerbates the consequence: `TAG_CREATE` is `MANAGEMENT`-scoped (always unconditional, granted via admin Policies only) while `DATA_ENTITY_TAGS_UPDATE` is `DATA_ENTITY`-scoped and therefore conditionally grantable via `"is": "dataEntity:owner"`. A per-data-entity-owner Policy can therefore mint global tag rows that pollute the popular-tags surface for users with no permission on their data entity. There is no concept of organisation, tenant, or namespace at the Tag directory level — once a Tag row exists, it is globally visible. Combined with the absence of tag-name validation (REFACTOR — no length/pattern/charset; see `createDataEntityTagsRelations.md:bugs_limitations_corner_cases[4]`), this enables denial-of-service-shaped pollution (saturate the directory with junk names, degrading the popular-tags query).

**Primary source citations**:
- `TagServiceImpl.java:80-86, 105-110, 144-159` (auto-create via getOrCreateTagsByName)
- `SecurityConstants.java:138` (`TAG_CREATE` gates POST /api/tags)
- `SecurityConstants.java:212-214` (`DATA_ENTITY_TAGS_UPDATE` gates PUT /api/dataentities/{id}/tags)
- `PolicyPermissionDto.java:24` (`DATA_ENTITY_TAGS_UPDATE(DATA_ENTITY)` — DATA_ENTITY scope)
- `PolicyPermissionDto.java:62` (`TAG_CREATE(MANAGEMENT)` — MANAGEMENT scope)
- `TagController.java:36-44` (`getPopularTagList` — no per-tenant scoping)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-065 (Tag auto-create) documents the UX intent. ADR-CANDIDATE-062 (Two-permission split) documents the per-resource permission intent. The scope-asymmetry consequence — that per-data-entity-owners side-door the management-level gate — is NOT documented anywhere. This is the unintended consequence of the two ADRs interacting; the maintainer can either accept it (and document it as "tag dropdown is shared globally; per-tenant isolation is out of scope") or harden it (require TAG_CREATE for novel names; downgrade to "use only EXISTING tags" for the per-data-entity write).

**Proposed remedy**: Three options for the maintainer to choose:
1. **Accept and document**: Add a paragraph to ADR-CANDIDATE-065 articulating that the Tag directory is intentionally shared globally and not tenant-isolated. Document the side-door in the Permissions doc.
2. **Harden — require TAG_CREATE for novel names**: In `TagServiceImpl.getOrCreateTagsByName`, check the caller's permissions and reject the call (with a clear error) when novel names are submitted by a caller without `TAG_CREATE`. UX trade-off: per-data-entity-owners must request admin help to introduce new tags.
3. **Harden — allowlist only**: Reject `tag_name_list` items not already in the directory. Force all tag creation through `POST /api/tags`. UX trade-off: bigger break with the spec acknowledgment.

A regression test should assert the chosen behaviour after the choice is made.

**Severity rationale**: MEDIUM — pattern-shape permission-bypass with global blast-radius (every other authenticated user sees the polluted directory). Severity is bounded by the absence of name-length validation (REFACTOR — see same sidecar for the bounded-DoS angle); without that, the side-door's social impact dominates the security impact.

**Suggested backlog grouping**: SEC-NNN authorization-audit sprint. Pair with REFACTOR-199 (Owner auto-create side-door) and REFACTOR-206 (Title auto-create side-door) — these three share the "directory growth via per-resource permission" pattern.

---
