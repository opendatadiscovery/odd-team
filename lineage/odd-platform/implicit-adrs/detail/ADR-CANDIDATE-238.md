## ADR-CANDIDATE-238 — User-name display in the AppToolbar precedence: `owner?.name ?? identity?.username` — operator-curated owner display name preferred over raw principal username (which under LDAP/OAUTH2 may be a UPN or email)

**Severity**: MEDIUM
**Classification**: promote
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-09 Security & Access Control, P-08 Operator Experience]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:implicit_adrs[0]` (MEDIUM) — "user-name display prefers owner.name over identity.username — chosen so that operator-curated 'display names' (set via OwnerAssociation) override the raw principal username (which under LDAP/OAUTH2 may be a UPN or email) — evidence: AppToolbar.tsx:74 (`{owner?.name ?? identity?.username}`) — intent_anchor: 'owner?.name ?? identity?.username' (the precedence chosen via nullish-coalescing, repeated nowhere else; the convention is enforced by reading both selectors and choosing one) — confidence: MEDIUM"

**Decision statement**: The platform's AppToolbar renders the top-right user-name display using the precedence `owner?.name ?? identity?.username` (`AppToolbar.tsx:74`). The display preference: if the user has been associated with an Owner (via OwnerAssociation), show the OPERATOR-CURATED display name (e.g. "Alice Smith"); otherwise fall back to the raw principal username (e.g. `alice.smith@example.com` under OAUTH2, or `CN=Alice Smith,DC=example,DC=com` under LDAP). The choice is encoded via the JavaScript nullish-coalescing operator — `owner` is null/undefined → falls through to `identity`; `owner.name` is empty string → STILL shown (empty string is not null/undefined per `??` semantics, so an empty owner name would render blank rather than falling through).

The implication: the operator-administered Owner display surface is the canonical "what name should be shown for this user" surface; the principal-side identity is a fallback used when the user hasn't been associated yet (e.g. brand-new OAUTH2 user before their auto-create or admin-association flow has run).

**Wisdom test (3-question)**:
1. *Intentional?* YES — the precedence is encoded via `??` on line 74, with both selectors explicitly read on lines 20-21 (`getIdentity` and `getOwnership`). Reading BOTH selectors and choosing one is deliberate — a non-deliberate render would have read just `identity?.username` directly.
2. *Structural impact?* YES — the choice shapes the user-recognition UX across every page: the user sees their curated display name everywhere the toolbar renders. It also commits to an Owner-association lifecycle: a user with no owner association sees their raw principal (UPN / email / DN) in the toolbar — which is the cue to admin-create the association.
3. *Refactoring or structural?* STRUCTURAL — switching to `identity?.username ?? owner?.name` (inverted precedence) or to `identity?.username || owner?.name` (truthy-or, treating empty string as falsy) would change the displayed name across every page for users with both fields populated. The chosen precedence is architectural.
→ ADR.

**Evidence**:
- AppToolbar.md says: "user-name display prefers owner.name over identity.username — chosen so that operator-curated 'display names' (set via OwnerAssociation) override the raw principal username"
- AppToolbar.tsx:74 (`{owner?.name ?? identity?.username}`)
- AppToolbar.tsx:20-21 (the two selectors `getIdentity` and `getOwnership` both read on every render)
- IdentityController.java:30-33 (the dummyOwner under DISABLED sets identity.username='admin' AND owner=null — so under DISABLED the toolbar falls through to "admin" literally; cross-ref REFACTOR-688 NEW this batch for the consequence)

**Existing ADR**: composes with:
- ADR-CANDIDATE-049 (NEW 2026-05-12E) — Owner-directory CRUD is identity-decoupled by design; this ADR-238 is the UI-layer consumer of that decoupling.
- ADR-CANDIDATE-112 (`OwnershipServiceImpl` principal-independent — `owner_name` taken verbatim from form, never inferred) — the owner.name field this ADR-238 prefers IS the operator-curated value, not the auto-inferred one.

**Proposed action**: Promote to `adrs/drafts/user-display-owner-precedence.md` (new ADR). Document:
- The precedence and its rationale (curated display over raw principal).
- The implied operator workflow (admin associates each authenticated user with an Owner; until then the toolbar shows the principal username).
- The DISABLED-mode interaction (owner=null + identity.username='admin' → toolbar shows "admin"; flagged as REFACTOR-688 because it surfaces an unauthenticated UX symptom).
- The cross-link to the WithPermissionsProvider chain (the owner-association is also load-bearing for permission resolution; cross-ref existing ADR-CANDIDATE-049 / 112).

**Severity rationale**: MEDIUM — pattern-shaping UX decision; affects user-recognition across every authenticated page. Not HIGH because the decision itself is correct; the DISABLED-mode symptom is a separate refactoring scope. Not LOW because the precedence is load-bearing and currently undocumented; a future PR "improving" the user-recognition pattern could silently invert it.

**Suggested backlog grouping**: `UI architecture codification`.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-688 NEW this batch (DISABLED-mode renders 'admin' literal as user-name — the consequence of `owner?.name ?? identity?.username` when both `owner=null` and `identity.username='admin'`).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-049 (Owner-directory identity-decoupled CRUD); ADR-CANDIDATE-112 (OwnershipServiceImpl principal-independent).
- SUPERSEDES: none.
- CONFLICTS: none.

---
