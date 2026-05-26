## ADR-CANDIDATE-237 — Logout is a FULL-PAGE browser redirect (`window.location.href = '/logout'`), NOT a SPA-router navigation — the deliberate departure from the SPA's navigation pattern invokes Spring Security's server-side session-clear AND IDP-chain logout (under OAUTH2 via `OAuthLogoutSuccessHandler`)

**Severity**: MEDIUM
**Classification**: promote
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-09 Security & Access Control]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:implicit_adrs[1]` (MEDIUM) — "logout is a full-page redirect, not a SPA-router navigation — chosen so that the backend's Spring-Security logout handler can clear server-side session state AND redirect (e.g. OAuthLogoutSuccessHandler chains to the IDP's logout endpoint per `OAuthSecurityConfiguration.java:100`); a client-side router navigation would skip the session-clear step — evidence: AppToolbar.tsx:35-37 (`handleLogout = () => { window.location.href = '/logout'; }`) — intent_anchor: 'window.location.href = '/logout'' (the choice of full-page redirect over react-router's `navigate('/logout')` is a deliberate departure from the rest of the SPA's navigation pattern) — confidence: MEDIUM"

**Decision statement**: The platform's AppToolbar logout handler uses `window.location.href = '/logout'` (`AppToolbar.tsx:35-37`) — a full-page browser navigation that exits the SPA shell — rather than the standard react-router-dom `navigate('/logout')` SPA-router navigation that every other in-toolbar action uses (tab clicks, "Home Page" link in AppErrorPage, brand-block click on the logo, etc.). The departure is deliberate: the `/logout` path is bound by Spring Security's `.logout(Customizer.withDefaults())` chain (configured under `LoginFormSecurityConfiguration.java:59` and `LDAPSecurityConfiguration.java:146`) and by `OAuthLogoutSuccessHandler` chains for OAUTH2 (e.g. `CognitoLogoutSuccessHandler`, `AzureLogoutSuccessHandler`). A SPA-router navigation to `/logout` would skip the Spring Security handler entirely — the user's session would remain valid on the backend, defeating the logout.

The decision implicitly commits to: (a) the backend `/logout` handler MUST be configured under every auth mode where logout is meaningful (it is NOT configured under DISABLED — REFACTOR-688 NEW this batch); (b) the full-page reload is acceptable UX cost for security correctness; (c) OAUTH2's IDP-chain logout flow (`/logout` → Spring `LogoutSuccessHandler` → IDP `/oauth2/logout` → back to ODD root) is invoked end-to-end through the same path.

**Wisdom test (3-question)**:
1. *Intentional?* YES — every other navigation in the SPA uses react-router-dom; this one is a deliberate `window.location.href` (the explicit choice anchor is right there in the code). The contrast is what marks it as a decision, not an oversight.
2. *Structural impact?* YES — the choice shapes the auth-flow architecture: server-side session-clear + IDP-chain logout flow + full-page reload to clean SPA state. Reverting (e.g. to `navigate('/logout')`) would silently degrade logout from "session cleared, IDP signed out" to "URL changed; session still valid".
3. *Refactoring or structural?* STRUCTURAL — switching to an XHR-based logout (`fetch('/logout', { method: 'POST' })` followed by SPA navigation) is technically possible but would change the auth-flow contract; the OAuth IDP-chain redirect would need to be reconstructed manually; the cleanup-the-SPA-state semantics of a full-page reload would be lost. The full-page-redirect is the architectural choice.
→ ADR.

**Evidence**:
- AppToolbar.md says: "logout is a full-page redirect, not a SPA-router navigation"
- AppToolbar.tsx:35-37 (`window.location.href = '/logout'`)
- LoginFormSecurityConfiguration.java:59 + LDAPSecurityConfiguration.java:146 (`.logout(Customizer.withDefaults())` chains)
- OAuthSecurityConfiguration.java:100 + CognitoLogoutSuccessHandler / AzureLogoutSuccessHandler / OdiamLogoutSuccessHandler (IDP-chain logout)
- DisabledAuthSecurityConfiguration.java:11-19 (no `.logout(...)` call — under DISABLED, the path is permitAll but unbound; clicking Logout yields a 404)

**Existing ADR**: none for the choice itself. Composes with ADR-CANDIDATE-133 (`UriUtils.getBaseUri(requestUri)` post-logout redirect URI is inbound-request-derived — the operator-trust contract that this ADR depends on for the post-IDP-logout final landing).

**Proposed action**: Promote to `adrs/drafts/logout-full-page-redirect.md` (new ADR). Document:
- The choice and its rationale (server-side session-clear + IDP-chain).
- The implicit contract for each auth mode: LOGIN_FORM / LDAP / OAUTH2 must register `/logout` handlers; DISABLED has none (UX defect documented as REFACTOR-688 NEW).
- The full-page-reload UX cost (acceptable; logout is rare).
- The cross-link to ADR-CANDIDATE-133 (URI derivation for post-logout landing).

**Severity rationale**: MEDIUM — load-bearing security architecture but bounded to one user action; the consequences (DISABLED-mode 404 = REFACTOR-688 NEW) are separately tracked. Not HIGH because the decision isn't responsible for any data exposure; it is a positive security-correctness property. Not LOW because it codifies a deliberate departure from the SPA's universal navigation pattern.

**Suggested backlog grouping**: `Authentication / boot-time security posture codification`.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-688 NEW this batch (under DISABLED, clicking Logout produces a 404 — the consequence-of-this-ADR for the no-logout-handler-registered auth mode).
- REFACTOR-411 (OAuth logout handlers lack `@Slf4j` audit logging — composes with this ADR for the OAUTH2 logout flow).
- REFACTOR-401 (Cognito empty `logout-uri` silent NO-OP — composes with this ADR for the IDP-chain configuration).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-133 (UriUtils.getBaseUri for post-logout landing — the URI derivation contract).
- SUPERSEDES: none.
- CONFLICTS: none.

---
