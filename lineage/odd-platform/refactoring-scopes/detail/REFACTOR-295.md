## REFACTOR-295 — Owner-association UI gate is a DEFENCE-IN-DEPTH MISCONCEPTION: operators reading "Recommended panel hidden until you have an Owner" may interpret it as a security boundary, but the API endpoint `/api/dataentities/popular` is open to ANY authenticated caller (and ANY caller under DISABLED) — needs explicit doc clarity

**Severity**: MEDIUM
**Category**: missing-doc + doc-code-drift + info-disclosure-via-misconception
**Pillars affected**: [P-01, P-09] — Discovery × Security (cross-pillar)
**Surfaced by**:
- `PopularStrip.md:security.known_security_gaps[1]` (|-
    "**DISABLED-mode UI suppression is a SAFETY mitigation, NOT a SECURITY mitigation.** The fact that the Recommended panel hides under `auth.type=DISABLED` (Overview.tsx:25-27) is a **client-side rendering decision** that prevents anonymous users from SEEING the home-page Popular column. It does NOT prevent anonymous users from CALLING `GET /api/dataentities/popular` directly. An anonymous attacker on a DISABLED deployment still has full anonymous read access to the popular ranking via the API; the home-page UI just doesn't surface it. Operators relying on the home-page-hidden behaviour as a defence-in-depth measure are at risk of misunderstanding what the gate does — it's UX, not security.")
- `PopularStrip.md:security.known_security_gaps[2]` (|-
    "**Owner-association gate is bypassable via direct API call.** A signed-in user with no Owner association sees the OwnerAssociationForm instead of OwnerEntitiesList on the home page. But that same user can `curl /api/dataentities/popular` with their session cookie and get the full popular list — the API has no `identity && ownership` precondition.")

**Description**: ADR-CANDIDATE-096 codifies the owner-association gate as UX, NOT security. REFACTOR-295 is the doc-debt side: operators currently have no documentation explaining the distinction. An operator reading the home page's behaviour ("I can't see the Popular column until I have an Owner association") may reasonably infer this is a security boundary. The doc gap means this misconception goes unchallenged.

The risk is operationally significant:
- **Operator misinterprets**: "Popular is hidden from unauthenticated users on my DISABLED deployment, so anonymous traffic can't see internal entity rankings." → FALSE. Anonymous traffic hits the API directly.
- **Operator misinterprets**: "Users without Owner association can't see other owners' Popular entities." → FALSE. They can curl the endpoint.
- **Operator misconfigures**: relies on the UI gate as a defence-in-depth layer when planning a multi-tenant rollout, then discovers the API exposure later.

The doc product needs explicit clarity on three points:
1. The UI rendering gates are UX, not security.
2. The API endpoint `/api/dataentities/popular` is open to any authenticated user (and anonymous under DISABLED).
3. The read-collaborative posture (ADR-CANDIDATE-003 family + ADR-CANDIDATE-089) is the architectural commitment; operators should not assume per-owner read scoping.

**Primary source citations**:
- `Overview.tsx:25-27` (DISABLED UI gate)
- `OwnerAssociation.tsx:84-86` (ownership UI gate)
- Batch-G `getPopular.md` (API has no authorization assertions)
- `PopularStrip.md` documents the misconception risk

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-096 (newly minted) codifies the gate as UX-not-security. REFACTOR-295 is the doc-product follow-through.

**Proposed remedy**: DOC-NNN follow-up — extend the `enable-security` doc page (or a new defence-in-depth page) with explicit clarifications:
1. **"UI gates are not security"** section — enumerate the four UI gates (Overview's `authType !== DISABLED`, OwnerAssociation's `identity && ownership`, WithPermissions button gates, route-level mounting) and clarify their UX-only nature.
2. **"Read-collaborative posture"** section — restate ADR-CANDIDATE-003's commitment in operator-facing language: "Any authenticated user can read every entity's metadata."
3. **Cross-references** to the API endpoints that are reachable beyond the UI.

The doc-product extension should be paired with an ADR-CANDIDATE-096 promotion (the structural commit).

**Severity rationale**: MEDIUM — operator-misconception risk in security-planning workflows; cross-pillar (P-01 × P-09); the fix is doc-product authoring.

**Cross-pillar bump**: P-01 × P-09 — security-planning impact; bumps to MEDIUM (was LOW info-disclosure).

**Suggested backlog grouping**: `Doc completeness sprint` (specifically the security architecture clarity sub-sprint) + `Authorization audit batch`.

---
