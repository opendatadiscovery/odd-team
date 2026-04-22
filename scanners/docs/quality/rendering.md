---
id: docs/quality/rendering
target_repo: documentation (local: ../documentation) + docs.opendatadiscovery.org (live site)
scope: Rendered-output quality on the live docs site — broken links, orphaned pages, sidebar drift, GitBook shortcut fallbacks
estimated_items: equal to count of .md files under docs/
chunking: 20 pages per session (WebFetch-heavy)
depends_on: []
priority: high
---

## Purpose

All other `docs/*` scanners read raw markdown. This scanner reads the **published site** and detects issues that only appear after GitBook's build step — broken link resolution, orphaned pages, sidebar drift, and GitBook-shortcut fallbacks that silently degrade into raw GitHub URLs.

Motivating incident: on 2026-04-22 the S2S index link (`[s2s.md](s2s.md "mention")`) rendered on the live site as a `github.com/.../blob/main/...` URL even after the target page and SUMMARY.md entry were both merged. No source-markdown scanner would have caught this — the markdown was syntactically valid and mirrored existing working entries. Only the rendered output revealed the defect.

## MANDATORY pre-scan step

Same as every docs scan:

```bash
git -C ../documentation fetch origin main
git -C ../documentation checkout origin/main
```

Additionally, confirm the live site has rebuilt since the most recent `main` commit (GitBook builds within a few minutes of push). If the latest `main` commit is not yet reflected on the site, wait or record a "build lag" note in findings.

## Method

1. **Enumerate pages** — read `docs/SUMMARY.md` and walk every page entry; also walk `docs/` for `.md` files. The union produces:
   - pages in SUMMARY only → shouldn't happen (stale SUMMARY)
   - pages in docs only → orphans (not in navigation)
   - pages in both → in scope for per-page checks

2. **Per-page checks** (WebFetch each live URL):
   - Page loads with HTTP 200 and a title matching the source
   - No `github.com/opendatadiscovery/documentation/blob/` substrings appear in the body (GitBook fallback signature)
   - For each `[text](target.md "mention")` instance in the source, the rendered page contains an internal `docs.opendatadiscovery.org/...` anchor, not a GitHub URL
   - For each `[text](path.md)` relative link in the source, the rendered href resolves to a docs.opendatadiscovery.org URL (not to a 404 page, not to GitHub)
   - All headings from the source appear rendered as headings (not as escaped text)
   - Anchor targets referenced within the page (`#id-...`) exist in the rendered output

3. **Site-wide checks** (once per run, not per page):
   - Every `.md` file under `docs/` is referenced by `SUMMARY.md` (direct or nested). Orphans = pages reachable only by explicit URL, invisible in the sidebar.
   - Every `SUMMARY.md` entry points to an existing file.
   - Sidebar count of entries under each section matches the number of files under the corresponding directory in `docs/`.

4. **URL mapping** — the live URL for a source file at `docs/a/b/c.md` is `https://docs.opendatadiscovery.org/a/b/c` (no `.md`, `README.md` collapses to the directory URL). Verify this assumption against one known page before the batch.

## Criteria for a Finding

- A live page renders a GitHub raw URL where a relative link was intended (GitBook `mention` fallback)
- A `.md` file exists in the repo but has no SUMMARY.md entry (orphaned page)
- A SUMMARY.md entry points to a file that doesn't exist (dead sidebar entry)
- A relative link in the source resolves to a 404 or to GitHub on the live site
- A heading in the source renders as escaped text (GitBook parser confusion)
- A page's live title diverges from its source H1 without an obvious reason

## Severity Guidance

- **Critical** — user-visible broken link or page that 404s from the sidebar
- **High** — GitBook fallback to GitHub URL on a frequently-linked index page; orphaned page containing important content
- **Medium** — orphaned utility page; minor rendering glitch that doesn't break navigation
- **Low** — cosmetic (casing drift between source H1 and rendered title)

## Output

Write to: `findings/docs-quality-rendering/YYYY-MM-DD.md`

Per finding, include both the source location AND the rendered artifact:

```
### F-NNN: {short title}
- **Source**: docs/path/to/page.md, line N — `[text](target.md "mention")`
- **Live URL**: https://docs.opendatadiscovery.org/path/to/page
- **Rendered as**: `https://github.com/.../blob/main/docs/.../target.md` (raw fallback)
- **Expected**: internal link to https://docs.opendatadiscovery.org/.../target
- **Severity**: high
- **Suggested fix**: replace `"mention"` shortcut with plain markdown link `[Title](target.md)`
```

## Known GitBook Failure Modes (aide-mémoire)

- Hand-authored `"mention"` shortcut → fallback to GitHub raw URL. Always flag; fix by converting to plain markdown link.
- Page added in one PR, SUMMARY.md entry in a follow-up PR → orphaned at first publish, fallback can be cached. Flag if the git log shows separation.
- Relative link across directory levels (`../foo/bar.md`) → sometimes resolves to GitHub; verify per-case.
- `README.md` files act as section landings — their URL is the parent directory, not `/README`.

## Relationship to Other Scanners

- `docs/accuracy/*` reads source markdown only; this scanner catches what they can't.
- `docs/coverage/undocumented-features` may flag a feature as undocumented when a page exists but is orphaned from SUMMARY.md; this scanner would confirm the orphan and narrow the finding.
- `navigation/feature-entry-points` consumes docs URLs; this scanner's site-wide check guards against those URLs going stale.
