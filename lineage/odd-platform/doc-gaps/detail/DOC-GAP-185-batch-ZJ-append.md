## STRENGTHENS — AppToolbar + ToolbarTabs + AppInfoMenu (batch ZJ)

The 5 UI-shell + i18n sidecars enriched in batch ZJ supply NEW PRIMARY SOURCES for the SPA-auth-UX silence DOC-GAP-185 documents AND extend the gap with three operator-impact dimensions the original framing only hinted at.

### Added surfaced_by (new sidecars cited)

- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:bugs_limitations_corner_cases[2]` — **NEW**: "userName under auth.type=DISABLED renders the literal string 'admin' (from IdentityController.dummyOwner — identity.username='admin', owner=null, so owner?.name ?? identity?.username → 'admin'). This is the user-visible symptom of REFACTOR-185: any anonymous network caller who can reach the SPA sees themselves rendered as 'admin' in the top-right corner and has every action available. The toolbar surfaces no warning, no banner, no indicator that the user is unauthenticated" **(severity HIGH per sidecar)**
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:bugs_limitations_corner_cases[3]` — **NEW**: "clicking Logout under auth.type=DISABLED yields a 404 (no Spring-Security /logout handler registered — `.logout(Customizer.withDefaults())` is only configured in `LoginFormSecurityConfiguration.java:59` and `LDAPSecurityConfiguration.java:146`; OAUTH2 uses a custom handler; DisabledAuthSecurityConfiguration.java has NO .logout(...) call). The Logout link is shown to every user including DISABLED-mode users; clicking it produces a confusing UX error" **(severity MEDIUM per sidecar)**
- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:security.known_security_gaps[0]` — **NEW**: "under auth.type=DISABLED, the toolbar renders 'admin' as the username to every anonymous network caller — the UI symptom of REFACTOR-185; an anonymous attacker reaching the SPA sees themselves rendered as 'admin' with every permission unlocked by WithPermissionsProvider" **(severity HIGH per sidecar)**
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:bugs_limitations_corner_cases[3]` — **NEW**: "The widget renders projectVersion to anonymous viewers when `auth.type=DISABLED`. Under DISABLED, the SPA loads without authentication; AppInfoMenu fires `useAppInfo` against `/api/appInfo` which is permitAll-reachable; the response includes `projectVersion`; the menu renders `<Typography variant='h4'>{appInfo.projectVersion}</Typography>` at line 47. A network attacker hitting the SPA root URL anonymously gets the precise version disclosed in the rendered HTML via the App Info menu." **(severity MEDIUM per sidecar)**

### New evidence (supplementary)

- `AppToolbar.tsx:74` (verbatim line, confirmed this session via full Read): `{owner?.name ?? identity?.username}` — the null-coalescing user-name fallback; under DISABLED, `identity.username = 'admin'` (from `IdentityController.java:30-33` `dummyOwner` branch) and `owner = null`, so the rendered string IS the literal 'admin'.
- `AppToolbar.tsx:35-37` (verbatim): `const handleLogout = () => { window.location.href = '/logout'; };` — hardcoded full-page redirect; under DISABLED no `/logout` handler is registered, so the browser hits a 404.
- `DisabledAuthSecurityConfiguration.java:11-19` (cross-confirmed via sidecar primary source) — verbatim: `.authorizeExchange(spec -> spec.anyExchange().permitAll())` — no `.logout(...)` chain; the path is permitted but the handler is absent.
- `LoginFormSecurityConfiguration.java:59` — the ONE place `.logout(Customizer.withDefaults())` is wired (per AppToolbar sidecar dependencies); plus `LDAPSecurityConfiguration.java:146`; OAUTH2 uses a custom `LogoutSuccessHandler` chain. DISABLED is the OUTLIER.
- The AppInfoMenu sidecar adds the version-disclosure dimension: under DISABLED, the App Info menu reachable via hover surfaces the deployed `projectVersion` (from BuildProperties via `/api/appInfo`) to anonymous viewers. The UI MULTIPLIES the disclosure surface that AppInfoController already provides at the API layer.

### New operator-impact dimensions surfaced

1. **UX-VISIBLE LSN-CLASS DEFECT**: under the default `auth.type=DISABLED` deployment, every anonymous network caller reaching the SPA sees themselves rendered as **"admin"** in the top-right corner. The toolbar surfaces NO warning, NO banner, NO indicator that the deployment is unauthenticated. An operator (or an attacker) viewing the SPA sees the same UI an authenticated administrator would — silent operator-trap; the LSN-001/002 class at the UI surface.
2. **LOGOUT-IS-BROKEN UNDER DISABLED**: clicking the Logout button (which is always rendered in the user menu, regardless of auth mode) produces a 404 under DISABLED. The operator must back out of the 404 page. No graceful fallback ("you are not logged in"); no informative message. Silent UX defect.
3. **VERSION-DISCLOSURE COMPOUND**: under DISABLED, hovering the information icon in the toolbar surfaces the deployed `projectVersion` to anonymous viewers — operator-fingerprinting + version-leakage via the SPA chrome, not just via `/api/appInfo` curl.

### Triangulation update

DOC-GAP-185 was originally surfaced by 1 sidecar (AppToolbar component-tier — batch Q). Batch ZJ adds 3 new sidecars to the surfaced_by chain: AppToolbar UI-shell widget tier (fresh enrichment), AppInfoMenu UI-shell widget tier, ToolbarTabs UI-shell widget tier. **Coverage: 1 → 4 sidecars.** All four primary sources independently confirm the same load-bearing convention (SPA shell mounts unconditionally; `owner?.name ?? identity?.username` fallback; hardcoded `/logout` redirect; no in-UI auth-mode signaling).

### Proposed doc action update

The original DOC-GAP-185 proposed doc action (3-part — new "SPA auth UX" section + per-mode cross-links + optional code-side defence-in-depth) STILL APPLIES; batch ZJ adds two specific sub-bullets to the "How logout works" section:

- "**Logout under `auth.type=DISABLED` produces a 404.** The platform's default deployment mode renders a Logout button (since the SPA chrome is auth-mode-blind) but the backend has no `/logout` handler under DISABLED. Operators deploying with DISABLED should either (a) remove the Logout affordance from the user menu via an authoring change, OR (b) accept the cosmetic UX defect (the Logout button leads to a 404; users back out). The first option is preferred for production but requires a small code-side change; the second is the default behaviour as of `feature/ontology-finalize-2026-05-25`."
- "**Username under DISABLED renders the literal string 'admin'.** The platform's `IdentityController.whoami` endpoint returns a `dummyOwner` with `username='admin'` and `owner=null` under DISABLED, which the SPA's `AppToolbar.tsx:74` resolves to the literal 'admin'. The user-menu cluster surfaces this name to every anonymous caller — making the deployment visually indistinguishable from a properly-authenticated 'admin' session. **Use `auth.type=DISABLED` for development and testing only**; production deployments should switch to LOGIN_FORM / OAUTH2 / LDAP."

### Cross-references update

Add to existing DOC-GAP-185 cross-references:
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — this finding's "SPA auth UX" section belongs in the new UI-shell page
- **DOC-GAP-311 NEW** (AppErrorPage scope vs blank-page fall-through) — sibling — clicking Logout under DISABLED hits a 404 (which is one path) but the 404 IS a blank-page case under the current Spring-Security default chain; the AppErrorPage catch-all fix in DOC-GAP-311 would also catch the Logout-404 case if it routed through the SPA
- **DOC-GAP-285** (odd.links tabnabbing) — sibling AppInfoMenu surface; both findings affect the same widget

### Severity update

Severity remains **MEDIUM** — the four-sidecar triangulation confirms the original assessment. The batch ZJ surface widening (3 new operator-impact dimensions) does NOT push to HIGH because no security boundary is bypassed BY THE SPA itself (the boundary is at the backend `IdentityController` + `DisabledAuthSecurityConfiguration`); the SPA is the channel through which the disclosure happens. Severity is MEDIUM, not LOW, because: (a) the failure modes are operator-trap class (LSN-001/002) — operators following the docs trusting the chrome to be reliable produce broken UX paths; (b) the gap is operator-facing on EVERY SPA mount (the 'admin' literal renders on every page under DISABLED, the Logout button is in the user menu on every page); (c) the fix is bounded — a single new UI-shell doc page (DOC-GAP-307 NEW) + the proposed three sub-sections close the documentation gap.

---

**Batch ZJ contribution**: 3 NEW PRIMARY SOURCES + 3 NEW operator-impact dimensions; coverage 1 → 4 sidecars; severity unchanged (MEDIUM); proposed doc action extended with two sub-bullets in the "How logout works" section.
