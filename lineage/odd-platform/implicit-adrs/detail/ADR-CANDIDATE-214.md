# ADR-CANDIDATE-214 — The "additional links" surface is GLOBAL (visible to every authenticated user), NOT per-user / per-role; an operator cannot show different links to different roles via this feature

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-04 Data Discovery, P-09 Security & Access Control]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__LinksController__controller-class__LinksController.md:implicit_adrs.[1]` (HIGH) — "The 'additional links' surface is GLOBAL (visible to every authenticated user), not per-user or per-role; an operator cannot show different links to different roles via this feature." — evidence: LinksController.java:25-36 (no role/owner filtering in the response) + SecurityConstants.java:95-96 (no SecurityRule for /api/links → default authenticated()) — intent_anchor: "single endpoint returns full list regardless of caller identity; the role-aware path is intentionally absent"

**Decision statement**: `GET /api/links` returns the SAME `LinkList` payload to every caller regardless of role, owner-association, policy, or auth-mode. There is no per-role filtering, no per-owner scoping, no per-Permission gate. The operator's mental model is "additional links are surfaced uniformly to everyone who can see the toolbar." The decision is enforced at three layers: (a) controller — no `@PreAuthorize`, no Permission check, no exchange.getPrincipal() consultation; (b) routing — no SECURITY_RULES entry for `/api/links` (falls through to `pathMatchers("/**").authenticated()`); (c) data — `AdditionalLinkProperties` is a record-of-records with no `requires_role` or `audience` fields. An operator who wants "show this runbook URL to ADMIN only" cannot accomplish it via this feature; they would have to embed the access check at the linked URL itself (e.g. behind a wiki ACL) or stop using `odd.links` for sensitive URLs.

**Wisdom test**: PASS. Three intent anchors:
1. **Schema-level decision** — `AdditionalLinkProperties.Link(title, url)` is a 2-field record; there is NO `roles: List<String>` / `audience: String` / `permission: Permission` field. Adding one would require a Spring-config-binding change AND a controller-side filter AND a UI consumer change — a structural refactor.
2. **Controller-level decision** — the LinksController is 37 lines; the operator-visible scope is a stream/map/toList passthrough. There is no `filter(l -> caller.hasRole(l.requiredRole))` step. The absence is consistent across every layer.
3. **OpenAPI-spec-level decision** — `openapi.yaml:85-98` declares the `LinkList` schema with a flat `items` array and no per-item access metadata. The contract is committed at the spec level.

Structural impact (alters the trust model for what content surfaces in the toolbar — every authenticated user sees the same advisory links); alternative ("add per-role filtering") is a structural change to the binding contract, the controller, and the OpenAPI spec.

**Operator-visible consequence — the canonical mismatch**:
- Operator A wants to surface `https://internal-wiki.example.com/runbook` to ADMIN users only.
- Operator A adds the URL to `odd.links` expecting the role-aware filtering they're used to in Policy / Owner.
- Reality: every authenticated user (regardless of role / policy / owner) sees the link in the toolbar.
- Worse: under `auth.type=DISABLED`, anonymous network callers also see the link. Internal-hostname leakage to anonymous probes (REFACTOR-616 sibling pattern).

**Existing ADR**: composes with **ADR-CANDIDATE-003** (GET endpoints intentionally outside SECURITY_RULES — read-collaborative posture); this ADR is the **LINK-SPECIFIC INSTANCE** of the same posture. Where ADR-CANDIDATE-003 spans all read endpoints, this ADR specifically codifies the implications for an operator-configured surface: when the data is operator-controlled (not user-data-controlled), the read-collaborative posture applies WITH a different trust-model consequence (operators control what's exposed; users can't enumerate other users' data, but they can read operator-configured URLs).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-629 NEW (target=_blank without rel=noopener noreferrer — reverse tabnabbing)
- REFACTOR-630 NEW (no URL-scheme validation — javascript:/data: URLs pass through)
- REFACTOR-631 NEW (boot-time immutable — runtime YAML change requires restart)
- DOC-GAP — the live `odd.links` documentation does NOT mention that links are global; an operator reading the page reasonably might assume some access control is available

**Proposed action**: Promote to `adrs/drafts/additional-links-global-surface.md` (new ADR). Document:
1. The decision: links are global; no per-role / per-owner / per-Permission filtering.
2. The operator-facing implication: do NOT use `odd.links` to surface URLs that should be access-controlled; the underlying URLs must enforce their own ACL.
3. The DISABLED-mode consequence: anonymous callers see the links list (REFACTOR-185 sibling).
4. The trust-model: operators are trusted to configure links responsibly; users are NOT trusted to filter them.

**Severity rationale**: MEDIUM — pattern-shaping decision affecting the operator-configurable-catalogue contract. Not load-bearing-architectural-cross-cut (only one endpoint embodies the pattern), but the implications cascade to operator documentation and the audit story (operators who shipped internal URLs in `odd.links` thinking they were ADMIN-only will be surprised).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (GET-collaborative posture) — this is the link-specific corollary.
- SUPERSEDES: none.
- CONFLICTS: none.

---
