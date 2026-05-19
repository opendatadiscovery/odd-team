## REFACTOR-292 — Hardcoded `{page: 1, size: 5}` for the Recommended panel's four columns precludes operator tuning of home-page recommendation breadth; no config key, no env override, no admin toggle

**Severity**: LOW
**Category**: missing-config-field + no-admin-path
**Pillars affected**: [P-01] — Data Discovery
**Surfaced by**:
- `PopularStrip.md:bugs_limitations_corner_cases[5]` (|-
    "**Hardcoded `size: 5` precludes operator tuning of the home-page recommendation breadth.** The Popular fetch is locked to `{page: 1, size: 5}` at OwnerEntitiesList.tsx:59. An operator who wants to surface the top-10 or top-20 popular entities on their deployment's home page cannot do so without forking the UI. Same constraint applies to all four columns (My Objects / Upstream / Downstream / Popular) — they all use the same hardcoded `params` object. No config key, no env-driven override, no theme-customisation surface, no admin toggle.")

**Description**: The home-page Recommended panel (`OwnerEntitiesList.tsx:58-64`) dispatches four fetches with HARDCODED `{page: 1, size: 5}`. The four columns:
- `fetchMyDataEntitiesList({page: 1, size: 5})`
- `fetchUpstreamDataEntitiesList({page: 1, size: 5})`
- `fetchDownstreamDataEntitiesList({page: 1, size: 5})`
- `fetchPopularDataEntitiesList({page: 1, size: 5})`

The `5` is a magic number. There is no operator-tuneable surface for:
- Increasing the column size (top-10, top-20).
- Decreasing it (top-3 for minimalist deployments).
- Per-column tuning (more Popular, less Downstream).
- Per-tenant tuning (different defaults for different deployments).

An operator who wants different recommendation breadth must fork the UI and re-build the SPA. The constraint applies uniformly to all four columns per ADR-CANDIDATE-095 (uniform-treatment).

**Primary source citations**:
- `OwnerEntitiesList.tsx:58-64` — the hardcoded params
- `PopularStrip.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-095 codifies the uniform-treatment pattern. Operator-tuneability is NOT part of the codified pattern; the absence is a gap, not a deliberate choice.

**Proposed remedy**: Three options:
1. **Build-time env var** — `import.meta.env.VITE_HOMEPAGE_RECOMMENDATION_SIZE || 5`. Cheap; requires rebuild per change.
2. **Runtime config from `/api/info`** — extend the existing AppInfo endpoint to carry `recommendationPageSize`. Server-controlled; no rebuild; operator sets in `application.yml`.
3. **Per-user preference** — store in user state; allow user to set their preferred breadth via UI control.

Option (2) is the operator-friendly default; option (3) is the user-friendly extension.

**Severity rationale**: LOW — minor configurability gap; operators routinely live with default sizes; the fix unlocks deployment-specific tuning.

**Suggested backlog grouping**: `Operator config completeness sprint`.

---
