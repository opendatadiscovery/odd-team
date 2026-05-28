---
lesson: LSN-027
title: "GitBook silently truncates the rendered description: frontmatter at 200 chars in four surfaces (including the visible page subtitle under H1); WebFetch markdown extraction strips <head> and didn't surface the visible-body subtitle either; /review Gate 8 missed 25 pages of operator-facing truncation across multiple batches"
date: 2026-05-28
gate: Gate 8 (live-site verification) — extends to require raw-HTML head inspection + description-length verification
status: closed
---

# Summary

On 2026-05-28, the user spot-checked `https://docs.opendatadiscovery.org/configuration-and-deployment/collectors-secrets-backend` after `/implement DOC-279` shipped a "Vault-claim fix" + `/review batch:feature/docs-cohort-c-2026-05-28` had already passed Gate 8 on the same page. The description rendered mid-clause: *"...with a pluggable interface for"* — visibly cut on the page subtitle directly under the H1. The user asked: "Why we do not check it during the review process?"

Investigation revealed:

1. **GitBook truncates the live-rendered `description:` frontmatter at exactly 200 characters** — mid-word, no ellipsis. The cut applies to **four** independent rendering surfaces of the same source text:
   - `<meta name="description" content="..."/>` (head — SEO snippet)
   - `<meta property="og:description" content="..."/>` (head — social previews)
   - `<meta name="twitter:description" content="..."/>` (head — Twitter card)
   - **`<p>...</p></header>`** (body — visible subtitle directly under the H1)

   Surface #4 is operator-facing on every page view in any browser — not an SEO-only issue.

2. **The miss spans 25 docs pages, not just DOC-279's one file.** Survey via mechanical `wc -c` on all `description:` frontmatter lines surfaced descriptions ranging from 201 to 285 chars across batches dating back weeks. The worst offenders (>250 chars) lose multiple words of the lede; the borderline cases (201-220 chars) lose a final word or two.

3. **Two specific /review session failures fed the bug**:
   - DOC-277 `/review` (2026-05-28) flagged 5/26 descriptions as 211-238 chars and wrote *"acceptable as accuracy-driven"* in the verdict. That phrase, used without a `VERIFIED via raw-HTML fetch of {url}` citation, is exactly the Gate 9 "banned-phrase" pattern — but Gate 9's banned-phrase list covered factual claim provenance, not metadata-length verification.
   - The DOC-279 `/implement` (same session) composed a replacement description that fixed the Vault fabrication but was still 253 chars — over the cap. I committed and pushed without a length check. Same miss class as the original.

# What I was supposed to do

`/review` Gate 8 (live-site verification, `playbooks/live-site-verification.md`) is the gate that catches "the live render doesn't match the manuscript". The playbook's procedure step 3 lists what to verify per URL — H1, target H2s, expected verbatim phrases in the body, in-page TOC sync, cross-links, in-bound links. **None of those checks include the page subtitle / lede or the head meta tags.** The procedure is silent on metadata, even though metadata is what GitBook truncates and metadata is what operators see as the page subtitle.

`/implement` per-commit checks (in the `/implement` skill protocol step 6.5) include the Gate 11 mechanical banned-term grep. **No parallel mechanical check existed for description length.** The DOC-277 implementer wrote "one sentence, 100-200 chars" as a guideline in the AC but no enforcement step ran.

# What actually happened (anti-pattern)

1. The DOC-277 implementer composed 26 descriptions, 5 over 200 chars. The IR noted the length range honestly but the implementer did not run a live-render verification (deferred to /review per the implement/review separation rule, correctly).
2. The DOC-277 `/review` ran Gate 8 WebFetch on a sample. WebFetch returned the rendered body content; the reviewer's prompts asked about specific section presence (cross-mode collision section, activity-feed link, etc.) — not about the page subtitle text. The page subtitle WAS in the WebFetch response but the reviewer didn't extract/compare it. Gate 8 marked PASS.
3. The reviewer noted 5/26 descriptions over 200 chars in the DOC-277 verdict and wrote *"acceptable as accuracy-driven"*. This dismissed the AC's "100-200 chars" as a guideline rather than verifying live behavior.
4. The DOC-279 implementer (the same session that authored the original DOC-277 fix's "Vault" critique) shipped a replacement description that was 253 chars — STILL over the cap. No length-check pre-commit; no awareness that 200 chars was the actual GitBook ceiling.

The same anti-pattern appeared in three different roles (implementer, reviewer, implementer of the fix) — because no rail caught it at any of those points.

# What we change

## Gate 8 (live-site verification) — extends to require raw-HTML head inspection

`playbooks/live-site-verification.md` procedure step 3 gains a new sub-step:

- **Per affected URL, fetch raw HTML via `curl -sL` and verify head/subtitle rendering:**
  - `<meta name="description" content="..."/>` — extract content, compare length + text to source frontmatter `description:` line. FAIL if content does not match source.
  - `<meta property="og:description" content="..."/>` — same check.
  - `<meta name="twitter:description" content="..."/>` — same check.
  - **`<p>...</p></header>` page-subtitle** (body element directly under H1 on GitBook) — extract text, compare to source frontmatter. FAIL if truncated mid-word.
  - **Generalisation**: any time a doc change modifies a structural element that renders into the page head (title, description, og tags, canonical URL, structured data), Gate 8 must include the raw-HTML fetch. WebFetch alone is insufficient because it strips `<head>` and extracts only body markdown.

## /implement step 6.5 (pre-commit mechanical sweep) — gains a description-length check

`.claude/skills/implement/SKILL.md` step 6.5 (which currently runs only Gate 11 banned-term grep) gains a parallel mechanical check:

```bash
# For every change touching a description: frontmatter line, verify <=200 chars (target ~180 for safety)
git diff --staged --name-only -- '../documentation/docs' \
  | grep -E '\.md$' \
  | while read f; do
      desc=$(head -3 "$f" | grep '^description:' | head -1 | sed 's/^description: //')
      if [ -n "$desc" ]; then
        len=$(echo -n "$desc" | wc -c)
        if [ "$len" -gt 200 ]; then
          echo "OVER 200: $len chars: $f"
        fi
      fi
    done
```

For every hit: shorten the description before commit. Do not commit a description over 200 chars.

## Gate 9 (banned-phrase list) — extends to cover metadata-fidelity rationalisation

The Gate 9 banned-phrase list in `pillars/documentation/gates.md` already bans "defensible", "probably correct", "looks right", "canonical owner", "monorepo default", "safe to assume", "presumably", "should be" as standalone justifications. The 2026-05-28 miss adds **"acceptable as {anything}-driven"** to the banned list — the specific phrase I used in the DOC-277 verdict to dismiss the over-200 descriptions without verification. Banned phrases require `VERIFIED via {fetch/grep/read/raw-HTML curl}` or `NOT VERIFIED → log as DOC-NNN`.

## DOC-280 follow-up — systematic fix for 24 other affected pages

DOC-279's collectors-secrets-backend.md fix shipped on `feature/docs-doc279-vault-description-fix` (commits 7533cba + b0ddfee). The other 24 affected pages need parallel rewrites; logged as `backlog/docs/DOC-280.md` for a future `/implement` batch.

# Evidence

**Raw HTML extraction confirming all 4 surfaces truncate at 200 chars** (collectors-secrets-backend.md pre-fix, source frontmatter = 253 chars):
```
hit #1 (head):   <meta name="description" content="...AWS SSM Parameter Store today, with a pluggable interface for"/>
hit #2 (head):   <meta property="og:description" content="...with a pluggable interface for"/>
hit #3 (head):   <meta name="twitter:description" content="...with a pluggable interface for"/>
hit #4 (BODY):   <p>...with a pluggable interface for</p></header>   ← visible page subtitle
```

**Mechanical survey of every page with description >200 chars** (executed 2026-05-28):
- 25 affected pages
- Worst: `multilingual-ui.md` at 285 chars
- Range: 201-285 chars
- Cross-batch: pages from DOC-277 (this session) + earlier batches going back several weeks

# Cross-links

- **Related case-law**: `retrospectives/LSN-001-attachment-ephemeral-default.md` (defaults invisible at manuscript level but operator-breaking at live level — same class of miss as this one), `retrospectives/LSN-002-minio-region-unset.md` (silent SDK default that ships data-loss; surface-vs-effect divergence).
- **Memory**: `memory/feedback_live_render_verify_via_raw_html.md`, `memory/reference_gitbook_meta_description_200_char_limit.md`.
- **Backlog**: `backlog/docs/DOC-280.md` (24-page systematic fix).
- **Gate updates**: `playbooks/live-site-verification.md` procedure step 3 (raw-HTML head inspection), `pillars/documentation/gates.md` Gate 8 specialisation (description-length verification), `.claude/skills/implement/SKILL.md` step 6.5 (pre-commit length check).
