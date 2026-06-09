---
playbook: ascii-only-issue-bodies
status: active
since: 2026-06-09
applies_to: universal (issue drafts)
---

# PROTOCOL ascii-only-issue-bodies

The body of an issue draft IS the GitHub issue body - it gets copy-pasted into the GitHub web UI. The maintainer's paste path does NOT preserve UTF-8: a multiplication sign pastes as a replacement glyph, an em dash pastes as `?`. A draft that reads correctly on disk can ship garbled into a public issue. So issue-draft bodies are ASCII-only. Per `retrospectives/LSN-031`.

## trigger

- Authoring or finalizing any issue draft (`issues/{repo}/{PLT|COL|SPEC|...}-NNN.md`) before it leaves `draft`.
- Any `/review` or batch finalization of issue drafts.
- Any mechanical sweep of the issue corpus.

## inputs

- the issue-draft file(s)
- the replacement map (below)

## procedure

1. **Scan for non-ASCII.** Any character with `ord(c) > 127` in the file is a candidate paste-breaker.
   ```bash
   python3 - "$f" <<'PY'
   import sys, collections, unicodedata
   t = open(sys.argv[1], encoding="utf-8").read()
   bad = collections.Counter(c for c in t if ord(c) > 127)
   for c, n in bad.most_common():
       print(f"{c!r} ({unicodedata.name(c,'?')}) x{n}")
   PY
   ```

2. **Replace symbols/punctuation with ASCII** (letters are NOT touched - see the exception):

   | Non-ASCII | ASCII |
   |---|---|
   | em dash `—`, en dash `–`, minus `−` | `-` (or ` - ` / `--`) |
   | right/left/both arrows `→ ← ↔`, dashed `⇢` | `->` `<-` `<->` `-->` |
   | multiplication `×` | `x` |
   | ellipsis `…` | `...` |
   | `≥` `≤` `≈` | `>=` `<=` `~` |
   | element-of `∈`, bowtie/join `⋈` | ` in ` ` join ` |
   | section `§` | `Sec ` |
   | check `✓`, warn `⚠`, variation selector | `(ok)` `(warn)` (remove) |
   | curly quotes `‘ ’ “ ”`, non-breaking space | `'` `'` `"` `"` ` ` |

3. **The native-content exception.** When a draft's SUBJECT is non-Latin text (e.g. PLT-213's language-switcher bug names `Espanol`/`Ukrainska`/CJK natively), those LETTERS are the content and stay. Confine them to a code block where possible, and flag the draft in its frontmatter or a one-line note as needing a UTF-8-safe paste. The replacement map above touches only symbols/punctuation, so a letters-only residue after the pass is the legitimate exception, not a miss.

4. **Re-scan + parse.** After replacement, re-run step 1; the only residue allowed is native-content letters (step 3). Then PyYAML-`safe_load` the frontmatter to confirm the edit did not break it.

## exit

- The issue-draft body contains no non-ASCII except legitimate native-content letters (step 3), which are flagged.
- Frontmatter still parses (PyYAML).
- No banned phrases per `playbooks/claim-inventory.md` in any added text.

## on-fail

- Non-ASCII symbol/punctuation in a body -> replace per the map; never file a draft with paste-breaking glyphs.
- Native-content non-Latin text that cannot be confined to a code block -> keep it, flag the draft as UTF-8-paste-required, and tell the filer.

## case-law

- `retrospectives/LSN-031` - the 2026-06-09 batch: `N x M` pasted into GitHub as a garbled glyph and ` - ` as `?`; the whole issue corpus carried em dashes / arrows / `x`. ASCII-fied the pilot batch + the corpus, codified here and in `issues/README.md` ("Encoding: ASCII-only body").
- `playbooks/live-site-verification.md` - the sibling "the rendered surface is not the source" discipline (GitBook meta-truncation, YAML parse stalls).
