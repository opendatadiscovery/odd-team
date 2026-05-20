## REFACTOR-225 / REFACTOR-237 — STRENGTHENED by batch J (UI-side NEGATIVE case primary-source: LineageGraph never exercises the anchor-set-defended endpoints; the platform's defence-in-depth pattern is structurally unreachable from the UI)

This file appends batch-J primary-source confirmations to REFACTOR-225 ("`getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` — owner-scoping is a single-point-of-failure at the anchor set (no JOIN-side defence-in-depth)") and REFACTOR-237 ("Owner-scoping in lineage is anchor-set single-point-of-failure (no JOIN-side defence-in-depth at lineage CTE); SQL-layer confirmation that STRENGTHENS REFACTOR-225"). Both originally backend-evidenced; batch J adds the UI-side primary source showing that the anchor-set defence is NOT exercised from the UI at all.

**Batch J new surfaced_by**:
- `LineageGraph.md:bugs_limitations_corner_cases[9]` (|-
    "**Anchor-set defence-in-depth not exercisable at the UI** — the UI ALWAYS fetches via `/api/dataentities/{id}/lineage/downstream` and `/upstream` (thunks.ts:19, 36 calling `dataEntityApi.getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage`) — the NEGATIVE case of REFACTOR-225/237 anchor-set pattern (per batch-I LineageServiceImpl sidecar). The UI does NOT use `getMyObjectsWithDownstream` (the POSITIVE case used by DataEntityRelationsServiceImpl).")

**The negative-case argument**:

The platform has TWO families of lineage endpoints:
- **NEGATIVE case (used by UI)**: `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` — accept raw `dataEntityId`; backend service resolves the root by id with NO owner-anchoring. Per batch-I `LineageServiceImpl.java:54-57, 92` — no AuthIdentityProvider field.
- **POSITIVE case (used by DataEntityRelationsServiceImpl)**: `getMyObjectsWithUpstream` / `getMyObjectsWithDownstream` — anchor on the caller's owned entity set; the lineage walk starts from owner-scoped anchors. REFACTOR-225 documents the single-point-of-failure NATURE of this defence (anchor-set is the only gate; JOIN-side has no defence-in-depth).

The UI WIRES the NEGATIVE case (thunks.ts:19, 36). The POSITIVE case exists in the backend but is consumed by a non-UI service (DataEntityRelationsServiceImpl per batch-I evidence).

**Updated severity**: HIGH (unchanged, reinforced). The UI's structural commitment to the cross-owner-traversable endpoints means:
1. The anchor-set defence-in-depth pattern (REFACTOR-225's evidence) exists on the backend but is NOT exercised from the UI.
2. Every user (LOGIN_FORM/OAUTH2/LDAP authenticated; anonymous if DISABLED) hits the cross-owner endpoint by default.
3. The defence-in-depth quality of the anchor-set pattern is ONLY available to backend consumers — UI users get the raw cross-owner enumeration.

**Cross-references**: REFACTOR-203 (lineage cross-owner enumeration), REFACTOR-225 (anchor-set single-point-of-failure), REFACTOR-237 (SQL-layer confirmation), ADR-CANDIDATE-003 (read-collaborative GET), ADR-CANDIDATE-089 (partial UI permission gating).

---
