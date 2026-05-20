## REFACTOR-286 — `?t=` URL param accepts `JSON.parse(t)` WITHOUT try/catch; a malformed user-edit (`?t=foo`) crashes the React tree

**Severity**: LOW
**Category**: fragile-parsing + missing-validation
**Pillars affected**: [P-05] — Data Lineage
**Surfaced by**:
- `LineageGraph.md:security.known_security_gaps[5]` (|-
    "The `?t=` URL param accepts `JSON.parse(t)` (HierarchyLineage.tsx:85) without try/catch — a malformed value (e.g. user manually edits `?t=foo`) throws and crashes the React tree.")

**Description**: The Lineage canvas's transform matrix (pan/zoom state from `@visx/zoom`) is serialised to the URL as `?t=` with `JSON.stringify(zoom.transformMatrix)` (`ZoomableLineage.tsx:30`). On mount, the inverse operation runs at `HierarchyLineage.tsx:85` — `JSON.parse(t)` without a try/catch.

A user manually editing the URL to `?t=foo` (or `?t=` with the value truncated, or `?t={` with malformed JSON) hits `JSON.parse` which THROWS `SyntaxError`. The throw propagates up the React render tree, breaking the page render entirely. The error boundary (if any) catches it; without a boundary, the entire SPA crashes.

The fix is a 3-line try/catch + fallback:
```ts
let parsed = defaultTransformMatrix;
try {
  parsed = JSON.parse(t);
} catch {
  // fall back to default; optionally clear ?t= from URL
}
```

**Primary source citations**:
- `HierarchyLineage.tsx:85` — the `JSON.parse(t)` without try/catch
- `LineageGraph.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-091 codifies URL-as-source-of-truth. The validation obligation (every URL-bound input must clamp / try-catch before forwarding) is part of the ADR; this is one of the ADR's enumerated maintenance obligations being unfulfilled.

**Proposed remedy**: 3-line try/catch at `HierarchyLineage.tsx:85`. Fall back to `defaultTransformMatrix` on parse failure. Optionally clear `?t=` from the URL to prevent the next refresh from re-hitting the bad value.

**Severity rationale**: LOW — affects only users manually editing the URL (or sharing a corrupted URL); not a security gap, just a fragility.

**Suggested backlog grouping**: `Lineage subsystem UX hardening sprint` (alongside REFACTOR-285 + REFACTOR-287).

---
