# SHB-150 — App Info menu opens five external links in new tabs without rel='noopener noreferrer'

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

When operators click any of the four hardcoded App Info menu items (Documentation, Slack, ODD Platform version GitHub link, Leave Feedback) OR any operator-configured `odd.links[]` entry, the destination page receives a `window.opener` handle that can navigate the original ODD Platform tab to an attacker-controlled URL via `window.opener.location = 'https://phishing.example'`. Every link in the App Info menu uses `<Link target='_blank'>` from react-router-dom WITHOUT setting `rel='noopener noreferrer'`. The operator-configured entries are the broadest attack surface (a less-trusted role with config-edit access can weaponise); the four hardcoded targets (docs/slack/github/producthunt) are first-party-trusted but inherit the same window.opener leak as a defence-in-depth gap.

## Evidence

- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:41` — github link: `<Link target='_blank' to={githubLink}>` no rel.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:61` — operator-configured link: `<Link target='_blank' to={link.url} key={link.url}>` no rel.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:95, 103, 112` — gitbook / slack / feedback hardcoded links: same shape, no rel.
- F-035 (Operator-Configured Additional Links) already enumerates the tabnabbing facet for the operator-link surface; THIS thread extends it to the four hardcoded surfaces and is the ENRICHER for F-035.

## Notes

- Modern Chrome and Firefox (since 2020) auto-imply `rel='noopener'` on `target='_blank'` for top-level navigations — defence-in-depth depends on browser version, not the app.
- The operator-configured link surface is also XSS-vector-shaped — `javascript:` URLs are stripped by React 17+'s attribute sanitiser, but `data:text/html` URIs pass through. F-035 covers this.
- The single counter-example in the codebase: `LinkAttachment.tsx:25` uses raw `<a>` WITH `rel='noreferrer'` — proves the team knows the pattern; the AppInfoMenu is the regression site.
- Operator-configured link URLs MAY include internal-network URLs (wiki, runbook, Grafana); under `auth.type=DISABLED`, these URLs become discoverable to anonymous viewers via the rendered DOM's `<a href>` attributes — info-disclosure side of the surface.

## Next

1. Add `rel='noopener noreferrer'` to all five `<Link target='_blank'>` sites in AppInfoMenu.tsx — one-line per site, total ~5 lines.
2. Promote: merge as ENRICHER into F-035 (cite F-035.observed_vs_expected.facets[0] explicitly).
3. Probe (P-173 already in flight per AppInfoMenu sidecar): verify rel-noopener absence + URL-scheme sanitisation behaviour for javascript: / data: under React's runtime sanitiser.

## Links

- cluster_with: [F-035]
- merged_into: (set when graduated)
- supersedes: []
