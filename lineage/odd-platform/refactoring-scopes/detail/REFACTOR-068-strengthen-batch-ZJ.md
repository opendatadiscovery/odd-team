## STRENGTHENS — Batch ZJ (2026-05-26 — AppInfoMenu UI-layer multiplies the DISABLED-mode anonymous version disclosure to every browser user)

Prior REFACTOR-068 framed the DISABLED-mode anonymous fingerprinting via `/api/appInfo` as an API-layer disclosure (any network attacker hitting curl can read authType + projectVersion). Batch ZJ's AppInfoMenu primary-source sidecar adds the UI-LAYER MULTIPLIER: the same projectVersion is RENDERED INLINE in the App Info popover every time any browser user hovers the information icon — including anonymous viewers under DISABLED who reached the SPA root URL.

**New surfaced_by entry**:
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:bugs_limitations_corner_cases[3]` (MEDIUM) — "The widget renders projectVersion to anonymous viewers when `auth.type=DISABLED`. Under DISABLED, the SPA loads without authentication; AppInfoMenu fires `useAppInfo` against `/api/appInfo` which is permitAll-reachable; the response includes `projectVersion`; the menu renders `<Typography variant='h4'>{appInfo.projectVersion}</Typography>` at line 47. A network attacker hitting the SPA root URL anonymously gets the precise version disclosed in the rendered HTML via the App Info menu. (The version is ALSO disclosed by `/api/appInfo` directly — the UI is the convenient amplifier, not the only exposure.)"

- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:security.known_security_gaps[2]` (MEDIUM) — "Under `auth.type=DISABLED`, an anonymous viewer hovering the SPA's information icon reads the deployment's project version inline (AppInfoMenu.tsx:47) AND every operator-configured URL (AppInfoMenu.tsx:60-66). The UI MULTIPLIES the disclosure surface that AppInfoController + LinksController already provide at the API layer — the version is no longer just visible via curl /api/appInfo, it is visible to any browser user."

**What this strengthening adds**: prior coverage was the API-layer disclosure. Batch ZJ adds the UI-layer amplifier: anyone who can REACH the SPA (i.e. anyone who can curl `/`) can also POINT-AND-CLICK to read the version. The realistic attack surface widens from "network-attacker-with-curl" to "any browser user who knows where the info icon is" — which under DISABLED includes anonymous internal-network callers AND anonymous public-internet callers (if the SPA is exposed).

Additionally, the AppInfoMenu surfaces a SECOND disclosure target via the same widget: operator-configured `odd.links` URLs (which may contain internal-hostname references — wiki URLs, runbook URLs, Grafana URLs) are also rendered to anonymous viewers under DISABLED. The widget's two-data-source nature (useAppInfo + useAppLinks) means the DISABLED disclosure surface is wider than REFACTOR-068 alone captures.

**Triangulation count after ZJ**: 2 sidecars (was 1 — AppInfoController; ZJ adds AppInfoMenu UI-layer primary-source).

**Severity unchanged**: MEDIUM (already noted in the original REFACTOR-068 as HIGH-at-aggregate-level but MEDIUM-in-sidecar).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-185 (DISABLED bypasses SECURITY_RULES — the upstream cluster); REFACTOR-616 (DISABLED-mode wizard registry anonymous read); ADR-CANDIDATE-234 NEW this batch (AppInfoMenu five-surface consolidation — the architectural choice that aggregates the disclosure into one popover).
- SUPERSEDES: none.
- CONFLICTS: none.

---
