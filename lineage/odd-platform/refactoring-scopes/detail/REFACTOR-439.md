## REFACTOR-439 — `dataset_field.updateDescription` verbatim XSS-class storage (F-004 family at the column surface)

**Severity**: MEDIUM
**Category**: missing-validation / stored-XSS-class
**Batch**: R (2026-05-20)
**Pillars affected**: [P-01-data-discovery (entity annotation surface), P-09-security-access-control]

**Surfaced by**:
- `ReactiveDatasetFieldRepositoryImpl.md:bugs_limitations_corner_cases.[2]` (MEDIUM): "`updateDescription` stores user input VERBATIM with only empty-to-null normalisation — no Jsoup.clean, no Encode.html, no length cap. Same F-004 verbatim-storage fingerprint as `ReactiveDataEntityRepositoryImpl.setInternalDescription` (lines 419-438 of that class). A Markdown / HTML payload submitted via PUT /api/datasetfields/{id}/description persists through reads. The UI's defence-in-depth at render layer (P-009 per system-mission.md F-004 cross-reference) is the operative safeguard."
- `ReactiveDatasetFieldRepositoryImpl.md:security.known_security_gaps.[1]` (MEDIUM): same finding from security lens
- `ReactiveDatasetFieldRepositoryImpl.md:back_links.back-to-feature.F-004`: "strengthens by extending the verbatim-storage class to the dataset_field surface (PUT /api/datasetfields/{id}/description). Same fingerprint as ReactiveDataEntityRepositoryImpl.setInternalDescription."

**Statement**: `ReactiveDatasetFieldRepositoryImpl.updateDescription` lines 72-80 issues a bare `DSL.update(DATASET_FIELD).set(INTERNAL_DESCRIPTION, description).where(ID.eq(?)).returning()` with only empty-to-null normalisation on the input (line 75: `description == null || description.isEmpty() ? null : description`). No HTML sanitization, no character escaping, no length cap, no allowlist of permitted Markdown directives. Any Markdown / HTML / script-tag payload submitted via PUT /api/datasetfields/{id}/description persists through reads.

**F-004 stored-XSS family fingerprint extends across the platform**:
- `ReactiveDataEntityRepositoryImpl.setInternalDescription` (the DataEntity surface — already tracked under REFACTOR-218 family)
- `ReactiveDatasetFieldRepositoryImpl.updateDescription` (the dataset_field surface, NEW batch R — THIS scope)
- Likely other text-input surfaces (`Term.description`, `Tag.name`, `BusinessName.value`, `QueryExample.definition`, `MetadataFieldValue.value` per batch L) — sweep-verified at multiple surfaces

The operative defence is at the UI render layer (DefiniteDOMSanitiserPipeline cross-reference in P-009 / F-004 sidecars). Defence-in-depth at the persistence layer is absent. The forward-copy mechanism (ADR-CANDIDATE-148) propagates the verbatim-stored descriptions across schema-version forks — once stored, the payload persists forever (or until the operator manually edits it).

**Evidence**:
- `ReactiveDatasetFieldRepositoryImpl.java:75-78` — `set(INTERNAL_DESCRIPTION, description == null || description.isEmpty() ? null : description)` — only empty-to-null check
- `ReactiveDatasetFieldRepositoryImpl.java:82-90` — same shape for `updateInternalName` (`set(INTERNAL_NAME, ...)`)
- cross-batch — `ReactiveDataEntityRepositoryImpl.setInternalDescription` lines 419-438 (analogous finding at DataEntity surface, REFACTOR-218 family)
- `DatasetFieldServiceImpl.java:308-322` — forward-copy lines for ADR-CANDIDATE-148 — the verbatim-stored description propagates across version forks
- F-004 family per system-mission.md cross-reference + concept catalog entries

**Existing-ADR-or-implied-prescription**: STRENGTHENS REFACTOR-218 (F-004 stored-XSS family — already tracked across batches). The fix prescription is family-wide.

**Proposed remedy**: Family-wide fix; add a `TextInputSanitizer` bean (single source of truth for sanitisation rules) and route every text-input write path through it. Per the F-004 family scope, the prescription is:

1. Define the platform's text-input contract via DOC-NNN as a doc-product prerequisite:
   - Markdown subset? (e.g. CommonMark with `data-` attributes stripped)
   - HTML subset? (e.g. allow `<a>` `<p>` `<em>` `<strong>`, strip `<script>` `<iframe>`)
   - Plaintext only?
2. Implement `TextInputSanitizer.sanitize(input)` returning the sanitised form (rejecting unsafe constructs OR replacing with safe equivalents — recommend OWASP Java Encoder + Jsoup with allowlist policy)
3. Route every `update*Description` / `update*Name` / `setBusinessName` / `setTerm.description` etc. through the sanitiser at the SERVICE-tier boundary (not the controller — too high; not the repository — too low; service is the right place)
4. Add `@TextInputSanitized` annotation marker for new write methods (linting / compile-time gate)
5. Migration: dump existing dataset_field.internalDescription + data_entity.internal_description rows, run them through the sanitizer offline, identify any with sanitizer-rejected content, present to operators for review (may carry historical XSS-shaped content from prior writes)

**Severity rationale**: MEDIUM — defence-in-depth at the UI render layer is operative (P-009 cross-reference); the persistence-layer fix is hardening, not the only line of defence. The forward-copy mechanism (ADR-148) compounds the persistence — once stored, the payload survives schema changes — but render-time sanitisation still neutralises the attack vector at execution time.

**Suggested backlog grouping**: "F-004 stored-XSS hardening sprint" (paired with REFACTOR-218 family at the data_entity surface + any future surfaces surfaced from term / glossary / queryexample tier).

---
