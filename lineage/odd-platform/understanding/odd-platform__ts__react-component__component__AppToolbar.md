---
node_id: "odd-platform ts react-component component:AppToolbar"
node_kind: react-component
axis: ui_shell
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-Q
substitution_note: |
  Originally requested target was `LoginForm` — PHANTOM node. There is no
  LoginForm React component anywhere in `odd-platform-ui/src` (verified via
  Grep for `login|Login` returning zero UI matches in batch Q). The platform's
  `LOGIN_FORM` auth mode renders Spring Security's framework-default form
  (`formLogin(formLoginSpec -> formLoginSpec.authenticationSuccessHandler(authHandler))`
  in LoginFormSecurityConfiguration.java:58) and the `LDAP` mode renders
  `formLogin(Customizer.withDefaults())` (LDAPSecurityConfiguration.java:147)
  — i.e. the LOGIN_FORM/LDAP login UI is FRAMEWORK-RENDERED, not application-
  authored React. The `OAUTH2` mode redirects to the provider's hosted login
  page; the `DISABLED` mode skips login entirely. The substitute target
  AppToolbar is the ACTUAL user-facing auth surface in the SPA: it shows the
  authenticated-user identifier and exposes the logout affordance. Recording
  the "UI has NO local-login-form React component" as an invariant.
---

# AppToolbar (UI shell, primary auth-affordance surface) — semantic understanding

## understanding

`AppToolbar` is the persistent top-of-viewport fixed-position bar rendered by
the SPA shell on every authenticated route (mounted unconditionally by
`App.tsx:56` ahead of the `<Routes>` block). It carries three responsibilities:
brand / logo + product name + home link, a `<ToolbarTabs>` row exposing the
nine top-level navigation tabs (Catalog / Directory / Data Quality / Data
Modelling / Master Data / Management / Dictionary / Alerts / Activity), and
the right-side actions cluster — `<AppInfoMenu>` (external links + version),
a clickable user-identifier label, and a popup menu containing
`<SelectLanguage>` and a `Logout` item that performs an unconditional
client-side navigation to the backend `/logout` URL. In the platform's
OIDC-redirect-only / OAuth2-only user-facing login model (no local login
form is authored in this SPA), `AppToolbar` IS the SPA's primary auth UI
surface: it tells the operator who they are signed in as and how to sign out.

## concepts

- entities:
  - AssociatedOwner (the redux-store object loaded by `fetchIdentity` thunk via `identityApi.whoami()` — App.tsx:48; consumed here as `{ identity, owner }`)
  - Identity (per `components.yaml:131-139` — fields `username` required + `permissions` array; NO `provider` field)
  - Owner (the catalog-side Owner entity, optional binding to the Identity via the user-owner mapping)
  - Language preference (`i18next` instance value rendered via `LANGUAGES_MAP[i18n.language as Lang]`)
- operations:
  - Render user-identifier label (`owner?.name ?? identity?.username` — AppToolbar.tsx:74)
  - Open profile-menu popup (`handleProfileMenuOpen` — AppToolbar.tsx:27-29)
  - Logout — unconditional client-side navigation (`window.location.href = '/logout'` — AppToolbar.tsx:35-37)
  - Show language switcher + persist new language choice (delegated to `<SelectLanguage>`)
  - Render navigation tabs (delegated to `<ToolbarTabs>`)
  - Render external-links + version menu (delegated to `<AppInfoMenu>`)
  - Scroll-triggered elevation effect (purely visual; `useScrollTrigger` + `elevation` state)
- invariants:
  - "UI has NO local login form" — no React component authored in `odd-platform-ui/src` renders a username/password form; LOGIN_FORM/LDAP login UI is rendered by Spring Security's framework default (LoginFormSecurityConfiguration.java:58 + LDAPSecurityConfiguration.java:147). Operator-facing implication: every operator interaction with login style is governed by the backend's `auth.type` knob, not by SPA code.
  - "User-identifier display prefers Owner name over Identity username" — `owner?.name ?? identity?.username` (line 74). When a user-owner mapping exists, the Owner display name shadows the OIDC/LDAP username; when no mapping exists, the raw username from the auth provider is exposed.
  - "Logout is always a top-of-window navigation, never a fetch" — `window.location.href = '/logout'` (line 36) forces a full-page navigation. This is the correct shape for OIDC end-session flows (the backend's logout-success-handler chain may redirect to the provider's `end_session_endpoint`), but it bypasses any client-side state cleanup before navigation.
  - "Toolbar is rendered unconditionally regardless of auth state" — `App.tsx:56` mounts `<AppToolbar />` outside any auth-state gate; under `auth.type=DISABLED` the backend permits all exchanges (DisabledAuthSecurityConfiguration.java:16) and `whoami` returns whatever the AuthIdentityProvider yields. There is no SPA-side "unauthenticated state" branch.
- audiences:
  - odd-platform-ui-end-user (every authenticated route receives this bar)
  - platform-operator (the logout affordance is the primary recovery path on auth-mode misconfiguration)

## dependencies_semantic

- requires-feature:
  - P-09:F-006 RBAC authorization model — the toolbar reads but does not gate by Identity.permissions; tab visibility in `<ToolbarTabs>` is NOT permission-gated (ToolbarTabs.tsx:34-82 enumerates ALL nine tabs unconditionally, no permission predicate on render)
  - P-09:F-001 UI authentication (the 4-mode surface) — the toolbar depends on whichever auth chain is active (DISABLED/LOGIN_FORM/OAUTH2/LDAP) populating the redux `profile.owner.identity.username` via `fetchIdentity` (App.tsx:48)
  - P-09:F-002 Principal-to-Owner Resolution (F-011) — `owner?.name ?? identity?.username` is the client-side render of the principal-to-owner resolution result; when the user-owner mapping is empty, the UI exposes the raw OIDC/LDAP username
- requires-config:
  - `auth.type` (indirectly — determines what string ends up in `identity.username`; LOGIN_FORM populates from the form field, OAUTH2 from the OIDC `preferred_username` / sub claim depending on provider mapping, LDAP from the bound DN's username attribute, DISABLED from whatever default the AuthIdentityProvider yields)
- requires-runtime:
  - `identityApi.whoami()` returning successfully on app mount (App.tsx:48; failures are swallowed by `.catch(() => {})` — silent identity-load failure leaves both `identity` and `owner` null in the redux store, in which case the UserName label renders as empty)
  - i18next initialised (`useTranslation` — AppToolbar.tsx:19) + `LANGUAGES_MAP` lookup for the active language (AppToolbar.tsx:48)
  - Material-UI theme provider mounted ancestor-wise (`useScrollTrigger`, `<Grid>`, `<Box>`, `<Typography>` all depend on theme context)
- depends-on (file-level):
  - `redux/selectors/profile.selectors.ts` (`getIdentity`, `getOwnership` — AppToolbar.tsx:4)
  - `components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx` (the nine-tab navigator)
  - `components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx` (info menu — docs/Slack/GitHub/version/feedback/links)
  - `components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx`
  - `components/shared/elements/AppMenu/AppMenu.tsx`, `AppMenuItem/AppMenuItem.tsx`
  - `redux/lib/unauthenticatedMiddleware.ts` (cross-cutting — reloads the SPA on any 401 response payload; pairs with the toolbar's identity-bound rendering)

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - User-identifier rendering precedence (`owner.name` shadowing `identity.username`) is not unit-tested; a future regression that flips the precedence would not be caught
  - Logout navigation target (`/logout`) is not tested — a refactor that changes the URL or adds a query parameter would slip through
  - Behaviour when both `identity` and `owner` are null (e.g. silent `fetchIdentity` failure caught by `.catch(() => {})` at App.tsx:48) is not tested — the UserName label silently renders as empty, no fallback string
  - DISABLED-mode rendering (when `whoami` returns a synthetic identity with no provider context) is not exercised
  - Scroll-triggered elevation behaviour is not tested
- test_files: []
- gaps: |
    No `AppToolbar.test.tsx` exists in `odd-platform-ui/src` (verified by Glob
    for `**/AppToolbar*.test.*` returning zero matches). The component is the
    single user-facing auth UI in the SPA — sign-in state, sign-out path, and
    identifier display all flow through here — and has ZERO unit coverage.
    The most likely undetected regression class is a refactor that silently
    changes the user-identifier precedence or the logout URL; either would
    ship without test signal. Cross-link: `<ToolbarTabs>` likewise has no test
    file; the absence of permission-gating on tab render (see security
    section) would not be detectable from tests today even if it were
    introduced as a regression.

## docs_link_semantic

- declared_docs: []
- inferred_docs: []
- doc_drift_findings:
  - "No public-docs page describes the SPA's logout affordance or its routing target. Operators configuring OAuth2 logout (with the Cognito / Azure / Google / ODD-IAM provider quirks recorded by batch O / F-011 drift_class entries `azure_logout_npe_no_token_revoke_local_only` and `cognito_logout_silent_no_op_on_empty_uri`) cannot tell from docs that the toolbar's Logout button is a plain `window.location.href = '/logout'` and that the IdP-side end-session behaviour is entirely backend-handler-controlled. This is a separately-trackable DOC-NNN follow-up for the doc-gap-finder reducer."
  - "Live URL verification for `https://docs.opendatadiscovery.org/` was not performed this session — the toolbar's `<AppInfoMenu>` hardcodes `https://docs.opendatadiscovery.org/` as the GitBook link (AppInfoMenu.tsx:20); pending-WebFetch-session per system-mission.md frontmatter convention."

## implicit_adrs

- "Render the navigation toolbar unconditionally — there is no 'unauthenticated state' branch in the SPA shell." — evidence: App.tsx:54-93 (the `<AppToolbar />` mount has no auth predicate); reinforced by DisabledAuthSecurityConfiguration.java:13-18 where the backend permits all exchanges in DISABLED mode — intent_anchor: "App.tsx mounts `<AppToolbar />` outside `<Routes>` and outside any auth-state gate; the convention is paired with `redux/lib/unauthenticatedMiddleware.ts` which reloads the page on any 401 payload (lines 3-9), i.e. the convention is 'if a request fails auth, hard-reload — there is no SPA-side reauth dialog'" — confidence: HIGH

- "User-identifier display prefers the catalog-side Owner name over the auth-provider username — provider identity is the fallback, not the primary display." — evidence: AppToolbar.tsx:74 (`{owner?.name ?? identity?.username}`); same precedence applied in 5 other UI locations (ActivityItem.tsx:184, ActivityItem.tsx:77, DataEntityAlertItem.tsx:60, AlertItem.tsx:86, ActiveAssociationRequest.tsx:65-67) — intent_anchor: "the convention is consistently applied across 6 UI locations using the same `owner?.name ?? identity?.username` (or `||`) pattern — that's an intentional display convention, not a one-off; the catalog identity is preferred for human-readability and the auth-provider username is the fallback for users with no user-owner mapping" — confidence: HIGH

- "Logout is a full-page navigation (`window.location.href`), not a fetch + state cleanup — defer logout sequencing entirely to the backend handler chain." — evidence: AppToolbar.tsx:35-37 (`window.location.href = '/logout'`); paired with OAuthSecurityConfiguration.java:100 wiring `logoutSuccessHandler(logoutHandler)` and the seven handler classes in `org.opendatadiscovery.oddplatform.auth.logout.*` — intent_anchor: "the convention `window.location.href = '/logout'` (rather than a Redux `dispatch(logout())` action followed by a navigation) places ALL session-termination logic — local cookie clearing, OIDC end-session redirect, provider-specific logout URI assembly — on the backend's LogoutSuccessHandler chain; the SPA does not attempt to participate in revocation, it simply hands off" — confidence: HIGH

## bugs_limitations_corner_cases

- "Navigation tabs are rendered unconditionally with NO permission gating — every authenticated user sees every tab including `Management`." — evidence: ToolbarTabs.tsx:34-82 (no `useAppSelector(getGlobalPermissions)` predicate around any `tabs` entry; all 9 tabs always present) — severity: MEDIUM. The downstream Management UI is permission-gated at the page level (e.g. `WithPermissionsProvider` wraps `<LookupTables>` in App.tsx:78-87), but the TAB itself is visible to every authenticated user. Operators inspecting the bar will see a `Management` tab regardless of whether they have any `*_MANAGE` permission; clicking through yields a permission-denied affordance on the page, not a hidden-tab UX. This is consistent with the read-collaborative posture catalogued in `concepts/index.yaml` (REFACTOR-024, REFACTOR-203, REFACTOR-201 cross-pillar reads bypass per-owner scoping) but operator-facing visibility may surprise.

- "Silent identity-fetch failure renders an EMPTY username label, with no fallback or error indication." — evidence: App.tsx:48 (`dispatch(fetchIdentity()).catch(() => {})` swallows any error including 401, 403, 404, 5xx); AppToolbar.tsx:74 (`{owner?.name ?? identity?.username}` with both null evaluates to empty string within `<S.UserName>`). Coupled with unauthenticatedMiddleware.ts:5 (`window.location.reload()` on 401 payload) — under a 401 path the SPA reloads. Under any non-401 failure (network glitch, 5xx) the toolbar renders an empty-name affordance with the dropdown chevron — severity: LOW (operator-noticeable but not a security gap)

- "Logout button has no confirmation prompt — single accidental click signs the user out." — evidence: AppToolbar.tsx:117 (`<AppMenuItem onClick={handleLogout}>{t('Logout')}</AppMenuItem>` — no intermediate confirmation modal) — severity: LOW (UX concern only; recovery is to log in again)

- "Logout under DISABLED mode is undefined — `auth.type=DISABLED` skips the SecurityWebFilterChain logout wiring, so `GET /logout` falls through to no handler." — evidence: DisabledAuthSecurityConfiguration.java:14-17 (the chain only registers `.csrf().disable()` + `.authorizeExchange().anyExchange().permitAll()`; no `.logout(...)` configuration); operator visibility: clicking Logout in DISABLED mode hits an endpoint with no logout handler → likely returns 404 or the SPA's static index, depending on Spring's fallback handling — severity: LOW (DISABLED is dev-only per docs; production deployments use OAUTH2/LDAP/LOGIN_FORM which all wire logout)

- "Toolbar reads `identity.permissions` but does NOT use them — the data is fetched, stored, and ignored at this surface." — evidence: AppToolbar.tsx imports `getIdentity` (line 4); `identity` is bound (line 20); only `identity?.username` is read (line 74); the `permissions` field on the Identity type (`components.yaml:136-137`) is unused here. — severity: LOW (no behaviour bug; observation worth recording because gated UI affordances would be the natural place to consume this and don't).

## security

- **auth_mode_relevance**: LOGIN_FORM | OAUTH2 | LDAP | DISABLED (all four modes render this component; the component does not branch on mode). For OAUTH2 the user-identifier label may be a `sub` claim, a `preferred_username`, an email, or a provider-specific string depending on the active OAuth2UserAuthority extractor — that variability is owned by the backend's UserDto.username() resolution (IdentityServiceImpl.java:38).

- **ingestion_filter_relevance**: N/A — UI component, not an HTTP surface.

- **authorization_assertions**: [] — the toolbar enforces no permission gates of its own. Identity.permissions are imported via `getIdentity` but never read by this file. Tab visibility (`<ToolbarTabs>`) is also unconditional (see bugs_limitations_corner_cases #1).

- **owner_scoping**: N/A — the toolbar renders the CURRENT user's identity/owner, which is by definition the principal's own resolution result; no cross-owner data exposure happens here.

- **data_exposure**:
  - "Authenticated user's display identifier → any client able to fetch `whoami` (gated by the active auth chain). The displayed string is `owner.name ?? identity.username` — under OAUTH2 with no user-owner mapping, the raw `username` (which may be an email, a sub claim, a provider login name) is exposed in the persistent top bar."
  - "Active language preference is exposed via the language menu (`LANGUAGES_MAP[i18n.language]` — line 48) — non-sensitive."

- **known_security_gaps**:
  - "Management / Alerts / Activity / etc. tabs are rendered to ALL authenticated users regardless of permission set — the `<ToolbarTabs>` enumerator (ToolbarTabs.tsx:34-82) does not consult `getGlobalPermissions`. Operators with zero `*_MANAGE` permissions still see the `Management` tab; clicking through yields a page-level permission denial rather than a hidden-tab UX. This is internally consistent with the platform's read-collaborative posture catalogued in `concepts/index.yaml` but is worth surfacing as a UX concern." — evidence: ToolbarTabs.tsx:34-82 (no permission predicate) — severity: MEDIUM
  - "The user-identifier label exposes the raw auth-provider username (OIDC sub, email, LDAP UID, LOGIN_FORM username) when no user-owner mapping is created — this is reachable by anyone with screen-share / shoulder-surf access to the operator's session. For OAUTH2 deployments where `username` is the operator's email, the toolbar persistently displays the email at the top of every page. This is intended (per the 6-location precedence convention) but operator-visible-PII-by-default may warrant a docs caveat." — evidence: AppToolbar.tsx:74 — severity: LOW
  - "Cross-mode bleed surface from F-011 (`provider_null_cross_mode_bleed_sql_primary_source` drift class): when LOGIN_FORM or LDAP mode is active, `provider` is null in the user_owner_mapping persistence layer (per F-011 evidence). The Identity wire schema (`components.yaml:131-139`) has NO `provider` field at all on Identity — so the toolbar CANNOT render the active provider, and never exposes the `(null)` string for provider on this surface. The cross-mode bleed risk is not visible here; surfaces that DO render provider (AssociatedUser at components.yaml:370-376 — owner-association request flow) need separate scrutiny." — evidence: AppToolbar.tsx:74 reads only `identity?.username`; components.yaml:131-139 Identity has no provider — severity: N/A (not a gap here — recording as cross-reference to F-011 that the toolbar is NOT a leak surface for provider-null)
  - "Logout-button click → `/logout` is identical across all 4 auth modes, but the backend's logout HANDLING is provider-specific and asymmetric (per batch O findings + F-011 drift_class entries `azure_logout_npe_no_token_revoke_local_only` and `cognito_logout_silent_no_op_on_empty_uri`). The SPA has no way to signal to the operator that Azure logout doesn't revoke at the IdP. Backend-side problem, but the front-end's lack of feedback compounds it." — evidence: AppToolbar.tsx:35-37 + OAuthSecurityConfiguration.java:100 (`logoutSuccessHandler(logoutHandler)`) — severity: MEDIUM (operator may believe they've fully logged out when they haven't, especially on shared workstations)

## performance

- **hot_paths**:
  - "`useScrollTrigger` (line 40-44) runs on every scroll event on `window`; combined with the `useEffect` (line 46) that calls `setElevation` — but with `disableHysteresis: true` and `threshold: 10`, the trigger boolean only flips at the threshold so re-renders are bounded. Performance impact is negligible for typical viewport sizes." — evidence: AppToolbar.tsx:40-46
  - "Redux selectors `getIdentity` / `getOwnership` are memoised via `createSelector` (profile.selectors.ts:10-15) — each `useAppSelector` call costs one reference-equality check against the previous selector output per render." — evidence: AppToolbar.tsx:20-21 + profile.selectors.ts:10-15

- **throughput_characteristics**:
  - "Single-render component — no batched / paginated / streaming concerns at this layer."
  - "`whoami` is fetched once on app mount via `App.tsx:48` (`dispatch(fetchIdentity())`); the toolbar consumes the redux-store snapshot — no repeated network calls from this component."

- **resource_allocation**:
  - "Memory: holds three pieces of state — `anchorEl` (DOM ref or null), `elevation` (number), `useScrollTrigger` boolean. All bounded." — evidence: AppToolbar.tsx:24, 39, 40
  - "DOM nodes: fixed-position bar with constant child count; opening the profile menu mounts an `<AppMenu>` portal with 2 `<AppMenuItem>` children. Bounded." — evidence: AppToolbar.tsx:87-118
  - "No outbound HTTP requests from this component — all data comes from the redux store."

- **scaling_characteristics**:
  - "Stateless from the per-user perspective — instances of this component on different users' browsers do not contend; each renders its own user's identity. (Server-side scaling concerns belong to `whoami` / `IdentityServiceImpl` upstream, not here.)"
  - "No pagination concerns — the toolbar is a fixed-size shell."

- **known_performance_gaps**: []
  - N/A — UI shell component with bounded state and no hot loops.

## sources

- understanding ← AppToolbar.tsx:1-123 + App.tsx:56 (mount site) + ToolbarTabs.tsx:34-82 (the 9 nav tabs) + AppInfoMenu.tsx:1-127 (right-side info menu)
- concepts.entities.AssociatedOwner ← App.tsx:48 + profile.thunks.ts:6-10 + components.yaml:141-152
- concepts.entities.Identity ← components.yaml:131-139 (NO provider field on Identity)
- concepts.invariants.UI-has-NO-local-login-form ← Grep for `login|Login` in `odd-platform-ui/src` returned ZERO matches + LoginFormSecurityConfiguration.java:58 (framework default) + LDAPSecurityConfiguration.java:147 (framework default)
- concepts.invariants.user-identifier-precedence ← AppToolbar.tsx:74 + 5 cross-component matches in ActivityItem.tsx / DataEntityAlertItem.tsx / AlertItem.tsx / ActiveAssociationRequest.tsx
- concepts.invariants.logout-is-full-page-navigation ← AppToolbar.tsx:35-37
- concepts.invariants.toolbar-unconditional-mount ← App.tsx:54-93 + DisabledAuthSecurityConfiguration.java:13-18
- dependencies_semantic.requires-feature.P-09:F-006 ← AppToolbar.tsx:20 + ToolbarTabs.tsx:34-82 (permissions read but not used)
- dependencies_semantic.requires-feature.P-09:F-002 ← F-011.yaml + AppToolbar.tsx:74 (the precedence expression IS the client render of the principal-to-owner resolution)
- dependencies_semantic.requires-runtime.whoami ← App.tsx:48 + profile.thunks.ts:6-10
- tests_coverage_semantic.gaps ← Glob `**/AppToolbar*.test.*` returned ZERO matches
- docs_link_semantic.doc_drift_findings.[0] ← batch-O F-011 drift_class entries `azure_logout_npe_no_token_revoke_local_only` + `cognito_logout_silent_no_op_on_empty_uri` (F-011.yaml lines 22-23)
- implicit_adrs.[0] (unconditional mount) ← App.tsx:54-93 + DisabledAuthSecurityConfiguration.java:13-18 + unauthenticatedMiddleware.ts:3-9
- implicit_adrs.[1] (owner-name-precedence convention) ← AppToolbar.tsx:74 + ActivityItem.tsx:184 + ActivityItem.tsx:77 + DataEntityAlertItem.tsx:60 + AlertItem.tsx:86 + ActiveAssociationRequest.tsx:65-67
- implicit_adrs.[2] (logout = full-page navigation) ← AppToolbar.tsx:35-37 + OAuthSecurityConfiguration.java:100 + `org.opendatadiscovery.oddplatform.auth.logout.*` (7 handler classes)
- bugs_limitations_corner_cases.[0] (no permission gating on tabs) ← ToolbarTabs.tsx:34-82 (no `getGlobalPermissions` consumer)
- bugs_limitations_corner_cases.[1] (silent fetchIdentity failure) ← App.tsx:48 (`.catch(() => {})`) + AppToolbar.tsx:74
- bugs_limitations_corner_cases.[2] (no logout confirmation) ← AppToolbar.tsx:117
- bugs_limitations_corner_cases.[3] (logout under DISABLED undefined) ← DisabledAuthSecurityConfiguration.java:14-17 + AppToolbar.tsx:35-37
- bugs_limitations_corner_cases.[4] (identity.permissions read but unused) ← AppToolbar.tsx:4, 20, 74
- security.auth_mode_relevance ← AppToolbar.tsx:1-123 (no mode branch) + DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:30-64 + LDAPSecurityConfiguration.java:135-153 + OAuthSecurityConfiguration.java:97-100
- security.data_exposure.[0] ← AppToolbar.tsx:74
- security.known_security_gaps.[0] (tab visibility) ← ToolbarTabs.tsx:34-82
- security.known_security_gaps.[1] (raw username exposure when no owner mapping) ← AppToolbar.tsx:74
- security.known_security_gaps.[2] (cross-mode bleed not visible here) ← components.yaml:131-139 (Identity has no provider) + F-011.yaml
- security.known_security_gaps.[3] (logout asymmetry across providers) ← AppToolbar.tsx:35-37 + F-011.yaml:22-23
- performance.hot_paths.[0] ← AppToolbar.tsx:40-46
- performance.hot_paths.[1] ← AppToolbar.tsx:20-21 + profile.selectors.ts:10-15

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of test files was verified by Glob)
- docs_link_semantic: MEDIUM (no declared docs; live-URL verification deferred per system-mission.md convention)
- implicit_adrs: HIGH (all three ADRs have multi-file evidence + cross-component intent anchors)
- bugs_limitations_corner_cases: HIGH (all five observations have direct file:line evidence)
- security: HIGH (per-file signals are well-anchored; aggregated picture for "did the whole feature defend properly" is concept-merger's job)
- performance: HIGH

## Coherence assessment (LSN-018 Rule 6 pre-emit)

Cross-checked against existing artefacts:

- F-011 (P-09:F-002 Principal-to-Owner Resolution): STRENGTHENS — this sidecar adds the UI-side render of the principal-to-owner result (AppToolbar.tsx:74 `owner?.name ?? identity?.username`) and confirms the same precedence is used in 5 OTHER components (cross-component convention not previously catalogued at the SPA layer). No contradiction with F-011's persistence-layer truths.
- F-019 (P-08:F-003 Owner Lifecycle Management): STRENGTHENS — this sidecar's "Management tab rendered to ALL authenticated users" observation aligns with F-019's `per_owner_authorization_scoping_absent_global_owner_crud_permission` drift class entry (line 20). UI-side evidence that the absence is also UX-visible.
- Batch-O AzureLogoutSuccessHandler / CognitoLogoutSuccessHandler asymmetry: STRENGTHENS — this sidecar records that the SPA-side click handler is identical across all 4 auth modes (`window.location.href = '/logout'`), confirming that the asymmetry is entirely backend-handler-controlled and that the SPA provides no operator feedback about the difference. No contradiction.
- system-mission.md P-09 Security & Access Control pillar invariants: STRENGTHENS — adds a UI-shell observation supporting the read-collaborative posture (tabs unconditionally rendered) and confirms the "two independent authentication surfaces" doc-anchored invariant is NOT visible from this surface (the toolbar treats all 4 UI auth modes identically).
- LSN-018 reducer-contradiction concern: N/A — this is a fresh sidecar, no prior artefact to contradict.

Strengthens=4 · Supersedes=0 · Conflicts_surfaced=0 · Net new methodology finding: "UI has NO local login form" recorded as an invariant (resolves the original phantom-LoginForm target).

## Maintainer notes
