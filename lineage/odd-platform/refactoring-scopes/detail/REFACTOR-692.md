## REFACTOR-692 — `"Statuses"` key partial-translation drift: en.json = `"Statuses": "Statuses"` (plural); es.json = `"Statuses": "Estado"` (Spanish singular) while ch.json / fr.json / hy.json / ua.json keep the English value (natural-keys identity entries) — Spanish-locale users see a misleading singular label for a multi-select filter

**Severity**: LOW
**Category**: partial-translation-drift / contributor-inconsistency
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-01 Search (the Filters component the label is rendered in)]

**Surfaced by**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[4]` (LOW) — "**The `Statuses` key is locale-divergent (LOW)**: en.json line 418 has `\"Statuses\": \"Statuses\"` (natural-keys); es.json line 410 has `\"Statuses\": \"Estado\"` — a Spanish singular noun ('Status', singular) translating a plural English noun ('Statuses', plural). The other four locales (ch, fr, hy, ua) carry `\"Statuses\": \"Statuses\"` — the English source. The Spanish translation is incomplete (plural→singular drift) and inconsistent with the other locales (which don't translate at all). This is a typical contributor-drift case: one locale's translator submitted a partial change, the others were never updated. The Search Filters component (`components/Search/Filters/Filters.tsx:65`) uses `name={t('Statuses')}` to label the multi-select status facet — a Spanish-locale user sees 'Estado' (singular, suggesting a single status to select), while the widget is in fact multi-select."

**Statement**: The i18n key `"Statuses"` has divergent behaviour across the six locales:
- **en.json:418** = `"Statuses": "Statuses"` — natural-keys identity (English source unchanged).
- **es.json:410** = `"Statuses": "Estado"` — Spanish SINGULAR noun ("Status"), translating an English PLURAL noun.
- **ch.json:414** / **fr.json:414** / **hy.json:411** / **ua.json:413** = `"Statuses": "Statuses"` — natural-keys identity (English source unchanged in non-English locales).

The Search Filters component (`Filters.tsx:65`) renders `<MultipleFilter name={t('Statuses')}>` — a MULTI-SELECT facet. The plural English label is correct (you can select multiple statuses). The Spanish "Estado" (singular) is operator-misleading — it suggests selecting ONE status. The other four locales pass the natural-keys English through, so French / Chinese / Ukrainian / Armenian users see "Statuses" (English, plural, accurate) while Spanish users see "Estado" (Spanish, singular, misleading).

The shape is a typical CONTRIBUTOR-DRIFT case: at some point a Spanish-locale contributor submitted a partial translation PR that touched this one key; the other four non-English locales' translators never followed up; the divergence has been live since. The natural-keys + chained-fallbackLng pattern means the divergence is invisible to maintainers (everything renders for English) and to non-Spanish non-English users (their locale falls through to English which is accurate). Only Spanish users are affected; they see one misleading label among hundreds of correct ones.

**Evidence**:
- en.json:418 (`"Statuses": "Statuses"`)
- es.json:410 (`"Statuses": "Estado"` — verified verbatim)
- ch.json:414 / fr.json:414 / hy.json:411 / ua.json:413 (natural-keys identity entries)
- Filters.tsx:65 (the call site: `<MultipleFilter key='es' filterName='statuses' name={t('Statuses')}>`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-011 (natural-keys) is the architectural anchor. The contract says non-English locales SHOULD provide translations (if they choose to translate at all; natural-keys identity is also acceptable for any locale). This refactor is the contributor-drift case where ONE locale partially translated and the rest didn't.

**Proposed remedy**: Pick one of two paths:

**Path A — Make Spanish accurate (preferred)**:
- es.json:410 → `"Statuses": "Estados"` (Spanish PLURAL noun).
- Verifies with Spanish-locale review.

**Path B — Revert Spanish to natural-keys identity**:
- es.json:410 → `"Statuses": "Statuses"`.
- Aligns with the other four non-English locales' choice to not translate.
- A future PR can re-add the translation when a more complete Spanish-locale pass is undertaken.

Effort: trivial (1 character change for Path A; 7 character change for Path B). Either fix is reversible.

**Severity rationale**: LOW — affects only Spanish users on a single UI surface; misleads but doesn't break functionality (the user can still select multiple statuses; the label is just suboptimal). Bounded scope; one-line fix; not a security or correctness issue.

**Suggested backlog grouping**: `i18n completeness sprint` — bundled with REFACTOR-690 / 691 / 693. Trivial to include.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-691 NEW (locale-set drift — this is the symmetric case where a key EXISTS in all six but DIVERGES in one); ADR-CANDIDATE-011 (natural-keys — the convention this refactor's drift inconsistently honours).
- SUPERSEDES: none.
- CONFLICTS: none.

---
