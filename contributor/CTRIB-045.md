---
id: CTRIB-045
title: "Recently-viewed reachability — pin the recency column right + a usable horizontal scrollbar (CTRIB-044 follow-up)"
issue: 1816
status: pr-draft            # maintainer re-report on the merged #1830; DoD met + verified; DRAFT PR #1831 (Part of #1816). /review -> GATE 2.
target_repo: odd-platform
milestone: "1.0.0"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1831 (DRAFT, Part of #1816; author odd-contributor[bot]; base main; off main 9fa5fea9)"
pr_draft: true
scanner_source: maintainer-rereport
effort: max
parent: CTRIB-044
---

## Context — the maintainer re-report (verbatim, 2026-06-30)

> but I try this stand that is built on top of current main after the merge of the PR …/search/… and I still
> do not see entire value for Recently viewed and the sign of x to remove from recently viewed. I still could
> not scroll to the right columns

So CTRIB-044 / PR #1830 shipped + merged (main `9fa5fea9`) but **did not actually fix defect 2** at the
maintainer's screen width. This item is the real fix.

## Why #1830 looked fixed but wasn't — the lesson (test integrity)

CTRIB-044's IT-149 test 5 asserted the list was scrollable and then **scrolled it programmatically**
(`el.scrollLeft = el.scrollWidth`) before checking the recency cell was visible. That passes whenever the
container *can* scroll — it never proved a **user** could discover or operate the scroll, nor that the recency
value fits. Green test, broken feature. The rewritten test asserts `toBeInViewport()` **without any
scrolling** — user-observable reachability, not programmatic state. (Candidate retrospective: "an e2e
assertion that drives the surface programmatically can be green while the user-facing affordance is broken —
assert what the user can see/reach, not what the DOM can be forced into.")

## Root cause (measured, not guessed — `_ctrib044-diag` at 1100/1440)

At a standard width (e.g. 1440px): the results area is ~1184px but the table floors at `min-width: 1320`, so
it overflows and the **Recently viewed column sits off the right edge** (`rvHeaderRight 1551 > 1440`). The
only way to it was the horizontal scrollbar — which is the app-global **4px, `#EBECF0` (near-white) overlay**
bar (`theme/overrides.ts`), rendered at the bottom of a **viewport-tall** `height: calc(100vh …)` container,
far from the row and effectively invisible. Hence "can't see the value / can't scroll".

## Fix (FE-only) — Search (the reported surface), verified

1. **Pin the Recently-viewed column to the RIGHT edge** (mirror of the Name's left pin): `SearchCol`
   `$stickyRight` → `position: sticky; right: 0` with an opaque background, applied to the rv header + row +
   skeleton. The recency value + its ✕ are now **always on screen, no scrolling required**. Measured: at
   1440px `rvHeaderRight` went 1551 → **1424 (< viewport)**; header + row rv both pin at the list's right edge,
   aligned.
2. **Widen the rv column** (`rv` grid proportion 1 → **1.6**) so "Viewed 11 months ago ✕" fits the pinned cell
   without clipping (~172px at lg vs the ~155px longest label).
3. **`max-height` instead of fixed `height`** on the list container so it shrinks to the rows and the
   horizontal scrollbar sits **directly under them** (verified: container 672 → 94px with one row).
4. **A prominent, usable horizontal scrollbar** for the wide table (12px, `#C1C7D0` thumb + track) so the
   middle columns (Status/Created/Updated) are reachable — overriding the near-invisible global 4px bar.

The pin (1) is the robust guarantee for the maintainer's primary complaint and is **verifiable in-test**; the
scrollbar (4) is the Athena-style scroll they asked for, for the non-pinned middle columns.

## Scope + the lg/md note

- **Search**: pinned + verified (IT-149 5/5 at 1280; screenshot at 1440 shows "Viewed 1 second ago ✕" pinned
  and fully visible). The pin is clean at the **lg breakpoint (≥1200px)** — a standard screen. At the **md
  breakpoint (<1200px)** MUI's grid renders the header narrower than the rows (a grid min-width/breakpoint
  quirk, measured: header rv at 849 vs row rv pinned at 1084); the rv row cell still pins, but the header
  label can misalign. Tracked as a known limitation for sub-1200px windows.
- **Terms + Query Examples**: get the **max-height + prominent 12px scrollbar** now (a real improvement over
  the 4px near-white bar). Their lists carry an empty trailing spacer column after the rv and use a different
  (flex) layout, so the right-pin needs a separately-verified change — **follow-up, not shipped unverified
  here** (the whole reason we are back is an unverified fix). Logged below.

## Test ledger (DoD)

- **Unit FE:** `tsc --noEmit` GREEN (and the `ctrib044h` jib build's vite type-check passed).
- **IT-149 test 5 (rewritten):** at 1280 (lg) the recency remove control is `toBeInViewport()` with **no
  scrolling**, the list overflows at its min-width, and Name is pinned left. **Run-confirmed 5/5 GREEN** on the
  final build `ctrib044h` (rv 1.6, image `7088656d`).
- **RED proof — run-confirmed:** IT-149 against the cached **`ctrib044f`** image (the pre-pin CTRIB-044 state,
  content-identical to `origin/main` 9fa5fea9 — `git diff bac3f476 origin/main` empty — plus an inert `data-qa`)
  → **4 pass / 1 fail**: tests 1-4 GREEN, **test 5 RED** (`toBeInViewport()` fails — the rv is not pinned and
  overflows off-screen). Surviving-RED ✓.
- **Full regression — run-confirmed:** feature-complete on `ctrib044h` (image bypass) = **327 pass / 2 fail**,
  green-for-change. The restructured surfaces (`catalog-search`, `term-search`, `query-examples-crud-search`)
  + IT-149 **5/5** GREEN. The 2 fails are **outside this change's blast radius** and both fail on the pre-pin
  `ctrib044f` too: #128 `favorites-star-see-loop` Group-B (the CTRIB-039 co-stream test) and #271
  `remove-user-owner-mapping` CORNER/UC-003 — already tracked as `issues/odd-platform/PLT-148.md` +
  `backlog/tests/TST-054.md` (a flaky owner-association corner; passed on `fea1477`, fails here — not a
  CTRIB-045 regression, my change touches only the search/term/QE list styling).
- **Pixel (G-C12) — CONFIRMED:** at 1440px the rv header right edge is 1424 (< viewport 1440; was 1551
  off-screen pre-pin); header + row rv both pinned/aligned at 1255-1424 (169px cell); the "Viewed 1 second
  ago ✕" tag (145px) sits fully inside with margin — no clip (`ctrib044-repro-1440-default.png`, diag at 1440).

## Docs (G-C10)

No doc change — presentation/layout fix, no new user-facing concept.

## Follow-up logged

- **CTRIB-046 (to log):** apply the right-pin to the Terms + Query Examples recency columns (flex layout +
  trailing spacer; verify each at lg via screenshot).

## Status

`re-report` → measured root cause (`_ctrib044-diag`) → pin + maxHeight + visible scrollbar + wider rv → IT-149
test 5 rewritten (toBeInViewport, no programmatic scroll) → **5/5 GREEN at 1280** → final build `ctrib044h`
→ regression + RED proof → new PR (`Part of #1816`) → `/review`.
