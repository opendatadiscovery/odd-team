---
id: docs/quality/duplication
target_repo: documentation (local: ../documentation)
scope: Same-feature-described-in-multiple-places detection — finds duplicate coverage, missing cross-links, and aliases not yet in the Terms & Aliases table
estimated_items: bounded by the count of features across Features.md and sibling pages
chunking: Process one Features.md section per run if the file is large (~18 sections today)
depends_on: []
priority: high
---

## Purpose

Detect cases where the same feature is documented in two or more places under different names, without cross-references. The 2026-04-22 retrospective surfaced two such pairs (S2S ↔ M2M, "Alternative Secrets Backend" ↔ "Collector Secrets Backend") that slipped past every other scanner because each one looks at only one slice of the docs. This scanner is the cross-cutting check.

Its outputs also feed the **Terms & Aliases** table in `docs/main-concepts.md` — every duplicate discovered is a synonym that belongs in the table.

## MANDATORY pre-scan step

```bash
git -C ../documentation fetch origin main
git -C ../documentation checkout origin/main
```

Same rationale as every docs scan: GitBook commits land on main, local branches lag.

## Inputs

- `docs/main-concepts.md` **Terms & Aliases** table — the seed synonym list.
- Every `.md` file under `docs/` — the corpus.

## Method

1. **Parse the Terms & Aliases table.** Build a list of canonical terms and their aliases. This is the known-synonym set.

2. **Find known-alias violations.** For each `(canonical, [aliases])` pair:
   - Grep each alias across all docs (excluding `main-concepts.md` itself).
   - For each hit, check whether the page containing the hit either (a) is the canonical page, or (b) contains an explicit inline mention of the canonical term ("also known as X", "see X"), or (c) contains a visible link to the canonical page.
   - If none of (a)(b)(c) hold → **finding**: page uses an alias without pointing users to the canonical source. Severity: high if the page describes the feature substantively, medium if it's a passing mention.

3. **Find unknown-alias suspects.** For config keys and product-name fragments that appear in both a `Features.md` section and a detail page:
   - Extract YAML keys (`secrets_backend:`, `auth.s2s.enabled`, etc.) from each `.md` file.
   - Extract section titles (H2/H3) from each `.md` file.
   - Flag any config key that appears in ≥2 pages where those pages' section titles differ (e.g., "Alternative Secrets Backend" in Features.md + "Collector Secrets Backend" in the detail page, both describing the same `secrets_backend:` block).
   - For each such flag → **finding**: probable alias pair. Output the detected names and recommend adding them to the Terms & Aliases table.

4. **Find orphaned teasers.** For each `Features.md` section:
   - If the section describes a feature that has its own detail page (detected by: section body contains a link to `configuration-and-deployment/...md` or a sibling detail page), AND the section body exceeds ~5 lines → **finding**: section should be collapsed to a teaser. Verbose sections in `Features.md` that duplicate a detail page's content are a maintenance hazard (two sources of truth, drift inevitable).

5. **Find reverse-orphans.** For each detail page under `configuration-and-deployment/` or similar:
   - If the page describes a feature that also appears in `Features.md`, AND the detail page's opening paragraph does not link back to the Features section or name the alias → **finding**: detail page needs a back-reference / alias mention.

## Criteria for a Finding

- **Known alias without cross-reference** (from step 2)
- **Unknown alias suspect** (from step 3) — same config key or same feature-name fragment in two pages with differing section titles
- **Orphaned teaser** (from step 4) — `Features.md` section too verbose given a dedicated detail page exists
- **Reverse-orphan** (from step 5) — detail page doesn't acknowledge its `Features.md` counterpart

## Severity Guidance

- **High** — substantive duplicate coverage (two pages with overlapping prose / config) and no cross-link. User-visible confusion; maintenance drift risk.
- **Medium** — one side is a brief mention, the other substantive; adding a link costs nothing but avoids dead-end searches.
- **Low** — same alias used in both places but already cross-linked; only the Terms & Aliases table needs an entry for discoverability.

## Output

Write to: `findings/docs-quality-duplication/YYYY-MM-DD.md`

Per finding:

```
### F-NNN: {canonical feature name}
- **Page A**: docs/path/page-a.md, section "{title}", lines N-M
- **Page B**: docs/path/page-b.md, section "{title}", lines N-M
- **Shared surface**: {config keys / prose overlap / product-name fragments that connect the two}
- **Current state**: {no cross-link / one-way link only / aliases not in Terms & Aliases table / teaser too verbose}
- **Severity**: high | medium | low
- **Recommended action**: {consolidate-and-link / inline alias mention / add Terms & Aliases row / collapse Features.md to teaser} — be specific about which page becomes canonical
- **Terms & Aliases row needed?** yes/no; if yes: `{canonical} | {aliases} | {one-sentence what} | {link to canonical page}`
```

## Known Pairs (seed data — confirm still valid on first run)

These are the two pairs that triggered this scanner's creation. The Terms & Aliases table on main already contains both; the scanner should confirm the inline and teaser remediations (DOC-R1, DOC-R2) have landed before marking them as resolved.

- `Features.md` "Machine-to-Machine (M2M) tokens" ↔ `configuration-and-deployment/enable-security/authentication/s2s.md`
- `Features.md` "Alternative Secrets Backend" ↔ `configuration-and-deployment/collectors-secrets-backend.md`

## Relationship to Other Scanners

- `docs/accuracy/feature-behavior` reads `Features.md`; it will not see a detail page that describes the same thing.
- `docs/accuracy/config-options` reads config pages; it will not see a `Features.md` section that describes the same config key.
- `docs/coverage/undocumented-features` may flag a feature as undocumented when it's already covered under a different name. This scanner surfaces the alias so the finding can be rejected or narrowed.
- `docs/quality/rendering` checks the published output; this scanner checks the source structure. Complementary.

## How this scanner's output feeds `/implement`

Every finding of type "known alias without cross-reference" or "unknown alias suspect" should include a proposed Terms & Aliases row. Triage converts findings into work items; each resulting work item is required (per `/implement` step 3.5) to grep using the alias set, which now includes the newly-added rows — so the fix feeds the next round's pre-authoring sweep and the duplication shrinks over time.
