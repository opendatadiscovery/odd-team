## REFACTOR-299 — Doc-vs-code drift on Popular ranking signal: live doc says "most-viewed OR most-used", code is exclusively `view_count DESC` (no "most-used" signal exists in the codebase); doc obscures the single-signal nature of the ranking and the F-001 inflation surface

**Severity**: MEDIUM
**Category**: doc-code-drift + misleading-doc
**Pillars affected**: [P-01] — Data Discovery
**Surfaced by**:
- `PopularStrip.md:docs_link_semantic.doc_drift_findings[2]` (|-
    "**'Popular = most-viewed OR most-used' — the docs are vague where code is precise.** Live doc (catalog-overview.md:50): 'the most-viewed or most-used data entities across the catalog'. Code (per batch-G `getPopular` sidecar): the ranking signal is **exclusively** `view_count DESC`. There is no 'most-used' signal — no usage-frequency counter, no time-weighted usage, no edit-count, no API-call-count, just the singular `view_count` field that increments only on `GET /api/dataentities/{id}`. The 'or most-used' disjunction misleads operators into thinking the ranking blends multiple signals; in reality the ranking is monotonically driven by detail-reads only — an entity that has never been viewed (but is heavily INGESTED, EDITED, ALERTED on, or appears in many lineage walks) has view_count=0 and cannot reach Popular regardless of any other 'use'. This is the F-001 inflatability surface restated in doc terms: the docs obscure the single-signal nature of the ranking.")

**Description**: The live doc page at `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (and local mirror at `documentation/docs/data-discovery/catalog-overview.md:50`) describes Popular as:
> "Popular — the most-viewed or most-used data entities across the catalog."

The "or most-used" disjunction implies the ranking blends MULTIPLE signals. The code reality (batch-G `getPopular.md` + batch-H + batch-I cross-confirmation + ADR-CANDIDATE-066): the ranking is EXCLUSIVELY `view_count DESC` with `id DESC` tiebreaker. There is no:
- Usage-frequency counter.
- Time-weighted usage signal.
- Edit-count signal.
- API-call-count signal.
- Lineage-walk-frequency signal.

An entity that has never been opened in the UI (view_count=0) but is HEAVILY ingested, edited, alerted on, or appears in many lineage walks would NOT reach Popular regardless of any of those "uses." The single-signal nature is the F-001 inflatability surface: only one signal needs gaming.

The doc's disjunction is misleading. Operators reading "most-viewed or most-used" reasonably infer the ranking is multi-signal and harder to game. The single-signal reality contradicts this and is the structural fact behind the F-001 view_count inflation loop (LSN-017, REFACTOR-220, REFACTOR-221, ADR-CANDIDATE-066, ADR-CANDIDATE-054).

**Primary source citations**:
- `documentation/docs/data-discovery/catalog-overview.md:50` (the doc statement)
- Batch-G `getPopular.md` (the code reality)
- ADR-CANDIDATE-066 (the codification)
- `PopularStrip.md` documents the drift

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-066 codifies the single-signal ranking. REFACTOR-299 is the doc-product follow-through — the doc must align with the code's precision.

**Proposed remedy**: DOC-NNN follow-up — update `catalog-overview.md:50` to say:
> "Popular — the most-viewed data entities across the catalog, ranked by view_count (the number of times the entity's detail page has been opened)."

Optionally, extend with the caveat:
> "The ranking is driven exclusively by detail-page-open counts; entities that are heavily ingested or referenced via lineage but never opened in the UI do not appear in Popular until they accumulate views."

The doc precision change is two-line and surfaces the single-signal nature to operators. Pair with the LSN-017 fix (REFACTOR-220) — once the inflation is halved, the ranking is more accurate.

**Severity rationale**: MEDIUM — misleading doc-product content; affects operator interpretation of a load-bearing home-page surface; cross-references the F-001 inflation surface and the LSN-017 lesson.

**Suggested backlog grouping**: `Doc completeness sprint` + `F-001 view_count chain fixes`.

---
