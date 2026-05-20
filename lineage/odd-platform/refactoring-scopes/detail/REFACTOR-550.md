## REFACTOR-550 — `divideTagsByExistence` case-SENSITIVE existence-check vs `listMostPopular` case-INSENSITIVE `query` — silent-duplicate Tag rows via case-only-different names (e.g. `Postgres` + `postgres` coexist)

**Severity**: MEDIUM
**Category**: ux-inconsistency + data-integrity (silent duplicate)
**Surfaced by**:
- `TagServiceImpl.md:bugs_limitations_corner_cases[divideTagsByExistence case-sensitive]` (MEDIUM) — "the partial unique index does not catch this because it is a binary text comparison, not a lower(text) comparison"
- `TagServiceImpl.md:stress_findings.S-B-3` (HIGH per stress finding; DRIFT severity MEDIUM)
- `TagServiceImpl.md:stress_findings.S-B-5` (deleteRelationsWithTerm case-sensitive — composes with this finding)
- `TagServiceImpl.md:tests_coverage_semantic.uncovered_behaviours[case-sensitivity]` (MEDIUM)
- `TagServiceImpl.md:invariants[divideTagsByExistence case-SENSITIVE]`
- `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[case-sensitive listByNames enables silent duplicate Tag rows]` (MEDIUM)
- `ReactiveTagRepositoryImpl.md:concepts.invariants[case sensitivity]` — "`listByNames` uses `TAG.NAME.in(names)` translates to a SQL `IN` predicate against a `text` column without `LOWER()` or `ILIKE`. The popular-tags query in `listMostPopular` uses `listCondition` from the parent, which applies `nameField.containsIgnoreCase(nameQuery)` for the `query` parameter only — so substring-search-style queries are case-insensitive but exact-name dedup-lookup is case-sensitive"
- `ReactiveTagRepositoryImpl.md:stress_findings.B2[Case sensitivity]`
- `ReactiveTagRepositoryImpl.md:docs_link_semantic.doc_drift_findings[case-sensitivity]` (the doc page doesn't document case-sensitivity)
- `ReactiveTagRepositoryImpl.md:tests_coverage_semantic.uncovered_behaviours[Case-sensitivity of listByNames]` (MEDIUM)

**Description**: The Tag write path's existence-check is **case-SENSITIVE**:
- `TagServiceImpl.divideTagsByExistence` (`:144-159`) calls `reactiveTagRepository.listByNames(tagNames)` then `.filter(n -> !existingTagNames.contains(n))`.
- `ReactiveTagRepositoryImpl.listByNames` (`:120-125`) emits `TAG.NAME.in(names)` → SQL `name IN (...)` → binary byte-exact comparison against the `text` column.
- The partial unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` is ALSO case-sensitive (PostgreSQL `text` default).

The Tag READ path's search filter is **case-INSENSITIVE**:
- `ReactiveTagRepositoryImpl.listMostPopular(query, ids, page, size)` (`:138-167`) calls `listCondition(query)` (inherited from `ReactiveAbstractCRUDRepository.listCondition` lines 236-249) which emits `nameField.containsIgnoreCase(nameQuery)` — substring match, case-insensitive.

**Operator-visible consequence**: A user searches for `postgres` in the UI tag-search facet and sees a `Postgres` tag (matched case-insensitively by `containsIgnoreCase`). They submit `postgres` as a new tag name for a different entity. The write path:
1. `getOrCreateTagsByName({"postgres"})` calls `listByNames({"postgres"})` (case-sensitive) → returns `[]` (no row named `postgres` exactly).
2. `divideTagsByExistence` declares `postgres` to be NOVEL.
3. `bulkCreate({postgres})` mints a SECOND row in the `tag` table — the partial unique index does NOT catch it (binary comparison, `Postgres` ≠ `postgres`).
4. The UI now shows BOTH `Postgres` and `postgres` as distinct tags in the popular-tags facet (which is case-insensitive on `query`, but renders DISTINCT row payloads from the directory).

**Cross-feature consequence — `deleteRelationsWithTerm` (S-B-5)**: The same case-sensitive name comparison applies to the keep-set in `deleteRelationsWithTerm(termId, tagsToKeep)` (`:123-134`). A term with tag `Postgres` and a caller passing `tagsToKeep = {"postgres"}` will result in `Postgres` being DELETED from the term despite the user's intent to keep it — the keep-set filter `.filter(t -> !tagsToKeep.contains(t.getName()))` doesn't match `Postgres` against `postgres`.

**Primary source citations**:
- `TagServiceImpl.java:144-159` (divideTagsByExistence — case-sensitive existence check)
- `TagServiceImpl.java:123-134` (deleteRelationsWithTerm — case-sensitive keep-set)
- `ReactiveTagRepositoryImpl.java:120-125` (listByNames — case-sensitive `TAG.NAME.in(names)`)
- `ReactiveTagRepositoryImpl.java:140` (listMostPopular uses `listCondition` — inherits case-INSENSITIVE substring match)
- `ReactiveAbstractCRUDRepository.java:236-249` (`listCondition` definition — `nameField.containsIgnoreCase(nameQuery)`)
- `V0_0_64__remove_is_deleted_field.sql:103-105` (partial unique index on `text` — also case-sensitive)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-065 (Tag auto-create-on-miss) describes the UX intent (low-friction inline tag creation) but does NOT defend case-sensitivity. ADR-CANDIDATE-070 (partial unique index) describes the uniqueness rule but is silent on case folding. The case-sensitivity / case-insensitivity asymmetry between write and search is undocumented anywhere — neither in the live tagging doc page (verified WebFetch 2026-05-19) nor in the OpenAPI spec.

**Proposed remedy**: Four options (UX trade-off varies):

1. **Make WRITE path case-insensitive (recommended)**: 
   - Migration: `CREATE UNIQUE INDEX tag_name_unique_lower ON tag (LOWER(name)) WHERE deleted_at IS NULL` (replacing the current index).
   - Update `listByNames` to emit `LOWER(TAG.NAME).in(names.stream().map(String::toLowerCase).toList())`.
   - Update `divideTagsByExistence` to compare names case-insensitively.
   - Update `deleteRelationsWithTerm` to keep case-insensitive (or fold both sides to lowercase).
   - UX: a single canonical tag per case-only-different name set. Operators see one `Postgres` tag, not two; submitting `postgres` after `Postgres` exists is a no-op (the auto-create path returns the existing row).
   - Migration risk: existing case-only-different rows in production must be DEDUPED before the unique index can be created — operator-visible breaking change.

2. **Make SEARCH path case-sensitive**: change `containsIgnoreCase` to `contains`. UX: typing `postgres` no longer matches `Postgres`. Trade-off: bad UX for the substring-search facet.

3. **Document the asymmetry**: add an admonition to the live tagging page explaining the case-sensitive uniqueness rule and the case-insensitive search. Recommend operators standardise on lowercase tag names. UX: operators learn the rule the hard way.

4. **Add a sanity-check on the write path**: when a caller submits `tag_name_list: ["postgres"]` and a case-only-different `Postgres` exists, surface a soft warning ("Did you mean `Postgres`? Both will be created as distinct tags.") via a 4xx with detail. Backwards-compatible but adds UX friction.

**Recommended**: Option 1 + production-data deduplication migration. The case-only-different duplicates are a pure data-integrity gap; the migration cost is one-time; the UX improvement is sustained. Pair with REFACTOR-553 (tag-name validation absent — pattern, length, charset) and REFACTOR-223 (side-door scope-asymmetry) — the three are the "tag directory is wide-open to operator-introduced pollution" cluster.

**Severity rationale**: MEDIUM — silent data duplication is bounded (no security implication; the popular-tags surface renders both as distinct items, mildly degrading UX); the deleteRelationsWithTerm case-sensitive consequence is bounded by the rare case where a term has case-only-different tags AND the caller passes a different case. The pattern is the canonical UX inconsistency cited in the live tagging page WebFetch as a doc-drift finding.

**Suggested backlog grouping**: UX-consistency / data-integrity sprint. Pair with REFACTOR-223 (side-door directory pollution), REFACTOR-553 (tag-name validation absent — recommend writing). The trio share the "tag directory is a flat global namespace with weak constraints" theme.

---
