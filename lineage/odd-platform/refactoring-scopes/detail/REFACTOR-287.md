## REFACTOR-287 — Unvalidated `?d=` URL param on the Lineage canvas flows directly to the backend; URL editor can pass `?d=10000` triggering REFACTOR-202 amplification — no UI clamp, no warning

**Severity**: HIGH
**Category**: missing-validation + no-upper-bound + dos-amplification
**Pillars affected**: [P-05, P-09] — Lineage × Security (cross-pillar)
**Surfaced by**:
- `LineageGraph.md:bugs_limitations_corner_cases[1]` (|-
    "**No upper bound on `d` URL param parsing** — `useQueryParams.ts:36` uses `parseNumbers: true` which converts `?d=999999999` to `d: 999999999`; the UI's depth `<AppSelect>` (LineageControls.tsx:104-118) only exposes [1..20] but the URL accepts any integer. A user who hand-edits `?d=10000` triggers a backend recursive-CTE walk to depth 10000 (REFACTOR-202 amplifies). The UI never validates or clamps.")
- `LineageGraph.md:security.known_security_gaps[2]` (|-
    "Unvalidated `?d=` URL param flows directly to the backend (HierarchyLineage.tsx:47) — a curious user editing `?d=10000` triggers the REFACTOR-202 amplification surface from the URL. No UI clamp.")

**Description**: The Lineage canvas's depth parameter `d` is parsed from the URL via `useQueryParams.ts:36` with `parseNumbers: true`. The UI's `<AppSelect>` at `LineageControls.tsx:104-118` only exposes the choices `[1..20]` (from `constants.ts:97-99`). But the URL parser accepts ANY integer — `?d=999999999` is parsed to `d: 999999999`.

The value flows STRAIGHT into the backend call at `HierarchyLineage.tsx:47` → `dataEntityApi.getDataEntityDownstreamLineage({dataEntityId, lineageDepth: d, ...})`. The backend's recursive-CTE walk has NO upper-bound enforcement (REFACTOR-202 — primary source at `LineageServiceImpl.java:54-122`). At `d=10000`, the recursive walk attempts to traverse 10000 levels of lineage edges.

DoS amplification cost analysis:
- For an entity with branching factor 5, depth-20 walk visits ~5^20 ≈ 100 trillion paths (CTE deduplicates, but the row materialisation is still expensive).
- A user editing `?d=10000` for a graph with branching factor 2 attempts to materialise 2^10000 paths — likely terminates with stack overflow or query timeout but consumes substantial DB resources first.

The backend's REFACTOR-202 gap (no clamp on the API parameter) is the structural issue. The UI's REFACTOR-287 gap (no clamp on the URL param) is the user-facing amplification surface: an attacker doesn't need to craft a direct API call; they can edit the URL bar.

**Primary source citations**:
- `useQueryParams.ts:33-36` — `parseNumbers: true`
- `constants.ts:97-99` — UI dropdown caps at [1..20]
- `HierarchyLineage.tsx:47` — d flows direct to backend
- `LineageGraph.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-091 codifies URL-as-source-of-truth and EXPLICITLY names "the validation obligation: every URL-bound input MUST clamp / try-catch before forwarding to backend or to JSON.parse" as a maintenance obligation. This is one of the ADR's enumerated obligations being unfulfilled.

REFACTOR-202 (existing) is the backend-side counterpart — defending the backend against malicious / careless `lineage_depth` values regardless of who calls. REFACTOR-287 is the UI-side defence-in-depth.

**Proposed remedy**: Two-layer defence:
1. **UI clamp** at `useQueryParams.ts` or `HierarchyLineage.tsx:47` — clamp `d` to `[1, 20]` (matching the dropdown) before forwarding to the dispatch. The clamp prevents URL-based exploitation.
2. **Backend clamp** (REFACTOR-202 fix) — clamp `lineage_depth` server-side at a sane max (e.g. 20 or 50). Defends against curl / cli / direct API callers.

Both layers are needed: UI clamp protects users who accidentally hit a bad URL; backend clamp protects against malicious direct API calls.

**Severity rationale**: HIGH — DoS amplification surface; URL editing is a low-friction attack vector; backend recursive-CTE cost grows exponentially with depth. Cross-pillar (P-05 × P-09) — bumps severity. Pair with REFACTOR-202 for absolute fix.

**Cross-pillar bump**: P-05 (Lineage) × P-09 (Security) — DoS surface; severity already HIGH from the structural absence of upper bound. Cross-pillar reinforces.

**Suggested backlog grouping**: `Lineage subsystem hardening sprint` (with REFACTOR-202 as the structural fix).

---
