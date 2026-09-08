---
id: CTRIB-068
title: "Follow-up to #1888: the Last-viewed date range could not be picked, the help tooltip ran across the results table, and the rail read like work"
github_issue: "(none — three defects the maintainer reported on a merged main; no upstream issue was filed)"
target_repo: odd-platform
status: pr-draft          # REWORK of the 2026-09-08 review fix-list landed 2026-09-08 (same session — allowed for /implement; the NEXT /review must be a fresh session): odd-platform 36feb82f ON ORIGIN (three commits on top of the reviewed c5b51743) + the one-file workflow commit 9af0cf86 HELD locally (the App lacks the `workflows` permission — see F2) + documentation#117 @ f146742. All four blockers and all three fold-ins closed with measured evidence — see "## Rework" at the end. The round-1 verdict (REJECTED, 4 blockers + 3 fold-ins) stands as the record of what was found.
classification: bugfix
stream_id: ctrib068
base_sha: "5926be7e"      # odd-platform origin/main = the #1888 merge
head_sha: 36feb82f        # on origin; was c5b51743 (the reviewed head); +14349bbd (tooltip) +1a5cd769 (i18n) +36feb82f (gradle gate + timeout). 9af0cf86 (the run_ui_tests workflow job, ONE file) sits on top locally in ../odd-platform-ctrib067 and NOT on origin: GitHub refused the App's push of .github/workflows/** ("without `workflows` permission")
pr: "odd-platform#1889 (DRAFT, base main, head fix/CTRIB-068-range-facet-usability @ 36feb82f; +9af0cf86 held locally) + documentation#117 (DRAFT, base release/1.0.0, head docs/CTRIB-068-last-viewed-calendar-label @ f146742)"
implement_ledger: "NOT COMMITTED — the implementing session (session_01WAQvH8ChLMGCUhZ8ASUAMi) opened PR #1889 and hardened the gates (odd-team ca8383f6, G-C20) but left no CTRIB-068 work item on disk. This file was created BY THE REVIEW to carry the verdict; §Implementation Record is therefore absent and the implement-phase Definition of Done could not be read at intake (the 2-minute precondition check was run against the PR body instead)."
docs_routing: "documentation@release/1.0.0 — documentation#117 amends docs/data-discovery/search.md:158-160 (the retired \"Custom range\" caption, named by its placeholder now); the 1.0.0 release-gate phrase is recorded in backlog/docs/DOC-529. Was MISSING at review time (blocker B4)."
---

# CTRIB-068 — the range can actually be picked, and the help stops covering the results

The implement-phase record for this item was never written to disk (see `implement_ledger` above). What the change
does is stated by its three commits and by PR #1889's body; this file carries the review verdict.

## Review (2026-09-08, session: review-ctrib068)

- **Result**: **REJECTED** → `status: blocked`
- **Separate-session gate**: PASS — implemented in `session_01WAQvH8ChLMGCUhZ8ASUAMi` (per all three commit
  trailers), reviewed in `session_012ANDXv8XXDFfzoBAQFVBob`. No overlap.
- **Reviewed at**: odd-platform `c5b51743` (PR #1889 head), base `5926be7e` (the #1888 merge on `main`).

### What is right, and verified independently

- **The date-picker fix is correct and its tests are real goal-completion tests (G-C20 PASS for that half).**
  `AppDateRangePicker.tsx:156` — `value={[rangeStart, rangeEnd].filter(Boolean) as Date[]}` replaces the
  `rangeStart && rangeEnd ? … : []` collapse. The diagnosis holds against the code: `handleSetRange`
  (`:85-92`) leaves `rangeEnd` undefined after one click, the controlled calendar was therefore re-rendered
  with `[]`, and `handleClickDone` (`:113-118`) still refuses to commit a half-made range, so nothing was
  lost by showing one.
- **RED proof re-run by the reviewer, not taken on trust.** Both new suites were copied verbatim onto a
  detached worktree at merged main `5926be7e` and run there: `with NO range seeded, two clicks + Done…`
  and `with a range already seeded…` both FAIL (`expected "vi.fn()" to be called 1 times, but got 0 times`),
  and `wraps a plain-string informational title in the shared card body` FAILS
  (`expected null not to be null`). The three invariant cases (half-made does not commit; a rich title is not
  re-wrapped; an overflow echo stays bare) are green on both systems, which is correct — they are guards, not
  bug proofs. On the PR head all 10 cases in the two files pass.
- **The `AppDateRangePicker` consumer sweep is complete.** `grep` for the import gives exactly two shipped
  consumers — `RecentlyViewedFilter.tsx:182` and `CalendarFilter.tsx:61` (which drives BOTH the Activity and
  the Alerts Period filters) — and the two new picker cases drive the unseeded path (Last viewed / Alerts) and
  the seeded path (Activity) separately. The intermediate "one of two dates chosen" state is walked by case 3.
- **i18n parity PASS.** All seven catalogs at 734 keys; set-difference against `en` in both directions is empty
  for all seven. The six new keys carry real translations in every catalog (spot-checked `ua`).
- **No functional regression in the unit suite** — see "Regressions" below.
- **CI**: 6/6 green on `c5b51743` (`Test Results`, `run_tests`, `run_playwright_tests/{test,lint,format-check}`,
  `update_release_draft`) — VERIFIED via `GET /commits/c5b5174.../check-runs`. See fold-in F2 for what that
  does and does not measure.

### Blockers

**B1 — the 360px cap on the light popper breaks four other shipped tooltips. MEASURED.**
`AppTooltipStyles.tsx:40` adds `maxWidth: '360px'` to `getTooltipStylesByType`'s final branch — the **`light`**
branch, which is `AppTooltip`'s DEFAULT `type` (`AppTooltip.tsx:28`). It therefore applies to every tooltip on
the platform that does not opt out, including the ones whose content is deliberately wider than 360px.

Measured in Chromium (Playwright 1223, viewport 1440x720) on the real generated CSS + DOM, same fixture,
`main-*` vs `head-*`:

| consumer | its own width | main card | head card | content overflow |
|---|---|---|---|---|
| `SearchHighlights` — the "why it matched" panel on **every search result row** (`ResultItem.tsx:99-101`) | `width: 640px` (`SearchHighlightsStyles.ts:6`) | 640px | **360px** | **+280px outside the card** |
| `DataEntityDetailsPreview` — the asset preview hover card (`DataEntityDetailsPreview.tsx:180-181`) | `minWidth: 400px`, `maxWidth: 800px`, `width: min-content` (`DataEntityDetailsPreview.styles.ts:8-10`) | 400px | **360px** | **+40px, and it grows with content** |
| `RelationshipKey` x2 (`RelationshipKey.tsx:25,36`) | `maxWidth: 430px` (`OverviewRelationshipStatsStyles.ts:12`) | up to 430px | clamped to 360px | reflows |
| `Markdown` term-link preview (`Markdown.tsx:109-110`) | unbounded markdown | unbounded | clamped to 360px | reflows |

The first two are **the exact defect shape this PR exists to fix** — content painted outside its own card —
reintroduced on two other surfaces. `OverviewDQSLAReport` survives only by accident: its
`componentsProps.tooltip.sx` uses `maxWidth: '420px !important'` (`OverviewDQSLAReportStyles.ts:21`), and the
`!important` outranks the new rule.

Fix direction: the wrap width belongs on the BODY, not on the popper. `TooltipBody` already carries
`maxWidth: 360px` (`AppTooltipStyles.tsx:81`); with the auto-wrap of B2 corrected, every informational string
gets that width through the body and the popper needs no cap at all. If a popper-level floor is still wanted,
it must be conditional on `AppTooltip` having supplied the body — never applied to a caller's own element.

**B2 — the auto-wrap fires on `type='dark'` tooltips and draws a light card inside the dark chip. MEASURED.**
`AppTooltip.tsx:53-58` keys the wrap on `!checkForOverflow` alone and never looks at `type`. Two shipped call
sites are `type='dark'` with a plain-string title:

- `DatasetStructureItem.tsx:144-147` — the `Logical type: X` (i) on **every field row of every dataset's
  Structure tab**
- `LinkedColumn.tsx:52-55` — the same idiom on Term detail -> Linked columns

Measured, same fixture: main **137x20px** (a compact dark chip) -> head **176x43px**, the inner element carrying
`padding: 8px`, `border: 1px solid rgb(235,236,240)`, `border-radius: 8px`,
`box-shadow: rgba(0,0,0,.12) 0 3px 12px` and `font-size: 14px` — a light card, border and all, drawn on the dark
`rgb(37,56,88)` background. The height more than doubles.

Fix direction: gate the auto-wrap on the informational type as well as on `checkForOverflow`, or give the dark
type its own minimal body.

**B3 — the consumer sweep's central claim is false, and it is committed into the source.**
"**Fifteen call sites pass a bare string**" appears in PR #1889's body, in commit `7679099b`'s message, and
permanently in `AppTooltip.tsx:49-50`. The measured number is **three** of the fifteen `checkForOverflow={false}`
sites: `FavoritesFilter.tsx:76` (light — correctly improved by this change), `LinkedColumn.tsx:52` and
`DatasetStructureItem.tsx:144` (both dark — B2). The other twelve already pass elements: `ResultItem`
`<SearchHighlights/>`; `TermDefinition.tsx:27`, `DatasetFieldDescription.tsx:45` and
`InternalDescriptionHeader.tsx:23` a `<S.Tooltip>`; `DataEntityDetailsPreview` its `content`;
`ActivityActorLabel.tsx:33`, `ActivityFilterHints.tsx:18` and `SearchSyntaxHint.tsx:19` a `<TooltipBody>`;
`OverviewDQSLAReport` its `SLAHint` element; `RelationshipKey.tsx:25,36` a `<S.Tooltip>`; and
`RangeFacetShell.tsx:106-118` its own `<TooltipBody>`.

This is the gate that failed. A sweep done **per site** rather than as a count would have surfaced both B1 and
B2 — the two axes that matter (`type`, and whether the title is an element with its own width) are exactly what
a count discards. The claim must be corrected everywhere it was written, including the source comments, because
those outlive the PR.

**B4 — a published doc line now names a control this PR deletes.**
`RecentlyViewedFilter.tsx:183-186` sets `label=''`, removing "Custom range" from the rail.
`documentation` `docs/data-discovery/search.md:158-160` on `origin/release/1.0.0` (@ `2ab02d4`, PR #116 merged
2026-09-08) reads:

> "Four preset links — **Today**, **Last 7 days**, **Last 30 days** and **Any time** — cover the common windows;
> a **Custom range** calendar picks any two days for everything else."

The manual bolds a control label the reader will not find on the page. There is no documentation PR paired with
this change (the only open documentation PR is #108, unrelated) — VERIFIED via
`GET /repos/opendatadiscovery/documentation/pulls?state=open`. `git grep "Custom range" origin/release/1.0.0 -- docs/`
returns exactly this one line, so the fix is a one-line edit on the train, but it is owed: Gate 6 (bidirectional
code <-> doc) fails without it.

### Fold-ins (fix in the same rework pass — the implementer is already opening these files)

**F1 — `"Custom range"` is now an orphan i18n key in all seven catalogs (`:717`).** No `t('Custom range')` call
site remains in `src/**`; the only survivors are a comment, a `queryByText(...)` null-assertion, and a literal
prop in the new test. The commit says "two retired" — it should be three.

**F2 — nothing runs the new tests.** `run-pr-tests.yaml:22-60` runs
`./gradlew odd-platform-api:build -PbundleUI=false` (Java only), and `run-playwright-tests.yml`'s `test` job
stops at `jibDockerBuild` — every Playwright step below it is commented out (`:61-73`). No workflow anywhere
under `.github/workflows/` runs `odd-platform-ui` vitest. So `AppDateRangePicker.test.tsx` and
`AppTooltip.test.tsx` will never execute in CI, and the PR's own remedy — "the tests are the point" — does not
hold the line it was written for. The green `Test Results` / `run_tests` checks on `c5b51743` measure the Java
build; they never had a chance to catch this class. Either wire a vitest job into `run-pr-tests.yaml` (a ~15-line
job, and the smallest thing that makes the remedy real) or the change is documentation of a lesson rather than a
guard against it. Same root cause makes F3 invisible.

**F3 — the FE unit suite is already red locally and this PR adds three more timeouts.** Full local run at the
reviewed SHA: **258 passed / 10 failed** (44 files). Baseline on merged main `5926be7e`, same machine:
**255 passed / 7 failed** (42 files). Every failure on both sides is `Test timed out in 5000ms`, and the three
head-only ones (`DataEntitiesUsageInfoView`, `CalendarFilter`, `AppPopover`) all **pass in isolation** — so no
functional regression, but the PR adds ~22s of jsdom test time to a pool where every other suite still runs on
the 5s default. The PR's own comment — "a case that only passes when it runs alone is not a gate" — now applies
to three of its neighbours. The 7 pre-existing failures are the direct consequence of F2: nothing has been
holding this suite green.

### Quality Bar

- **Gate 0 — Design before build**: PASS for the picker half (the class was diagnosed in the shared element, not
  patched at the call site — `feedback_fix_the_class_in_the_shared_element` held). FAIL for the tooltip half:
  the class fix was applied to the shared element without classifying what the element's other callers hand it
  (B1/B2/B3).
- **Gate 1 — No duplicates**: PASS — `RangeFacetShell` reuses the shared `TooltipBody` rather than copying it
  (`RangeFacetShell.tsx:4,106-118`); `presetsPlacement` extends the existing shell instead of forking a date
  variant.
- **Gate 4 / Gate 9 — provenance**: FAIL — B3. The "fifteen call sites" claim is committed to source and is
  measurably three. The picker claims all check out against `AppDateRangePicker.tsx:85-118` and against
  `git show 0238005c:…` (the pre-#1888 `value={[rangeStart, rangeEnd]}` pass-through the fix restores).
- **Gate 6 — bidirectional code <-> doc**: FAIL — B4.
- **Gate 7 — layout/completeness**: PASS on the platform side; the `data-qa` contract IT-157 depends on
  (`filter-recently_viewed`, `-chip`, `-info`, `-disabled`) is preserved through the `RangeFacetShell` rewrite.
- **Gate 8 — publishing standards**: N/A this round (nothing merged; the doc change of B4 is not yet authored).
- **G-C20 — presence is not function**: **PASS for the picker, FAIL for the shared-component sweep.** The named
  interaction cases exist, drive the control (`clickDay` -> `clickDay` -> `Done`), assert what it hands back, and
  are RED on the pre-fix system — verified by the reviewer re-running them at `5926be7e`. Clause (b) — "if the
  diff touches a shared component, every consumer was driven" — fails: `AppTooltip`'s consumers were counted,
  not driven, and four of them regress (B1/B2).
- **G-C15 — changing a test**: N/A — no existing test was modified; both test files are new.

### Regressions

None functional in the unit suite (F3 measured and attributed). Four **visual/behavioural** regressions on
shipped tooltip surfaces, measured in a real browser: B1 (x4 consumers) and B2 (x2 consumers).

### Navigation

Consistent — no new bean factory / SDK builder / pointer shift; the change is UI-local.

### Doc-product editorial audit

Not run this round. The verdict is a FAIL on four blockers and the item goes straight back to implement; the
editorial read is queued for the round-2 review, when the tree is stable. Coverage state unchanged in
`state/PROGRESS.md`.

### The one rework fix-list

1. **B1** — take `maxWidth: '360px'` (and `whiteSpace: 'normal'`) off the light popper branch
   (`AppTooltipStyles.tsx:40-41`); let `TooltipBody`'s own `maxWidth: 360px` do the wrapping, so a caller's own
   element keeps its width. Re-measure `SearchHighlights` (640px) and `DataEntityDetailsPreview` (>=400px) — both
   must show 0px overflow.
2. **B2** — gate the `AppTooltip.tsx:53-58` auto-wrap on the informational type as well as on
   `checkForOverflow`, so `type='dark'` string titles stay the compact dark chip they are today. Re-measure
   `Logical type: X`: it must return to ~137x20px, not 176x43px.
3. **B3** — correct "fifteen call sites" to the measured three everywhere it was written: PR #1889's body,
   commit `7679099b`'s message, and `AppTooltip.tsx:49-50`. Replace the count with the per-site classification
   (which sites are strings, which are elements, which are dark) — that list is the artefact the next change
   needs.
4. **B4** — one doc commit on `documentation@release/1.0.0` amending `docs/data-discovery/search.md:158-160` so
   it no longer names a "**Custom range**" control (the calendar is now unlabelled behind the
   "Pick two dates" placeholder), paired as its own PR the way #116 was.
5. **F1** — retire `"Custom range"` from all seven catalogs (`:717`) and correct the commit message's
   "two retired" to three.
6. **F2** — add a vitest job to `run-pr-tests.yaml` so the two new suites (and the 44-file FE suite) are actually
   gated. Without it this PR's remedy never runs.
7. **F3** — with F2 in place, give the suite a timeout that survives its own pool (a global `testTimeout` in
   `vitest.config`), and re-run to a real green before the next hand-off. The 7 failures already on `main` are in
   scope of F2/F3, not of this fix.

Re-review must be a fresh session (this one may not review its own fix-list).

## Rework (2026-09-08, session: review-ctrib068 — the reviewer worked its own fix-list; the NEXT `/review` must be fresh)

Head after the rework: odd-platform **`36feb82f`** on origin (three commits on top of the reviewed `c5b51743`,
nothing rewritten — the PR is squash-merged, so the PR body is the record that lands on `main`) **plus
`9af0cf86` held locally** (the workflow job — see F2 for why it is not on origin) + documentation **#117** @
`f146742`. Every item below was closed by running or measuring the thing; the numbers are in
`contributor/evidence/CTRIB-068/measurements.txt`.

| item | what changed | evidence |
|---|---|---|
| **B1** popper cap | `AppTooltipStyles.tsx` light branch: `maxWidth: 360px` + `whiteSpace: normal` removed; a comment now says WHY there is no cap on the default type. The wrap width lives on `TooltipBody` (`:81`) only. (`14349bbd`) | Chromium, same fixture — `fixed/highlights640` card **640 px / 0 overflow**, `fixed/preview400` **400 px / 0** — both identical to `main` (were 360/280 and 360/40 at the reviewed head). The original defect stays fixed without the cap: `fixed/lightstring` (the 235-char help as a bare string, light, informational) renders a **378×123 px card**, body `max-width 360px`, six lines. |
| **B2** dark auto-wrap | `AppTooltip.tsx:57-60`: the body is applied only when `type === 'light' && !checkForOverflow && string\|number`. (`14349bbd`) | New case `a DARK informational string stays the compact dark chip` — **RED before the change** (`expected <div data-qa="tooltip-body"> to be null`), green after. Chromium: `fixed/darkstring` **137×20 px** = `main` (was 176×43 with the inner light card). |
| **B3** the false count | `AppTooltip.tsx:48-56` now carries the per-site classification (three strings: FavoritesFilter light; DatasetStructureItem + LinkedColumn dark; twelve elements). PR #1889's body rewritten — the "fifteen" sentence is gone, the classification and the main / first-cut / fixed table are in. (`14349bbd`) | `grep "ifteen call sites pass a bare string"` on the live PR body → absent (checked on the PATCH response). Commit `7679099b`'s own message still says fifteen: rewording an intermediate commit needs a force-push of a bot-owned branch, which the reviewer did not judge worth the destructive action for a squash-merged PR — the squash takes the PR body, not that message. Stated here so the fresh reviewer does not rediscover it. |
| **B4** the doc line | documentation#117 (draft, base `release/1.0.0`, off the #116 merge `2ab02d4`): `search.md:158-160` names the box by its placeholder — "for anything else, the **Pick two dates** box beneath them opens a calendar that takes any two days." `git grep "Custom range"` on the train → 0 after. | PyYAML parses; `description` 194 chars; wrap within 120. `backlog/docs/DOC-529` release-gate line now requires the live page to contain "Pick two dates" and NOT "Custom range". |
| **F1** orphan key | `"Custom range"` removed from all seven catalogs (`:717`); `RecentlyViewedFilter.test.tsx` empty-history case asserts `queryByPlaceholderText('Pick two dates')` is null instead of the vacuous label check. (`1a5cd769`) | 733 keys × 7, set-difference vs `en` empty both ways; `i18n-key-parity` suite green (17/17). |
| **F2** no gate | Two commits. **On origin (`36feb82f`)**: `odd-platform-ui/build.gradle` registers `testUI` (PnpmTask, `dependsOn pnpmInstall`, `run test:ci`) on the node-gradle toolchain `buildUI` already pins (node 24.13.0, pnpm 9.12.3); `package.json` `test:ci` = `pnpm generate && vitest run`. **Held locally (`9af0cf86`, one file)**: `run-pr-tests.yaml` gains `run_ui_tests` → `./gradlew odd-platform-ui:testUI --no-daemon` (checkout / gradle cache / JDK exactly as `run_tests`). GitHub rejected the App's push of it: *"refusing to allow a GitHub App to create or update workflow `.github/workflows/run-pr-tests.yaml` without `workflows` permission"* — an ACCESS blocker, not a code one. **Maintainer action (30 s):** GitHub → Settings → Developer settings → GitHub Apps → odd-contributor → Permissions & events → Repository permissions → **Workflows: Read and write** → save, then accept the permission update on the opendatadiscovery installation; the agent then pushes `9af0cf86` (or push it yourself from `../odd-platform-ctrib067`, where it is the branch head). | The identical invocation run locally with JDK 17: nodeSetup → pnpmSetup → pnpmInstall → codegen (docker) → vitest — **44 files / 269 tests passed, BUILD SUCCESSFUL in 7m12s**, working tree unchanged after (no lockfile / codegen strays). CI on `36feb82f`: the pre-existing six checks **6/6 success** (`Test Results`, `run_tests`, `run_playwright_tests/{test,lint,format-check}`, `update_release_draft` — VERIFIED via `GET /commits/36feb82f/check-runs`); `run_ui_tests` first runs when `9af0cf86` lands. |
| **F3** timeouts | `vite.config.ts` `test.testTimeout: 20_000` with the measured rationale; the picker suite's per-case `INTERACTION_TIMEOUT` and its comment removed (the global budget carries it). (`36feb82f`) | Full suite **269/269 green** through the gate above (was 258 passed / 10 timed out at `c5b51743`, 255 / 7 on `main`). |

Also verified on the rework tree: the affected 11-file set **75/75** (was 74 + the new dark case); `prettier --check`
and `eslint` clean on every touched tree; the two picker cases unchanged and still RED on `main` per the round-1
re-run. jsdom **cannot** pin the width half of the tooltip contract — probed: `getComputedStyle` on the popper's
`.MuiTooltip-tooltip` returns MUI's own `300px`, not the styled-components descendant rule — so the test file
says so and points here rather than carrying a fake assertion.

Out of scope and left alone, stated so nobody re-derives it: the Playwright e2e in `odd-platform/tests/` is also
not run by CI (`run-playwright-tests.yml:61-73` commented out) — pre-existing, not touched by this PR, and not the
suite the goal-completion cases live in.
