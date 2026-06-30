# LSN-039 — A test that drives the surface programmatically can be GREEN while the user-facing affordance is broken

**Gate:** G-C15 (test integrity) · test-pillar closure
**Date:** 2026-06-30
**Origin:** #1816 CTRIB-044 → CTRIB-045 (Recently-viewed list reachability)

## The miss

CTRIB-044 shipped a "narrow list scrolls horizontally" fix with an e2e test (IT-149 test 5) that asserted the
container was scrollable and then **scrolled it programmatically** before checking the recency cell was
visible:

```ts
const scrollable = await page.locator('#results-list').evaluate(el => el.scrollWidth > el.clientWidth + 100);
expect(scrollable).toBe(true);
await page.locator('#results-list').evaluate(el => { el.scrollLeft = el.scrollWidth; }); // drives the DOM
await expect(row.locator('[data-qa="recently-viewed-remove"]')).toBeVisible();
```

This was **GREEN**, the item flipped, the PR (#1830) merged. The maintainer then tried it on a real stand:
the Recently-viewed value + its remove control were **off-screen and unreachable** — the only scroll affordance
was the app-global 4px near-white overlay scrollbar nobody could find. The test proved the container *could*
be scrolled (by code), never that a *user* could discover or operate that scroll, nor that the value fit.
Green test, broken feature. We were back in front of the maintainer for the same defect.

## The rule

**Assert what the user can perceive and reach, never what the DOM can be forced into.** An e2e assertion that
manipulates scroll position, focus, hover, or visibility via `evaluate`/`dispatchEvent` and then checks state
is testing the harness, not the product. If the value of the feature is "the user can see/reach X without
ceremony", the test must check exactly that with **no programmatic driving**:

- reachability/visibility → `toBeInViewport()` (or a geometric check vs the viewport) **before any scroll**;
- "the affordance is discoverable" → assert the affordance is rendered and in-view, not that a forced action
  succeeds;
- if a user action is genuinely required, perform it the way the user would (`.click()`, `.hover()`, real
  wheel/drag) — not by setting the underlying property.

The CTRIB-045 rewrite asserts the recency remove control `toBeInViewport()` at a standard width with **no
scroll** (the fix pins the column to the right edge so it is always on screen). It is RED on the merged-but-
broken `main` and GREEN on the fix — the discrimination the original test never had.

## How to apply

In `/review` and when authoring closure tests: grep the diff's new e2e for `evaluate(`, `scrollLeft`,
`scrollTo`, `dispatchEvent`, forced `style`/`classList` changes feeding an assertion. Each one is a smell —
ask "is this reproducing a user action, or manufacturing the state I'm about to assert?" The latter fails
G-C15 regardless of green. Pair with the pixel gate (`G-C12`): a screenshot of the *un-driven* surface is the
cheapest tell that the affordance is actually there.

Related: [[feedback_po_sre_lens_on_feature_reviews]] (a slice can be locally-correct yet broken end-to-end),
[[feedback_reuse_platform_ui_patterns]] (the fix reused the Name column's existing left-pin).
