## REFACTOR-360 — No tag-name validation in repository, service, OR OpenAPI — arbitrary-length strings with newlines / control characters / whitespace-only names accepted at every write surface; compounds REFACTOR-223 (Tag side-door) into a denial-of-service-shaped pollution surface

**Severity**: MEDIUM
**Category**: missing-validation (input-sanitisation; DoS-shaped abuse surface)
**Surfaced by**: `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[2]` + `ReactiveTagRepositoryImpl.md:security.known_security_gaps[1]`

**Description**: `ingestData`, `bulkCreate` (inherited), and the inherited `create` ALL accept arbitrary `TagPojo.name: String` content. The validation surface is empty at every layer:
- **Repository** — no `@Length`, `@Pattern`, `@NotBlank` annotation on `TagPojo`; no programmatic check.
- **Service** — `TagServiceImpl.getOrCreateTagsByName` (lines 80-86) passes names through unmodified.
- **Schema** — the PostgreSQL `tag.name` column has no `CHECK` constraint visible in any migration (no `length(name) BETWEEN`, no `name ~ '[A-Za-z0-9_-]+'`).
- **OpenAPI spec** — declares `type: string` only; no `maxLength`, no `pattern`, no `minLength`.

An operator with `DATA_ENTITY_TAGS_UPDATE` permission can mint Tag rows with names:
- Of arbitrary length (up to Postgres `text` limit ~1 GB).
- Containing newline characters, NULs, control characters, or whitespace-only.
- Visually similar (`пии` Cyrillic vs `pii` Latin — Unicode homograph attack).

The popular-tags query (`listMostPopular` — `TagController.getPopularTagList`) returns these to every other user (per the read-collaborative posture). REFACTOR-223 (Tag side-door) compounds the impact — any per-data-entity-owner can grow the directory via this surface.

**The DoS-shaped concern**: a malicious caller (or a buggy Collector script) can saturate the directory with N junk names, degrading:
- The popular-tags query cost (full-directory aggregate scan).
- The tag-dropdown render cost (every authenticated user fetches the directory).
- The search-facet rendering cost (faceted-search includes tag facet).
- The forensic-investigation cost (operators sift through junk names to find legitimate tags).

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:179-215` — `ingestData` accepts arbitrary names
- `TagPojo` — no validation annotations
- migration suite — no `CHECK` constraint on `tag.name`
- `odd-platform-specification/openapi.yaml` — `type: string` only
- Cross-batch: REFACTOR-223 (Tag side-door — the permission surface that compounds this gap)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-065 (Tag auto-create-on-miss INTENTIONAL) acknowledges the auto-create UX but does NOT discuss validation; ADR-CANDIDATE-127 NEW (dual-contract write paths) describes the operator-vs-ingestion split but does NOT discuss validation either. The validation gap is the unintended consequence of the architecture's permissiveness.

**Proposed remedy**:
1. **Add validation at the OpenAPI spec** — `maxLength: 64, pattern: '^[A-Za-z0-9_\\-\\s]+$', minLength: 1`. The generated controllers' `@Valid` binding enforces it. Operators get a 400 BAD_REQUEST with a clear schema-validation message for bad inputs.
2. **Add a CHECK constraint to the schema** — defence-in-depth at the DB layer; refuses bad data even if the service-layer validation is bypassed by a future refactor.
3. **Add a normalisation layer at the service** — trim whitespace, reject empty/control-char content, lowercase (per REFACTOR-359). Pair with REFACTOR-359.

All three together close the gap. Option 1 alone is the smallest blast radius.

**Severity rationale**: MEDIUM — pattern-shape gap that compounds with REFACTOR-223 + REFACTOR-359 to enable directory pollution. The DoS-shape is bounded by operator vigilance (a junk-name flood would be noticed at the catalog level), but the UX-degradation surface is real today (operators copy-paste tag names from emails and Slack with trailing whitespace; the catalog accumulates near-duplicates).

**Suggested backlog grouping**: `SEC-NNN authorization-audit sprint` — companion to REFACTOR-223, REFACTOR-358, REFACTOR-359. Tag-input-validation is the smallest single fix that closes the four-scope family's UX-degradation surface.

---
