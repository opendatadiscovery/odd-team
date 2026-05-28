---
lesson: LSN-028
title: "`: ` inside description: frontmatter value parses as a YAML mapping separator, breaking GitBook sync entirely (worse than truncation — the publisher couldn't import the merged commit at all)"
date: 2026-05-28
gate: /implement step 6.5 + Gate 8 — extends pre-commit + review-time sweeps with a YAML frontmatter parse check
status: closed
---

# Summary

On 2026-05-28 (same session that diagnosed LSN-027), the DOC-280 24-page description-rewrite batch shipped to `origin/main` via PR #73 (merge commit `8d60a2f`). Shortly after merge, GitBook surfaced a sync failure:

> Git Sync failure
> An error was detected while importing recent commits from GitHub, to resume synchronization & merging of change requests please fix the error.
> Failed to parse YAML front matter in "docs/configuration-and-deployment/enable-security/authorization/user-owner-association.md"

PyYAML reproduces the failure precisely:

```
mapping values are not allowed here
  in "<unicode string>", line 2, column 103:
     ...  permissions — three write-paths: self-request, self-request wit ...
                                         ^
```

The DOC-280 rewrite of this page's description was:

```yaml
description: Link a signed-in user to an Owner entity for owner-scoped permissions — three write-paths: self-request, self-request with auto-approve, and admin direct-bind.
```

YAML 1.2 reads `: ` (colon followed by whitespace) in an unquoted plain scalar as a **mapping value indicator** — the second `: ` (after "write-paths") was being parsed as nesting `self-request, ...` under a key `write-paths`, which is not a valid construct in a top-level mapping. The parser bailed out with "mapping values are not allowed here".

**This was worse than the LSN-027 truncation it shipped alongside.** Truncation cut visible text mid-clause but the page still rendered. The YAML parse error stalled GitBook's entire import pipeline — no commits after the broken commit got imported, no merge-request previews ran, the live site was frozen at the prior state until the hotfix landed.

# What I was supposed to do

The DOC-280 implementation went through the new `/implement` step 6.5 mechanical sweeps:
- (a) Gate 11 banned-term grep on staged diff — returned 0 hits
- (b) Description-length check on staged diff — returned 0 hits (every page ≤ 200 bytes)

Both sub-checks passed. But neither check parses the YAML — they treat the description text as a string and check its content, not its parseability. The 24 rewrites included one with a `: ` mid-value; sed wrote the string; bash wrote the file; git committed the file; PR merged; GitBook tried to parse — and only then did the failure surface.

# What actually happened (anti-pattern)

1. The implementer (me) drafted 24 sub-200-char descriptions in plain language. One draft introduced "three write-paths:" — natural-English colon punctuation for an enumeration follow-on, common in English prose.
2. The mechanical sweeps (Gate 11 + length) both passed because they don't model YAML semantics.
3. Pre-commit local rendering doesn't exist; build-time rendering doesn't exist; the only YAML parser in the pipeline is GitBook's, which runs after origin/main accepts the merge.
4. The PR merged. GitBook tried to import the merge commit, hit the parse error, stalled sync entirely.
5. User caught it via the GitBook UI ("Git Sync failure" banner) and reported the file path and the parse-error message verbatim.

This is the same class of miss as LSN-027 — both involve "the live publisher does something to the source manuscript that the maintainer's local tooling doesn't model." LSN-027 was truncation; LSN-028 is YAML parsing. The forcing-function answer is the same: model the publisher's behaviour locally and gate every commit on it.

# What we change

## /implement step 6.5 — gains a third pre-commit sub-check (c) YAML frontmatter parse

The mechanical sweep already runs (a) Gate 11 banned-term grep and (b) description-length check. (c) adds a YAML parse check via PyYAML on every staged docs/**/*.md file's frontmatter. The Python one-liner:

```bash
git diff --staged --name-only -- '../documentation/docs' \
  | grep -E '\.md$' \
  | while read f; do
      python3 - "../documentation/$f" <<'PY'
import yaml, sys
path = sys.argv[1]
txt = open(path).read()
if txt.startswith('---'):
    end = txt.find('---', 3)
    if end != -1:
        try:
            yaml.safe_load(txt[3:end])
        except yaml.YAMLError as e:
            print(f'YAML PARSE FAIL: {path}: ' + str(e).split(chr(10))[0])
            sys.exit(1)
PY
    done
```

Fail the commit if any file's YAML frontmatter does not parse cleanly. Add Python 3 + PyYAML as a soft dependency (universally available; both pre-installed on most maintainer machines).

For the bash-only fast-fail path (catches the most common hazard without Python):

```bash
git diff --staged --name-only -- '../documentation/docs' | grep -E '\.md$' | while read f; do
  desc=$(head -3 "../documentation/$f" 2>/dev/null | grep '^description:' | head -1 | sed 's/^description: //')
  if [ -n "$desc" ]; then
    # Hazard: ": " inside an unquoted YAML scalar reads as a nested mapping separator
    if echo "$desc" | grep -qE ': [a-zA-Z]'; then
      echo "YAML HAZARD ': ' in $f"
      echo "  → $desc"
    fi
  fi
done
```

The bash check is a fast fail-fast for the most common pattern; the Python check is canonical. Use both for defence in depth.

## Gate 8 — same extension (already extended for raw-HTML head + visible-subtitle inspection under LSN-027; now also runs the YAML-parse check during review)

`/review` Gate 8 now runs the PyYAML parse check on every affected docs/**/*.md file (in addition to the raw-HTML head + visible-subtitle inspection). FAIL if any file's frontmatter does not parse. Cite the file path + the PyYAML error line in the verdict.

## Banned hazards reference

Any author writing a `description:` value (or any frontmatter scalar) must avoid:

- `: ` (colon-space) — reads as a mapping separator. Replace with ` — ` or restructure.
- ` #` (space-hash mid-line) — reads as a YAML comment start. Quote the value or remove the `#`.
- Leading `&`, `*`, `!`, `[`, `{`, `?`, `|`, `>`, `'`, `"`, `%` — reserved indicators. Use a different opening word.
- Trailing `:` — mapping ambiguity. Rewrite to end on a normal word.

When in doubt, **wrap the value in double quotes** — `description: "value with : inside"`. None of the existing 102 doc pages quote their description values today; quoting one page introduces a small style inconsistency but is more robust than rephrasing. For new authoring, prefer rephrasing to em-dash form (consistent with the rest of the doc product); quote only when rephrasing would lose meaning.

# Evidence

**Reproduction** (2026-05-28, after PR #73 merged):
```
$ python3 -c "import yaml; yaml.safe_load(open('docs/.../user-owner-association.md').read().split('---')[1])"
yaml.scanner.ScannerError: mapping values are not allowed here
  in "<unicode string>", line 2, column 103:
     ...  permissions — three write-paths: self-request, self-request wit ...
                                         ^
```

**Tree-wide pre-hotfix scan**:
```
1 pages with YAML frontmatter parse errors:
  docs/configuration-and-deployment/enable-security/authorization/user-owner-association.md
    → mapping values are not allowed here
```

**Tree-wide post-hotfix scan**:
```
0 pages with YAML frontmatter parse errors
```

# Cross-links

- **Sister case**: `retrospectives/LSN-027-meta-description-truncation-not-caught-by-webfetch.md` (same class — live-publisher behaviour the maintainer's local tooling didn't model).
- **Memory**: `memory/reference_yaml_frontmatter_hazards_in_description.md` (the YAML hazard catalog, written this session).
- **Backlog**: `backlog/docs/DOC-281.md` (hotfix item).
- **Gate updates**: `.claude/skills/implement/SKILL.md` step 6.5 (new sub-check (c) YAML parse), `playbooks/live-site-verification.md` step 3 (Gate 8 — YAML-parse sub-check during review), `pillars/documentation/gates.md` Gate 8 (specialisation extended).
