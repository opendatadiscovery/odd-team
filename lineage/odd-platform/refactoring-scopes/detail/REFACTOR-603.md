## REFACTOR-603 — Dashboard URL-sync mount effect calls `JSON.parse(value)` with NO try/catch — a hand-edited or malformed `/data-quality?foo=bar` query string crashes the React tree; same shape as REFACTOR-286 (LineageGraph `?t=` crash)

**Severity**: LOW
**Category**: missing-validation / fragile-parsing / cross-cutting URL-as-source-of-truth
**Pillars affected**: [P-04 Data Quality — F-032 Quality Dashboard | P-05 Data Lineage — LineageGraph (cross-cutting twin)]
**related_features**: [F-032]
**related_pillar_features**: [P-04:F-002]
**Batch**: ZC (2026-05-22)

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataQualityFilters.md:bugs_limitations_corner_cases.[5]` (LOW) — |-
    "**URL-sync round-trip is lossy on hand-edited query strings and silently swallows malformed JSON.** The mount effect does `JSON.parse(value)` on each query-param value with no try/catch (`DataQualityFilters.tsx:35`). A user who hand-edits `/data-quality?namespaceIds=foo` (not valid JSON) causes `JSON.parse` to throw inside the effect; React surfaces this as an uncaught render-time error. Additionally the effect only copies a key if `key in newFilters` (`DataQualityFilters.tsx:32`), so an unknown query param is silently ignored — acceptable — but a malformed value for a KNOWN key crashes rather than degrading. There is no schema validation on the parsed shape (a param parsed to a non-array, or to objects missing `id`, flows straight into `formFiltersAtom`)."

**Description**: `DataQualityFilters.tsx:28-43` runs a mount-time `useEffect` that iterates `searchParams` and parses each value with bare `JSON.parse(value)`. There is no `try/catch`, no schema validation on the parsed shape.

Plausible crash paths:

1. **Hand-edited URL**: an operator pastes `/data-quality?namespaceIds=foo`. `JSON.parse('foo')` throws. The throw propagates out of the effect; React surfaces it as an uncaught render-time error.
2. **Bookmarked stale URL**: a URL captured pre-format-change. The current parser does not recognise the format; throws.
3. **Format change in the encoding side**: if the writer's `JSON.stringify` shape ever changes (e.g. just IDs instead of full FilterOption objects), an old URL becomes malformed for the new parser.

The same shape exists on the LineageGraph URL `?t=` parameter (REFACTOR-286 — `JSON.parse(t)` without try/catch crashes the React tree). REFACTOR-286 was surfaced in batch 2026-05-12C (LineageGraph component); REFACTOR-603 is the second instance of the same class on a sibling URL-as-source-of-truth surface. ADR-CANDIDATE-091 (URL as source of truth for view state) was STRENGTHENED by batch ZC to include the Quality Dashboard variation; the ADR's "Proposed action" calls out a validation obligation — that obligation is unmet on BOTH surfaces, and the pattern will likely repeat on any future shareable-canvas surface that adopts the ADR.

**Wisdom-test classification**: GAP. Same as REFACTOR-286. (1) Intentional? NO — the missing try/catch is an oversight, not a decision. (2) Structural impact? NO — wrap with try/catch + validate. (3) Refactoring or structural? REFACTORING. → Refactoring scope.

**Primary source citations**:
- `DataQualityFilters.tsx:31-39` (the `for...of` over searchParams + the unguarded `JSON.parse`)
- REFACTOR-286 (the lineage twin — same shape, different surface)
- ADR-CANDIDATE-091 batch-ZC STRENGTHENS block (calls for a codified `parseUrlValue<T>(value, schema)` primitive)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-091 (URL as source of truth for view state) — the STRENGTHENS block this batch added calls for a project-wide codified validation primitive. The fact that the same gap surfaced independently on the second instance of the pattern IS the signal that per-call-site discipline does not scale; a codified helper is the right structural answer.

**Proposed remedy**: Two layers.

1. **Smallest — local try/catch** at `DataQualityFilters.tsx:35`: wrap the `JSON.parse` in try/catch; on failure, skip that key (continue with the rest of the URL's keys). Add a `console.warn` for developer visibility. Apply the same fix to REFACTOR-286 (LineageGraph `?t=`).
2. **Better — extract a project-wide `parseUrlValue<T>(value, schema)` primitive** using Zod / Yup / a hand-rolled validator. Both the dashboard and the lineage URL parsers consume it. Provides defence-in-depth against future format changes and gives a single place to add telemetry for malformed-URL events.

Option 2 is what ADR-CANDIDATE-091's STRENGTHENS block recommends and what any third instance of the pattern would need.

**Severity rationale**: LOW — the activation pre-condition is operator hand-edit or bookmark-staleness; production users typically reach the dashboard via the tab or via internal links (which produce well-formed URLs). Severity LOW because the crash surfaces visibly (React error overlay) rather than silently corrupting state; defence-in-depth is the right framing.

**Suggested backlog grouping**: `Quality Dashboard hardening sprint` for Option 1; `URL-as-source-of-truth codified validation primitive` cross-cutting work for Option 2 (which closes REFACTOR-286 and REFACTOR-603 together).

---
