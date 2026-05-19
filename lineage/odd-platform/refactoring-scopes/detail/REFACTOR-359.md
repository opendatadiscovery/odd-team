## REFACTOR-359 — Tag `listByNames` is case-sensitive, enables silent duplicate-row creation via case variation — operator with `tag_name_list: ['PII']` mints a fresh `PII` row alongside existing `pii`, both visible in dropdown, fragmenting the search facet

**Severity**: MEDIUM
**Category**: missing-validation (data-integrity — silent duplicate-row via case variation)
**Surfaced by**: `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[1]`

**Description**: `ReactiveTagRepositoryImpl.listByNames` (lines 120-125) uses `TAG.NAME.in(names)` which translates to a SQL `IN` predicate that is case-sensitive by Postgres `text` default. `TagServiceImpl.divideTagsByExistence` (lines 144-159) calls `listByNames` then `existingTagNames.contains(n)` — also case-sensitive. A caller submitting `tag_name_list: ['PII']` against a directory that already contains `pii` will see `pii` as missing and mint a fresh `PII` row via the upsert / bulkCreate path. The `tag_name_unique` partial index (V0_0_64:103-105) is also case-sensitive (PostgreSQL `text` byte-comparison), so BOTH rows coexist.

**Observable consequences**:
- UI tag-dropdown renders BOTH `pii` and `PII` as distinct tags.
- Two operators looking for `pii` may apply different rows; the catalog's tag facet fragments — entities tagged `pii` are invisible when filtering by `PII` and vice versa.
- There is no normalization layer at the controller, the service, the repository, or the OpenAPI spec.

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:120-125` — case-sensitive IN
- `TagServiceImpl.java:144-159` — case-sensitive contains
- `V0_0_64__remove_is_deleted_field.sql:105` — partial unique index is byte-comparison

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-065 (Tag auto-create-on-miss INTENTIONAL) acknowledges the auto-create UX; this scope is the case-sensitivity-side consequence that the ADR does NOT defend. No code comment, no doc page, no spec discussion of case-sensitivity vs case-insensitivity for tag names.

**Proposed remedy**: Three options:
1. **Normalize at write time** — lowercase the tag name on `bulkCreate` / `ingestData` write paths. Migration: backfill existing rows to lowercase, merging duplicates with relation re-pointing. UX trade-off: operators lose case-preservation in tag names.
2. **Case-insensitive comparison at read** — change `listByNames` to use `lower(TAG.NAME).in(names.stream().map(String::toLowerCase).toList())` AND drop the partial unique index, replacing with a `lower(name)` expression-based partial index. Preserves case in storage; merges semantically.
3. **Document and accept** — explicitly state in the API spec and the docs that tag names are case-sensitive; encourage operators to standardise via convention. Smallest blast radius.

Pair with REFACTOR-360 (no tag-name validation) — both apply at the SAME entry points (TagController + ExternalTagIngestionRequestProcessor).

**Severity rationale**: MEDIUM — data-integrity drift; not a security incident but a UX-correctness drift that compounds with REFACTOR-223 (Tag side-door) and REFACTOR-360 (no validation). Combined effect: the tag directory accumulates near-duplicates over time; the search facet quality degrades.

**Suggested backlog grouping**: `SEC-NNN authorization-audit sprint` — companion to REFACTOR-223, REFACTOR-358, REFACTOR-360.

---
