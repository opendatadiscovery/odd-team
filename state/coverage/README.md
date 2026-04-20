# Coverage Manifests

Track what has been scanned vs. what remains. One manifest per scanner.

## Problem Solved

Scanners can't fit their full scope in one session. Between sessions there's no memory. Without coverage tracking, we either re-scan (wasting tokens) or miss items (leaving gaps).

## How It Works

1. **Enumerate** — Before first scan, list ALL items in scope (files, pages, adapters, etc.)
2. **Scan** — Each session picks unscanned items from the manifest, scans them, marks them done
3. **Re-enumerate** — Periodically re-run enumeration to catch new additions since last full scan

## Manifest Format

```yaml
scanner_id: tests/collectors-adapters
scope_description: "All adapter directories across 4 collector packages"
scope_glob: "{odd-collector,odd-collector-aws,odd-collector-azure,odd-collector-gcp}/adapters/*/adapter.py"
target_repo: ../odd-collectors
repo_commit_at_enumeration: abc123f
last_enumerated: 2026-04-20
total_items: 43
scanned_items: 10
coverage_pct: 23

items:
  - path: odd-collector/adapters/postgresql
    status: scanned          # not-scanned | scanned | changed-since-scan | new
    scanned_date: 2026-04-20
    scanned_commit: abc123f  # repo commit at time of scan
    findings_ref: findings/tests-collectors-adapters/2026-04-20-batch-1.md

  - path: odd-collector/adapters/mysql
    status: not-scanned

  - path: odd-collector/adapters/snowflake
    status: changed-since-scan  # file modified after scan date
    scanned_date: 2026-04-18
    scanned_commit: def456a
    changed_commit: ghi789b     # commit that changed it
    findings_ref: findings/tests-collectors-adapters/2026-04-18-batch-1.md
```

## Status Transitions

```
new → not-scanned (after first enumeration acknowledges it)
not-scanned → scanned (after a scan session covers it)
scanned → changed-since-scan (when re-enumeration detects file changed)
changed-since-scan → scanned (after re-scan)
```

## Re-enumeration

Detects drift between manifest and actual repo state:
- New files not in manifest → added with status `new`
- Files in manifest but deleted from repo → marked `deleted`
- Files modified since scan → status changes to `changed-since-scan`

Detection uses: `git log --since={scanned_date} -- {path}`

## Scanner Session Protocol (Updated)

1. Read coverage manifest for this scanner
2. If no manifest exists → run `/enumerate` first
3. Pick next batch of `not-scanned` or `changed-since-scan` items
4. Scan them
5. Update manifest: set status to `scanned`, record date and commit
6. Write findings
7. Report: coverage now X% (Y/Z items)

## Enumeration Sources by Scanner Type

| Scanner | How to enumerate scope |
|---------|----------------------|
| tests/collectors-adapters | Glob: `*/adapters/*/adapter.py` in odd-collectors |
| tests/platform-backend | Glob: `*Service.java`, `*Repository.java` in odd-platform |
| tests/platform-frontend | Glob: `src/components/*/` directories in odd-platform-ui |
| tests/collectors-sdk | Glob: `*.py` in odd-collector-sdk/odd_collector_sdk/ |
| docs/accuracy/* | Fetch SUMMARY.md from odd-docs → list all pages |
| docs/completeness/* | Same as accuracy — per page |
| docs/coverage/* | Compare platform features (from routes/OpenAPI) against doc pages |
| navigation/feature-entry-points | From `navigation/features.yaml` domain list |
| spec/* | Bounded — enumerate models/endpoints from spec files |
