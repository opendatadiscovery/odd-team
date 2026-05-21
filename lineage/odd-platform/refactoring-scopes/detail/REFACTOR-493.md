## REFACTOR-493 — No tag-name validation on createTag / updateTag / term-tag / dataset-field-tag paths — empty, whitespace-only, control-char, and unbounded-length tag names are accepted into the global directory

**Severity**: LOW
**Category**: missing-validation
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-08 (Management & Administration — Tags tab)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__createTag.md:bugs_limitations_corner_cases[4]` ("No tag-name validation on `createTag` beyond OpenAPI `type: string`.")
- `odd-platform__java__TagController__controller-method__updateTag.md:bugs_limitations_corner_cases[3]` ("No request-body validation on the tag name beyond OpenAPI `type: string`.")
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:bugs_limitations_corner_cases[5]` ("No length / character-set / whitespace validation on `tag_name_list` items.")
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:bugs_limitations_corner_cases[5]` ("No length / character-set / whitespace validation on `tags` items.")
- cross-confirm: `feature-flows/index.yaml` F-018 facet `tag_name_no_validation_no_length_cap_no_charset_filter`

**Statement**: No tag-name validation exists on ANY of the four tag-creating paths. `TagFormData.name` is declared `type: string` with NO `pattern`, `minLength`, or `maxLength` (`components.yaml:340-345`); `TagsFormData.tag_name_list` items and `DatasetFieldTagsUpdateFormData.tags` items are likewise unconstrained `type: string` arrays; there is no DB-level `CHECK` constraint on `tag.name`. Empty-string, whitespace-only, leading/trailing-whitespace, control-character, homoglyph-variant, and unbounded-length tag names are all accepted and become permanently visible in the global directory (which `getPopularTagList` exposes to every authenticated user, and which feeds every entity-detail tag dropdown). `' tag '` and `'tag'` resolve to two distinct directory rows; a 10K-char name reaches the DB column constraint; the directory accumulates typos and free-text junk over the deployment lifetime. No service-layer trim or normalisation exists (`divideTagsByExistence` passes names verbatim into `new TagPojo().setName(n)`).

**Evidence**: `components.yaml:340-345` (`TagFormData.name` — no pattern/minLength/maxLength) + `components.yaml:2215-2218` (`tag_name_list` items unconstrained) + `components.yaml:1830-1833` (`tags` items unconstrained) + `TagServiceImpl.java:155` (`new TagPojo().setName(n)` — verbatim, no trim/normalise) + `createTag.md` / `updateTag.md` / `createTermTagsRelations.md` / `updateDatasetFieldTags.md` bugs_limitations entries.

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. There is no comment, doc, or ADR defending "tag names are deliberately unvalidated". The absence of `pattern`/`minLength`/`maxLength` on the OpenAPI schema and the absence of a trim/normalise in the service are simply missing validation — a feature not yet added.
2. *Structural impact?* NO — adding `minLength`/`maxLength`/`pattern` to the OpenAPI schema (which the generator turns into bean-validation annotations) + a trim/normalise in `divideTagsByExistence` is validation within the existing structure.
3. *Refactoring or structural?* REFACTORING — add the schema constraints + a service-tier normalisation step.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: none — there is no ADR governing tag-name shape. The implied prescription is generic input-hygiene best practice. This is the same shape as REFACTOR-206 (Title auto-create has no allowlist) and the Owner/Title free-text-vocabulary gaps — a directory of operator-typed strings with no constraints.

**Proposed remedy**: Add `minLength: 1`, a reasonable `maxLength` (e.g. 100), and optionally a `pattern` to `TagFormData.name`, `TagsFormData.tag_name_list` items, and `DatasetFieldTagsUpdateFormData.tags` items in `components.yaml` (the OpenAPI generator turns these into `@Size` / `@Pattern` bean-validation annotations enforced at the controller-binding layer). Add a trim/normalise step in `TagServiceImpl.divideTagsByExistence` / `bulkCreate` so `' tag '` and `'tag'` converge. Optionally add a DB `CHECK` constraint on `tag.name` length as a backstop. Add a test exercising empty / whitespace / oversized / control-char names.

**Severity rationale**: LOW — an input-hygiene gap. It enables directory pollution (typos, whitespace variants, junk) and, combined with the tag side-door (REFACTOR-223), a bounded directory-saturation DoS — but it is not data-loss or a security-bypass in itself; the global blast radius is "the tag dropdown looks messy". LOW is the honest level; it rises in importance when bundled with REFACTOR-223 (the side-door makes directory pollution reachable by per-resource-permission holders).

**Suggested backlog grouping**: "Tag mutation hardening" sprint — pair with REFACTOR-494 (empty-list clears all) and REFACTOR-498 (page/size degenerate inputs). The directory-saturation angle cross-links REFACTOR-223 in the SEC-NNN authorization-audit sprint.

---
