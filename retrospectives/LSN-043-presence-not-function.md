---
id: LSN-043
title: "Rendering is not working — presence-shaped evidence (a screenshot, a render assertion) was accepted as proof that a control functions"
date: 2026-09-08
gates: [G-C12, G-C13, G-C15, G-C20]
source: "CTRIB-067 / odd-platform#1888 (ST-10 of #1825), reported by the maintainer on a merged main; fixed in #1889"
---

# LSN-043 — presence is not function

## What shipped

`odd-platform#1888` merged to `main` with two user-facing defects that the maintainer hit within minutes:

1. **The date range could not be picked.** `AppDateRangePicker` is a CONTROLLED calendar. The slice made
   `defaultRange` optional (correct — a facet with no window must not display a range it is not applying)
   but shipped the controlled value as `value={rangeStart && rangeEnd ? [rangeStart, rangeEnd] : []}`.
   Picking the first of two dates leaves `rangeEnd` undefined, the expression collapses to `[]`, and the
   calendar discards the click. The second click is a first click again; a two-date range can never be
   completed. **This broke every consumer** — the control also drives the shipped Activity and Alerts
   Period filters.
2. **The help tooltip rendered as one unwrapped line straight across the results table.** The "light"
   popper ships `padding: 0` + `maxWidth: 'unset'`, so a bare-string title has nothing to wrap against.

Both passed: CI, a "pixel review", the full four-suite regression, and a separate-session `/review`.

## Root cause — one cause in three costumes

**Every gate asserted PRESENCE and none asserted FUNCTION.**

- `AppDateRangePicker` had **no test file of its own**. The suite the ledger sold as its "behaviour-diff
  guard for its two shipped consumers" asserted the input's displayed value, its placeholder, and the
  language of the month names. **Not one case ever clicked a day.** A date picker's single job was untested.
- The pixel review **photographed** the control instead of **operating** it: the ledger lists screenshots of
  "the facet open, the picker popup, the chip, the sort control". A screenshot cannot show that the second
  click is discarded, and cannot show a tooltip is 1264px wide until you hover it and measure.
- `/review` read the test NAMES and the ledger's claim and counted the control as covered. It also read the
  offending `value={...}` line in the diff without walking the control's intermediate state.

## The aggravating fact

`playbooks/design-before-build.md` step 5 **already said it, verbatim**, before this slice was written:

> "A tooltip with no background and an unwrapped one-line wall of text 'works' and is still a defect you
> would be ashamed to show a user (LSN-035, the second instance). If you reuse a styled pattern, reuse its
> **content container** too … a bare string in a styled wrapper renders raw."

And `AppTooltipStyles.tsx` carried the same warning in its own comment, naming LSN-035. **Fifteen call
sites pass a bare string anyway.** A rule that is prose in a playbook and a comment in a file is advisory;
it is obeyed by whoever happens to read it. The slice screenshotted, satisfied the letter of "look at the
rendered result", and shipped the exact defect the paragraph describes.

**A lesson that recurs means its previous fix was advisory. Convert it into a default, a lint rule, or a
test — never another paragraph.**

## The rules this installs

1. **Goal-completion test (G-C20).** An interactive control requires at least one case that completes the
   user's goal THROUGH the control (click → click → commit) and asserts what it hands back — and that case
   must be RED on the pre-fix system. Rendering assertions stay necessary and stop being sufficient.
2. **The pixel gate OPERATES and MEASURES (G-C12 step 5).** For each interactive control the change
   touches: perform its primary interaction and record the observable output. For each tooltip / popover /
   overlay: hover it and record the measured bounding box. "A screenshot was reviewed" is not evidence.
3. **Shared-element consumer sweep.** Changing a shared component ⇒ enumerate its consumers and drive each
   one. Two shipped surfaces broke here and neither was opened.
4. **Fix the class in the element.** When a shared element makes the wrong usage the default, fix the
   element so the correct rendering is automatic; do not wrap the one call site.
5. **Review reads assertions, not names.** For a control change the reviewer names the case that performs
   the interaction and opens it. A ledger's description of a suite is not evidence of what it asserts.

## Fix

`odd-platform#1889` — the controlled-value fix (+ 3 goal-completion cases, 2 RED on merged main),
`AppTooltip` wrapping a plain-string informational title in the shared body itself + a 360px popper floor
(+ 3 cases), and the rail's help split into records, presets moved above the calendar, chip wrapped.
Measured after the fix in a real browser: the tooltip is 360x135px; two clicks + Done produce
`?viewed_after=…&viewed_before=…` and a chip naming the full window.
