## ADR-CANDIDATE-110 — Unhandled-mention staging with auto-resolution on term-create — `[[ns:NEW_TERM]]` mentions for terms that don't exist yet are STAGED in `*_unhandled_term` tables and AUTOMATICALLY materialise into real link rows when a matching term is later created (forward-compatibility)

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-06-data-glossary]
**Support**: surfaced by 1 sidecar (`TermServiceImpl`) — primary-source; structural Glossary-mention-lifecycle decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:implicit_adrs.[3]` (HIGH confidence) — "Unhandled-mention staging with auto-resolution on term-create. A `[[ns:term]]` mention for a non-existent term is NOT dropped — it is staged in `*_unhandled_term` tables (`buildDataEntityUnknownTerms` etc., lines 501-544) and AUTOMATICALLY materialised into a real link row when a matching term is later created (`resolveUnhandledDescriptionMentions`, lines 421-442). This is intentional forward-compatibility: operators authoring descriptions can reference terms they plan to create later, and the platform reconciles when the term arrives."

**Decision statement**: When `handleDataEntityDescriptionTerms` / `handleDatasetFieldDescriptionTerms` parses a description's `[[ns:term]]` mentions and finds some that don't match any existing term, those mentions are INSERTed into per-target staging tables: `data_entity_description_unhandled_term`, `dataset_field_description_unhandled_term`, `term_definition_unhandled_term`. Each staging row preserves the `(target_id, namespace_name, term_name)` triple (lowercased — see ADR-CANDIDATE-107's case-insensitivity invariant). On `createTerm` (`TermServiceImpl.java:116`), after the new term is INSERTed and FTS vectors refreshed, `resolveUnhandledDescriptionMentions` (`TermServiceImpl.java:421-442`) queries all three staging tables for rows matching the new term's `(ns, name)`, materialises them as real link rows with `is_description_link=TRUE`, and DELETEs the staging rows. The architectural posture: descriptions are forward-compatible with the term dictionary — operators can author `[[finance:NewConcept]]` in a description before the term exists, and the platform reconciles when the term is later created. The trade-off: the staging tables accumulate rows for typos and never-resolved mentions; there is no TTL cleanup of staging rows (per batch-D HousekeepingTTL — only resolved-alert / search-facet / data-entity TTLs exist).

**Wisdom test**: PASS. (1) Deliberate (the three staging tables are explicitly modelled in the schema; the per-creation auto-resolution is wired in `createTerm`'s flow at line 116; the absence of equivalent reverse-flow on term-delete is the deliberate guard-not-migrate choice from ADR-CANDIDATE-109); (2) Structural impact (every description edit's parser runs the foundTerms-vs-unknownTerms split and dispatches to two storage paths; every term-create triggers the resolution sweep across three tables); (3) Removing staging (dropping unknown mentions silently) would be a STRUCTURAL change to the forward-compatibility contract.

**Evidence**:
- TermServiceImpl.md says: "`return termRepository.getByNameAndNamespace(formData.getNamespaceName(), formData.getName()).handle((dto, sink) -> { if (dto != null) { sink.error(...); } }).then(createTermMono).flatMap(this::updateSearchVectors).flatMap(term -> resolveUnhandledDescriptionMentions(term).thenReturn(term));`" (`TermServiceImpl.java:107-116`)
- TermServiceImpl.md says: "`buildDataEntityUnknownTerms` / `buildDatasetFieldUnknownTerms` / `buildTermUnknownTerms` (`TermServiceImpl.java:501-544`) lowercase namespace + name before insertion; ... There is NO opposite flow: when a term is DELETED, descriptions that mention it do NOT migrate to the staging tables — the description guard (`hasDescriptionRelations`) prevents delete instead."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-107** (term natural key case-insensitive) — the staging-table lookup uses the same case-insensitive comparison. Composes with **ADR-CANDIDATE-108** (description-link flag) — resolved mentions materialise as `is_description_link=TRUE` rows. Composes with **ADR-CANDIDATE-109** (description-mention guard) — the absence of a reverse-flow on term-delete is the guard's necessary symmetry.

**Cross-link gaps**:
- The live `data-glossary/business-glossary` doc does NOT name the unhandled-mention staging / backward-resolution feature — a DOC-NNN follow-up (MEDIUM) is captured in the sidecar's doc_drift_findings.
- The staging tables have NO TTL — typos accumulate indefinitely. Cross-ref REFACTOR-085 (no activity retention; no TTL on staging tables either).

**Proposed action**: Promote to `adrs/drafts/term-unhandled-mention-staging.md` (new ADR). Document the forward-compatibility model explicitly — descriptions can reference terms before they exist; the platform reconciles on term-create. Cross-link with ADR-CANDIDATE-107, ADR-CANDIDATE-108, ADR-CANDIDATE-109. The DOC-NNN companion describes this feature in user docs.

**Severity rationale**: MEDIUM — Glossary-lifecycle architecture decision; affects how operators author descriptions before terms exist.

---
