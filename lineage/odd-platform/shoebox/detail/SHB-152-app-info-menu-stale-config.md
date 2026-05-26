# SHB-152 — App Info menu shows stale operator-configured links until full page reload

**Category**: open
**Severity**: LOW

## Hypothesis

Operators editing `odd.links[]` config in YAML and restarting the backend continue to see the OLD link list in any SPA tab that was open before the restart — the new entries appear only after a full page reload (Ctrl-R). The App Info menu uses MUI's `keepMounted` so the menu DOM tree persists for the SPA's lifetime after first hover; combined with `useAppLinks()` having no `staleTime` / `refetchInterval` and no `invalidateQueries('appLinks')` call anywhere in the codebase, the React-Query cache is populated once and never refreshed. The operator's mental model of "I changed the config, the platform UI should reflect it" is silently violated.

## Evidence

- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:90` — MUI Menu has `keepMounted` set; the DOM subtree lives for the SPA's lifetime after first hover.
- `odd-platform-ui/src/lib/hooks/api/appInfo.ts:11-17` — `useAppLinks()` is a plain TanStack Query wrap of `linksApi.getLinks()` under key `['appLinks']`; no `staleTime`, no `refetchInterval`, no auto-refresh.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:17-18` — the hook is called at mount; no manual refetch trigger anywhere.
- Same shape applies to `useAppInfo()` (the project-version display) — version updates after backend redeploy show only on full reload.

## Notes

- The backend's `LinksController` reads from Spring `@ConfigurationProperties` bound at startup — so even on the backend, link edits require restart (per F-035). The UI staleness compounds the backend's boot-time-binding limitation.
- A staleTime: Infinity (or 24h) would be CORRECT given the underlying endpoint IS boot-bound — but it still wouldn't fix the cross-session staleness because keepMounted prevents component remount.
- Operator-impact: an admin who updates a "Runbook" link's URL after the on-call team complains about a stale URL must tell EVERY user to refresh their browser before the new URL takes effect.
- guess: the same staleness shape applies to AppInfo's `projectVersion` (which is fingerprintable per F-009 / REFACTOR-185).

## Next

1. Decide whether to add `staleTime: Infinity` to `useAppInfo` / `useAppLinks` (matches backend boot-binding) and document the "refresh to update" expectation.
2. Decide whether to add `invalidateQueries(['appLinks'])` triggered by an admin action (probably out of scope — would need an admin-facing refresh button).
3. DOC-NNN — `docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` does NOT mention that `odd.links[]` edits require both a backend restart AND a browser refresh.

## Links

- cluster_with: [F-035, F-034]
- merged_into: (open)
- supersedes: []
