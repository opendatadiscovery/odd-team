---
id: docs/coverage/undocumented-features
target_repo: documentation (local: ../documentation) + odd-platform (local)
scope: Platform features with no documentation
estimated_items: 10-30
chunking: Can likely fit in one session (enumerate features from routes + API)
depends_on: []
priority: medium
---

## Purpose

Identify platform features that have no corresponding documentation page or section in the documentation repo.

## Method

Enumeration must run **all** of the following axes. Route + controller + OpenAPI axes alone are blind to cross-cutting capabilities (the i18n-class miss; see `retrospectives/LSN-013-research-punted-on-substrate-draft.md` and `adrs/drafts/code-lineage-substrate.md`):

1. **UI routes axis** — `odd-platform-ui/src/routes/` (each route = potential feature).
2. **Controllers / OpenAPI axis** — REST controllers + top-level OpenAPI endpoint groups in `odd-platform-specification/openapi.yaml`.
3. **Menu / Management axis** — Menu items in UI components; Management pages in `odd-platform-ui/src/components/Management/`.
4. **UI shell axis (added 2026-05-08 — closes the i18n class)** — Cross-cutting client-side capabilities not reachable from a route:
   - `odd-platform-ui/src/locales/` (i18n bootstrap; translation resources)
   - `odd-platform-ui/src/components/shared/elements/AppToolbar/` (each toolbar widget directory = a separate ui-shell node)
   - `odd-platform-ui/src/theme/` and any `ThemeProvider*` files (theme switching)
   - `odd-platform-ui/src/components/shared/elements/AppErrorPage/` (error-page family: 404, 500, unauthorized)
   - Auth flow files: `auth/`, login pages, OIDC/LDAP/S2S provider UIs (these are not in `routes/`)
   - Any TS file imported directly by `odd-platform-ui/src/index.tsx` is auto-promoted to a ui-shell-bootstrap node.
   - Any `<Component />` mounted inside the AppToolbar's render is auto-promoted to a ui-shell-widget node.
5. **Config-prefixes axis (added 2026-05-08)** — Top-level YAML namespaces in `application.yml` mapped to their `@ConfigurationProperties("<prefix>")` consumer class. Each prefix is a node; cross-reference to docs (does any doc page mention the prefix?).
6. **Cross-reference**: fetch SUMMARY.md from the documentation repo (defines GitBook navigation tree); for each enumerated feature, check whether a doc page exists or is planned.

## Criteria for a Finding

- Feature has UI route but no documentation page (axis 1)
- Feature has OpenAPI endpoints but no API documentation (axis 2)
- Feature appears in platform menu but is not mentioned in docs at all (axis 3)
- **Cross-cutting UI capability with no documentation** — i18n / theme / auth / error pages / toolbar widgets / app-shell bootstraps not appearing in any doc page (axis 4 — the i18n-class fix)
- **Config prefix with no documentation** — a `@ConfigurationProperties` prefix that is not mentioned in any deployment / configuration doc page (axis 5)
- Feature has been added in recent releases (check git log) with no doc update

## Output

Write to: `findings/docs-coverage-undocumented-features/YYYY-MM-DD.md`

Per finding:
- Feature name (as shown in UI or API)
- Evidence of existence (route path, component directory, API endpoint group)
- Whether it's completely undocumented or just missing from certain sections
- Estimated documentation effort (simple page vs. complex multi-section)

## Navigation Update

Discovered features should be added to `navigation/features.yaml` if not already present.
