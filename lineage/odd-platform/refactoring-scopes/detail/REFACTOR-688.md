## REFACTOR-688 — Under `auth.type=DISABLED`, AppToolbar renders the literal string `'admin'` as the top-right user-name display AND the Logout link click yields a 404 (no Spring Security `/logout` handler registered) — the UI symptoms of REFACTOR-185 / REFACTOR-606 at the chrome-rendering layer; anonymous network callers see themselves as 'admin' with no warning banner

**Severity**: HIGH
**Category**: ui-misleading-anonymous-mode / dangling-cta-404 / missing-warning-banner
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-09 Security & Access Control, P-08 Operator Experience]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:bugs_limitations_corner_cases[2]` (HIGH) — "userName under auth.type=DISABLED renders the literal string 'admin' (from IdentityController.dummyOwner — identity.username='admin', owner=null, so owner?.name ?? identity?.username → 'admin'). This is the user-visible symptom of REFACTOR-185: any anonymous network caller who can reach the SPA sees themselves rendered as 'admin' in the top-right corner and has every action available. The toolbar surfaces no warning, no banner, no indicator that the user is unauthenticated"

- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:bugs_limitations_corner_cases[3]` (MEDIUM) — "clicking Logout under auth.type=DISABLED yields a 404 (no Spring-Security /logout handler registered — `.logout(Customizer.withDefaults())` is only configured in `LoginFormSecurityConfiguration.java:59` and `LDAPSecurityConfiguration.java:146`; OAUTH2 uses a custom handler; DisabledAuthSecurityConfiguration.java has NO .logout(...) call). The Logout link is shown to every user including DISABLED-mode users; clicking it produces a confusing UX error"

- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:security.known_security_gaps[0]` (HIGH) — "under auth.type=DISABLED, the toolbar renders 'admin' as the username to every anonymous network caller — the UI symptom of REFACTOR-185"

**Statement**: Under `auth.type=DISABLED` (the bundled `application.yml:34` default), two UI defects compound:

**1. The user-name display reads "admin" literally.** The toolbar uses the precedence `owner?.name ?? identity?.username` (ADR-CANDIDATE-238 NEW this batch) at `AppToolbar.tsx:74`. Under DISABLED, `IdentityController.dummyOwner` returns `identity.username='admin'` + `owner=null` (`IdentityController.java:30-33`). The nullish-coalescing produces the string `'admin'`. Every anonymous network caller who reaches the SPA sees themselves rendered as 'admin' in the top-right corner. There is no warning banner, no indicator, no badge that this is the unauthenticated DISABLED mode. The user's mental model: "I'm logged in as admin" — completely wrong.

This is the UI-LAYER MULTIPLIER of REFACTOR-185 (DISABLED bypasses SECURITY_RULES) + REFACTOR-606 (`IdentityController.dummyOwner` uses `Arrays.asList(Permission.values())` — every Permission auto-grants under DISABLED). The combination: anonymous caller hits SPA → backend issues 'admin' identity + all permissions → toolbar renders 'admin' → every UI affordance the user clicks routes to a backend that permits the action.

**2. Clicking Logout yields a 404.** The Logout link uses `handleLogout = () => { window.location.href = '/logout' }` (`AppToolbar.tsx:35-37`) — a deliberate full-page redirect to invoke Spring Security's session-clear handler (ADR-CANDIDATE-237 NEW this batch). Spring Security's `.logout(Customizer.withDefaults())` is configured under LOGIN_FORM (`LoginFormSecurityConfiguration.java:59`) and LDAP (`LDAPSecurityConfiguration.java:146`); OAUTH2 uses custom handlers. Under DISABLED, `DisabledAuthSecurityConfiguration.java:11-19` has NO `.logout(...)` call — the `/logout` path is permitAll-reachable but unbound by any handler. The Logout link is shown to every user (including DISABLED-mode users) → clicking produces a 404 → the user must back out of the error page. The "session" (there isn't one) is unchanged. UX-confusing but security-neutral (there was nothing to log out from).

**Operator-visible impact**:
- Anonymous attacker reaching the SPA root URL (under DISABLED) sees themselves as 'admin' with no warning. They can browse every catalog entity, every owner, every alert. If the operator believed DISABLED was "safe for internal-only deployment", the toolbar's 'admin' rendering reinforces that misconception — the operator's own browsing also shows 'admin', so they have no signal that the same surface is reachable by unauthenticated callers.
- A first-time evaluator running the bundled default deployment sees 'admin' in the toolbar and clicks Logout to test the auth flow. Gets a 404. Wonders if the platform is broken.

**Evidence**:
- AppToolbar.tsx:74 (`{owner?.name ?? identity?.username}`)
- AppToolbar.tsx:35-37 (`handleLogout` window.location.href '/logout')
- IdentityController.java:30-33 (dummyOwner with username='admin')
- application.yml:34 (`auth.type: DISABLED` default)
- DisabledAuthSecurityConfiguration.java:11-19 (no `.logout(...)` configuration)
- LoginFormSecurityConfiguration.java:59 (the ONLY `.logout(Customizer.withDefaults())` under LOGIN_FORM)
- LDAPSecurityConfiguration.java:146 (the ONLY `.logout(Customizer.withDefaults())` under LDAP)

**Existing-ADR-or-implied-prescription**: composes with:
- ADR-CANDIDATE-238 NEW this batch (`owner?.name ?? identity?.username` precedence — the UI consumer of the IdentityController contract; the defect is the consequence of DISABLED-mode dummyOwner being indistinguishable from real principal in this render).
- ADR-CANDIDATE-237 NEW this batch (logout-via-full-page-redirect to `/logout` — the architectural choice that assumes Spring Security has a handler registered; DISABLED lacks one).
- REFACTOR-185 (DISABLED bypasses SECURITY_RULES — the upstream cluster) — this scope is the UI-LAYER VISIBLE SYMPTOM.
- REFACTOR-606 (dummyOwner uses `Arrays.asList(Permission.values())` — every new Permission auto-enters admin grant).

**Proposed remedy**: Two-part fix (UI-side + chrome-banner):

**Part A — Surface DISABLED-mode status in the chrome**:
- Read `auth.type` (or equivalent — likely via `/api/appInfo` which already returns `authType`) at AppToolbar mount.
- If `authType === 'DISABLED'`, render a warning banner above the toolbar: "Unauthenticated mode (auth.type=DISABLED). All network callers can reach this platform. Configure authentication before production deployment." With a link to the live `enable-security` docs page.
- Replace the literal 'admin' rendering with a clearer "Anonymous (DISABLED mode)" or hide the username entirely.

**Part B — Make Logout a no-op (or hide it) under DISABLED**:
- Read `authType` at the user-menu rendering.
- If DISABLED, hide the Logout menu item OR render it disabled with tooltip "Logout is not applicable in DISABLED authentication mode".
- Alternative: configure Spring Security's DisabledAuthSecurityConfiguration with a `.logout()` chain that simply redirects to `/` (a graceful no-op).

Effort: small (1-2 hour task). Part A is more important — the chrome-level warning banner is the canonical pattern for "you are running an insecure default" (cross-ref REFACTOR-093 — no boot-time WARN logged when DISABLED activates; this scope is the UI-side warning).

**Severity rationale**: HIGH — operator-misleading default deployment compounds with no-banner-warning to produce a "this looks fine" UX while the actual security posture is unconfigured. The toolbar's 'admin' rendering is the most visible deliverable of the REFACTOR-185 disclosure cluster; fixing it removes the strongest "looks fine" signal from the default deployment. The Logout 404 is a smaller UX defect bundled here for fix-batch coherence.

**Suggested backlog grouping**: `DISABLED-mode operator-safety sprint` — couple with REFACTOR-093 (no boot-time WARN log), REFACTOR-068 (DISABLED /api/appInfo discloses authType + version anonymously), REFACTOR-616 (DISABLED wizard registry anonymous read), REFACTOR-296 (DISABLED Recommended panel doc-vs-code contradiction), REFACTOR-606 (dummyOwner Permission.values() — the upstream blast-radius). The full DISABLED-mode hardening sprint surfaces the UX warnings + the docs + the boot-log + the inline banner as a coherent operator-facing change.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-185 (DISABLED bypasses SECURITY_RULES — this is the UI-layer symptom), REFACTOR-606 (dummyOwner Permission.values()), REFACTOR-068 (DISABLED /api/appInfo anonymous read), REFACTOR-616 (DISABLED wizard read), REFACTOR-296 (DISABLED Recommended doc-vs-code), REFACTOR-093 (no boot WARN), ADR-CANDIDATE-237 NEW (full-page logout — the architectural choice this defect breaks under DISABLED), ADR-CANDIDATE-238 NEW (user-display precedence — the rendering chain this defect reveals).
- SUPERSEDES: none.
- CONFLICTS: none.

---
