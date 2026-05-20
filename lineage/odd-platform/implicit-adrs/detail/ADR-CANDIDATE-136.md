## ADR-CANDIDATE-136 — `adminPrincipals` BYPASSES `organizationName` gate — the explicit allowlist beats the org-membership gate; an `admin-principals: [external-consultant]` entry grants ADMIN to that user even if they are NOT a member of the configured GitHub organization. The decision encodes "explicit allowlist > org-gate" precedence; intentional but undocumented

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-09-security-access-control]
**Support count**: 1 sidecar (batch O GithubUserHandler) — single-sidecar but the decision is security-boundary-defining and operator-mental-model-shaping; routed as `promote` because the ordering is a structural commitment (lines 54-67 fire BEFORE line 68's org-empty check)
**Axes present**: auth_handlers
**Batch**: O (2026-05-19)

**Surfaced by**:
- `GithubUserHandler.md:implicit_adrs.[1]` (HIGH) — "**Admin-principals override organization-name (explicit allowlist beats org-gate).** Lines 54-67 fire BEFORE the `organizationName` empty-check at line 68. The maintainer's intent: an operator wanting to grant ADMIN to a specific user outside the org (a consultant, an external admin) can do so by listing them in `adminPrincipals` — the explicit allowlist is more specific than the org gate. NOT documented." — intent_anchor: "the if-block at lines 54-67 has its own `return Mono.just(...)` at lines 62-65 BEFORE any org-check; the ordering IS the precedence"

**Decision statement**: ODD's GitHub OAuth2 handler enforces a deliberate **ordering of admin-grant precedence**: when `adminPrincipals` is non-empty AND the user's `admin-attribute` claim (default `login`) full-string-case-insensitive-matches any entry, the user is GRANTED ADMIN role with NO organization-membership check (`GithubUserHandler.java:54-67` — the if-block has its own `return Mono.just(...)` at lines 62-65 BEFORE any org-check at line 68). The ordering encodes the architectural rule:

**`adminPrincipals` is an EXPLICIT ALLOWLIST that BYPASSES the `organizationName` gate.**

An operator's `adminPrincipals: [external-consultant]` entry grants ADMIN to `external-consultant` even if that user is NOT a member of the configured GitHub organization. The deliberate design choice: an operator who knows the user identity (the GitHub `login`) and wants to grant ADMIN regardless of org-membership can do so without an org-membership workaround. The architectural choices encoded:

- **(a) The explicit allowlist is more specific than the org-gate** — operators using `adminPrincipals` are stating "I want THIS user as ADMIN, regardless of where they live in GitHub's org structure." The platform respects that explicit statement.
- **(b) The org-gate is a default-restriction, not a hard-restriction** — `organizationName` is the operator's coarse-grained filter ("only members of MyOrg"); `adminPrincipals` is the operator's fine-grained ADMIN allowlist ("AND also these specific users"). The two compose: org-members default to USER (unless their team appears in `adminGroups`); explicitly-listed principals get ADMIN regardless.
- **(c) The precedence is encoded by ORDERING in `enrichUserWithProviderInformation`** — lines 54-67 (admin-principals fast-path) precede lines 68-74 (no-org skip) precede lines 76-96 (org-membership gate). The dispatcher follows the order; the structure IS the decision.
- **(d) The operator threat model is "trust the operator to know who admins are"** — if the operator lists `external-consultant` in `adminPrincipals`, the platform trusts them to have verified the user's GitHub `login`. The platform does not cross-check whether that user is in an org they trust; the trust delegation is explicit.
- **(e) The doc-side is silent** — live OAuth2/OIDC docs (WebFetched 2026-05-19 status 200) describe `admin-principals` as "Direct list of users granted ADMIN role" without flagging the org-bypass semantic. An operator expecting `organization-name` to be a HARD gate is surprised; the org-bypass is intentional but undocumented (REFACTOR side; doc-completeness).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the if-block at GithubUserHandler.java:54-67 has its OWN `return Mono.just(...)` at lines 62-65, terminating the Mono chain BEFORE the org-check at line 68. The maintainer COULD have written the org-check first; they wrote the admin-principals fast-path first. The ordering IS the design statement.
2. **Structural impact?** YES — affects every operator's mental model of admin-grant precedence; affects the security audit story (an audit asking "who can be ADMIN?" must consider both `adminPrincipals` and team-membership-via-`adminGroups`, in that order); affects future per-provider handlers (any handler adopting both `adminPrincipals` and `adminGroups` MUST decide the same precedence).
3. **Switching to "org-membership is HARD-required" is REFACTORING or STRUCTURAL?** STRUCTURAL — flipping the ordering would change the security guarantee operators rely on: an operator using `adminPrincipals: [external-consultant]` without an org-membership entry for the consultant would suddenly see the consultant FAIL login. Existing deployments would break. A migration would require either (i) operator coordination to add org-membership for every adminPrincipal, OR (ii) inverting the meaning of the config to `org-membership-takes-precedence` with operator-visible semantic change.

**Evidence**:
- GithubUserHandler.java:54-67 (the admin-principals fast-path — if-block with own `return Mono.just(...)`)
- GithubUserHandler.java:68 (the subsequent `if (StringUtils.isEmpty(organizationName))` — runs only if line 67 doesn't return)
- GithubUserHandler.java:76-91 (the org-membership gate — only reached if neither admin-principals nor empty-org-name triggered)
- WebFetch `/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-19 status 200: "admin-principals — Direct list of users granted ADMIN role" (no mention of org-bypass)

**Existing ADR**: none. **Composes with ADR-CANDIDATE-035** (fail-closed `GrantedAuthoritiesMapper` — the rejection-by-default stance applies WHEN admin-principals does NOT match; this ADR specifies the affirmative-match shortcut). **Composes with ADR-CANDIDATE-038** (LDAP `containsIgnoreCase` admin-group ergonomic — LDAP's admin-group decision has SIMILAR semantics; both share the "explicit allowlist > implicit derivation" stance). **Composes with ADR-CANDIDATE-135** (GitHub OAuth2-non-OIDC — same handler surface).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- (Doc-side) — Live docs do not flag the org-bypass semantic; operator-mental-model gap. Logged as part of REFACTOR-390-family doc surface needing the multi-facet OAuth provider clarification.

**Proposed action**: Promote to `adrs/drafts/github-admin-principals-bypass-org-gate.md` (new ADR). Document:
- The ordering: admin-principals match → ADMIN (org-bypass); empty `organizationName` → USER (no further check); org-membership gate → fail if not a member → admin-team gate.
- The operator threat model: trust the operator to know who admins are.
- The trade-off: explicit allowlist is more specific than coarse-grained org-gate.
- The doc-side commitment: the live page should flag the org-bypass semantic so operators don't misunderstand.

**Severity rationale**: MEDIUM — security-boundary-defining decision. The pattern itself is sound (explicit allowlists > implicit gates is a defensible architectural rule); the gap is the operator-doc clarity. Future per-provider handlers (Okta + Keycloak via REFACTOR-113) should adopt the same precedence — codifying it as an ADR makes the contract explicit.

---
