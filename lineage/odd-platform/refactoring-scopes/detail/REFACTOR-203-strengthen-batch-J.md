## REFACTOR-203 — STRENGTHENED by batch J (UI-side PRIMARY-SOURCE confirmation: the UI never uses anchor-set-defended endpoints; LineageGraph fetches via the cross-owner-traversable endpoints)

This file appends batch-J primary-source confirmations to REFACTOR-203 ("Lineage cross-owner enumeration via downstream graph traversal — graph-shaped enumeration vector wider than search"). Originally backend-evidenced (batch F + batch I `LineageServiceImpl`); batch J adds the UI-side NEGATIVE-case primary source: the SPA WIRES the cross-owner endpoints, NOT the anchor-set-defended endpoints.

**Batch J new surfaced_by**:
- `LineageGraph.md:bugs_limitations_corner_cases[9]` (|-
    "**Anchor-set defence-in-depth not exercisable at the UI** — the prompt asks 'does the UI fetch via `/my/upstream` or `/lineage` endpoints?' The UI ALWAYS fetches via `/api/dataentities/{id}/lineage/downstream` and `/upstream` (thunks.ts:19, 36 calling `dataEntityApi.getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage`) — the NEGATIVE case of REFACTOR-225/237 anchor-set pattern (per batch-I LineageServiceImpl sidecar). The UI does NOT use `getMyObjectsWithDownstream` (the POSITIVE case used by DataEntityRelationsServiceImpl). Consequence: every user (LOGIN_FORM/OAUTH2/LDAP authenticated; anonymous if DISABLED) enumerates the cross-owner lineage subgraph from the Lineage tab — the user-visible effect of REFACTOR-203.")
- `LineageGraph.md:security.owner_scoping` (|-
    "BYPASSES — returns data across owners — the UI fetches via `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` (thunks.ts:19, 36) which hit `LineageServiceImpl.getLineage` (per batch-I sidecar) — the NEGATIVE case of anchor-set defence-in-depth (LineageServiceImpl.java:54-57 has no AuthIdentityProvider field, line 92 resolves root by raw dataEntityId with no owner-anchoring). Any authenticated user sees the full reachable lineage subgraph from any entity, including edges into entities owned by other teams.")
- `LineageGraph.md:security.known_security_gaps[1]` (|-
    "Cross-owner enumeration at UI realisation point — the user-observable consequence of REFACTOR-203 is that ANY authenticated user can click into the Lineage tab on ANY entity (regardless of their owner association) and read the full reachable subgraph. The UI provides no 'restricted view' mode, no 'show only my owners' toggle.")

**Updated severity**: HIGH (unchanged but reinforced). The UI-side PRIMARY-SOURCE confirms the gap is reachable from every authenticated user via the standard Lineage tab — not just from direct API callers. The UI WIRES the cross-owner endpoint by default; the anchor-set defence-in-depth pattern exists on the backend (REFACTOR-225 — `getMyObjectsWithDownstream` is the positive case) but is NOT exercised at the UI.

**Cross-pillar**: P-05 (Lineage) × P-09 (Security) — operator-visible cross-owner enumeration; the UI is the realisation point.

---
