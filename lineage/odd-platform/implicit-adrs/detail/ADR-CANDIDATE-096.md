## ADR-CANDIDATE-096 — Owner-association is a UI rendering gate for the home-page Recommended panel, NOT a security boundary; the underlying API endpoint `GET /api/dataentities/popular` has NO `identity && ownership` precondition — the gate is purely a discoverability decision

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source (PopularStrip) + cross-batch with batch-G `getPopular` (the server has no authorization assertions)
**Axes present**: ui_components, ui_routing
**Pillars affected**: [P-01, P-09] — Data Discovery × Security (cross-pillar)

**Surfaced by**:
- `PopularStrip.md:implicit_adrs[3]` (|-
    "**Owner-association gate is the rendering precondition for Popular UI access — but NOT for the underlying API endpoint.** OwnerAssociation.tsx:84-86 routes to OwnerEntitiesList only when `identity && ownership`; without ownership the user sees the OwnerAssociationForm. The API endpoint `GET /api/dataentities/popular` (per batch-G) has NO owner-association requirement at the server. The implicit decision: 'the Popular UI is a feature for owner-associated users (a richer-context audience); the API endpoint is open to any authenticated caller for third-party integrations / weekly digest dashboards.' This client-side gate is purely UX, NOT security — a curl call to the endpoint bypasses the gate entirely (and under DISABLED auth bypasses authentication too).")

**Decision statement**: The home-page Recommended panel (which includes My Objects / Upstream / Downstream / Popular columns) is rendered ONLY when the signed-in user has BOTH `identity` (always present post-login) AND `ownership` (depends on user-owner association per P-09). Without `ownership`, the user sees `OwnerAssociationForm` instead. This gate lives at `OwnerAssociation.tsx:84-86`.

The corresponding API endpoint `GET /api/dataentities/popular` (per batch-G `getPopular.md:authorization_assertions: []`) has NO ownership precondition at the server; the SECURITY_RULES catch-all `.authenticated()` is the only gate, and under `auth.type=DISABLED` even that drops to `permitAll()`.

The maintainer's implicit decision: "the home-page Popular UI is a feature for owner-associated users (a richer-context audience because of My Objects / Upstream / Downstream being identity-scoped); the API endpoint is open to any authenticated caller for third-party integrations / weekly digest dashboards / programmatic consumers." The client-side gate is purely UX (richer-context-by-association), NOT security.

Three implications encoded:
- **(a) Curl/cli access bypasses the UI gate** — a signed-in user with NO Owner association can still hit `GET /api/dataentities/popular` with their session cookie and receive the full list. The UI just doesn't surface it.
- **(b) Under DISABLED, the entire chain is anonymous** — UI hides the panel (Overview.tsx:25-27 gate); API serves anonymously. The UI hide is a UX choice (the Recommended panel is "more useful with an Owner"); it is NOT a security mitigation. An anonymous attacker on a DISABLED deployment has full read access to the popular ranking via the API.
- **(c) DOC mismatch** — the live doc at `catalog-overview.md:43` says "on auth-disabled deployments the panel is visible but the per-user filtering does not apply"; the CODE hides the entire panel under DISABLED. The doc and code disagree; either the doc should match the code's safer choice, or the code should be relaxed to match the doc.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the parent-component gate vs the API's no-gate posture is a structural commit; the client encodes the UX preference while the API stays open per the read-collaborative posture (REFACTOR-203). The choice is observable in code with consistent maintainer reasoning.
2. *Structural impact?* YES — defines the trust boundary for the home-page recommendation surface; affects how operators interpret "who can see Popular" (UI-visible vs API-reachable).
3. *Refactoring or structural?* STRUCTURAL — switching the API to also gate on ownership would change the third-party integration surface; switching the UI to also show the panel without ownership would change the UX promise.
→ ADR.

**Evidence**:
- PopularStrip.md says: "OwnerAssociation.tsx:84-86 (the rendering gate) + batch-G `getPopular` sidecar `authorization_assertions: []` (no server-side check)"
- intent_anchor: "the parent-component gate vs the API's no-gate posture — the client encodes the UX preference while the API stays open per the read-collaborative posture"
- PopularStrip.md says: "**DISABLED-mode UI suppression is a SAFETY mitigation, NOT a SECURITY mitigation.**"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-003** (read-collaborative GET) — the API's no-gate is the read-collaborative posture; the UI's ownership gate is a UX layer on top.
- **ADR-CANDIDATE-089** (partial UI permission gating) — the UI's ownership gate is similar in spirit but distinct in mechanism (ownership-context vs permission-context).
- **REFACTOR-073 family** (no boot-time security-posture validator) — the DISABLED-mode UI hide is one of many UI-side mitigations that mask the security gap; an operator unaware of the API path falsely assumes the home-page hide is a real boundary.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-295 (NEW — Owner-association UI gate is a defence-in-depth misconception: operators relying on home-page-hidden behaviour as security are at risk of misunderstanding what the gate does; needs doc clarity)
- REFACTOR-296 (NEW — DISABLED-mode UI suppression vs doc statement contradiction: live doc says panel visible under DISABLED but per-user filter doesn't apply; code unconditionally hides the entire panel. File:line evidence on both sides.)

**Proposed action**: Promote to `adrs/drafts/owner-association-ui-gate-not-security.md`. Document:
- The UI gate at `OwnerAssociation.tsx:84-86` and its UX rationale (richer-context-by-association).
- The API's no-gate posture (cross-link ADR-CANDIDATE-003).
- The explicit "this is UX, not security" framing.
- The DISABLED-mode caveat (UI hides, API serves).
- The doc-vs-code disagreement at `catalog-overview.md:43` and its resolution direction.
- The implications for third-party integrations / weekly-digest dashboards / programmatic consumers.

**Severity rationale**: MEDIUM (with cross-pillar consideration) — pattern-shaping decision at the Discovery × Security intersection; the UX-vs-security distinction is meaningful for operators.

**Cross-pillar bump**: P-01 × P-09 — security-architecture decision affecting feature surfaces. Cross-pillar tag promotes to consider HIGH but content is feature-local; staying MEDIUM with the cross-pillar note.

**Suggested backlog grouping**: `UI architecture codification` + `Doc clarity sprint`.

---
