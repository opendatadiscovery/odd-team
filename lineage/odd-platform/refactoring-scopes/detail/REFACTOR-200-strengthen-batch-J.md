## REFACTOR-200 — STRENGTHENED by batch J (UI-side primary-source confirmation of cross-owner DataEntityDetails read)

This file appends batch-J primary-source confirmations to REFACTOR-200 ("Cross-owner read of the centerpiece DataEntityDetails — the widest blast-radius read-collaborative gap in the catalog"). Originally backend-evidenced (`getDataEntityDetails` + `DataEntityServiceImpl`); batch J adds the UI realisation point: the SPA dispatches the read unconditionally for every authenticated user, never gates by owner.

**Batch J new surfaced_by**:
- `DataEntityDetails.md:security.owner_scoping` (|-
    "`BYPASSES — no owner predicate at this layer` — the component passes `dataEntityId` directly to thunks without owner filtering. Backend confirms (per neighbour sidecar): the GET endpoint applies no owner scoping (read-collaborative posture); cross-owner reads are silent. This component is the front-end embodiment of the read-collaborative posture: it does not surface any UI signal that the user is reading another owner's entity. There is no banner, no permission-aware redirect, no soft-gate prompt.")
- `fetchDataEntityDetails.md:security.owner_scoping` (|-
    "BYPASSES — the thunk passes only `dataEntityId` to the API; no owner / namespace / role filter is applied client-side. The backend (per batch F) also does not scope by owner. Combined: any authenticated user can fetch any entity's detail payload.")

**Updated severity**: HIGH (unchanged). The UI-side primary source CONFIRMS the gap is end-to-end intentional: the SPA's architectural commit (ADR-CANDIDATE-089) is to NOT surface any per-owner-read UI cue. The gap is no longer "backend doesn't enforce" alone — it is "neither end enforces."

**Co-confirmation**: ADR-CANDIDATE-089 (newly minted in batch J) is the explicit codification of the partial-gating posture from the UI side.

---
