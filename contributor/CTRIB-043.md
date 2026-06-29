---
ctrib: CTRIB-043
github_issue_number: 1816
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1816
title: "Recently Viewed — detail-header recency shows the absolute open time (tz + offset), not '0 seconds ago'"
class: feature-followup
milestone: "1.0.0"
status: in-progress         # code+tests+docs DONE + VERIFIED locally (tsc, vitest 2/2, IT-149 RED→GREEN, full regression green-for-change, train doc); the public push + DRAFT PR is GATED on the maintainer's go-ahead (auto-mode blocked the upstream write 2026-06-29).
reproduced: "maintainer found in the running UI (2026-06-29): the detail-header recency marker shows 'Viewed 0 seconds ago' — the detail page records-on-open so lastViewedAt ~ now; the relative time is always ~0 and resets on every refresh (no information). Confirmed by code: RecentlyViewedTag renders formatDistanceToNowStrict(lastViewedAt)."
adr_required: false         # presentation refactor; conforms to the shipped RV foundation (same basis as CTRIB-041/042)
tracking: "maintainer-directed follow-up to #1816 (CTRIB-042 precedent); no new GitHub issue; PR refs #1816 (already closed by S2)"
plan_approved_by: "RamanDamayeu (maintainer) — direct in-session directive 2026-06-29 (exact UX specified: absolute time, browser tz + explicit offset, UTC fallback, detail page only)"
plan_approved_at: "2026-06-29"
docs_routing: "release/1.0.0 (recently-viewed.md update @ 891ed14)"
pr_url: "NOT PUSHED — branch contrib/CTRIB-043-recently-viewed-detail-absolute-time @ bf8e98f4 committed locally; PR body ready (contributor/CTRIB-043-pr-body.md); awaiting maintainer go-ahead to push + open the DRAFT PR (Part of #1816)"
pr_draft: false
stream: ctrib043
started: "2026-06-29"
---

# CTRIB-043 — Recently Viewed: detail-header absolute open time (#1816 follow-up)

## Maintainer feedback (the defect)

Found in the running UI after CTRIB-042 merged: the **detail-page** recency marker shows a static
**"Viewed 0 seconds ago"**. The detail page **records the asset on open**, so `lastViewedAt ≈ now`; the
relative form is therefore always ~0 and resets to 0 on every refresh — no useful information. The maintainer
asked to instead show the **absolute timestamp of the last open**, in the **user's browser timezone with an
explicit offset** (fallback UTC), so a user with many open tabs can tell **when** each asset was opened and
navigate back to the one they want.

(The list-surface column — [[CTRIB-042]] — is fine; only the detail-header form is the defect.)

## GATE 1 — APPROVED (2026-06-29, maintainer in-session directive)

The maintainer specified the exact behaviour ("show timestamp of last open in user's browser timezone with
explicit offset mentioned and fallback to UTC") and directed "fix in the current session" — that is the plan
approval. Scope decided (and recorded as the explicit exclusions):
- **Detail headers only** (Data Entity / Term / Query Example) switch to the absolute form.
- **List surfaces + the home panel keep the relative "x ago"** — there recency genuinely varies and is
  meaningful (you did not just open those), so the relative form is correct there. NOT touched.

## Design-before-build (reuse)

- The platform date hook `useAppDateTime` already wraps `date-fns-tz` `formatInTimeZone` with the browser
  IANA timezone — **REUSED**. Added one formatter `dateTimeWithTimezone` (the platform date-time pattern +
  `'UTC'xxx` explicit offset; `try/catch` → UTC fallback). No new date dependency, no new component.
- `RecentlyViewedTag` (the shared cross-surface marker, reused unchanged by CTRIB-042) gains one prop
  `absoluteTime` selecting the absolute form; the default stays relative — so the lists/panel are untouched.
- 3 detail-header call-sites opt in. No i18n key change (reuses the existing `"Viewed {{when}}"`).

## Implementation

Branch `contrib/CTRIB-043-recently-viewed-detail-absolute-time` @ `bf8e98f4` (off merged main `df70e7a0`;
same-name, never main; `@{u}` unset). Worktree `../odd-platform-ctrib043`. 6 files:
- `lib/hooks/useAppDateTime.ts` — the `dateTimeWithTimezone` formatter (browser tz + explicit `UTC±HH:MM`, UTC fallback).
- `components/shared/elements/RecentlyViewedTag/RecentlyViewedTag.tsx` — the `absoluteTime` prop.
- `components/DataEntityDetails/DataEntityDetailsHeader/DataEntityDetailsHeader.tsx` — opt in.
- `components/Terms/TermDetails/TermDetailsHeader/TermDetailsHeader.tsx` — opt in.
- `components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx` — opt in.
- `lib/hooks/__tests__/useAppDateTime.test.ts` — new unit test.

## Test ledger (DoD)

- **Unit FE:** `tsc --noEmit` GREEN (exit 0). New vitest `useAppDateTime().dateTimeWithTimezone` — **2 passed**
  (Node 24.13.0: the explicit-offset shape assertion + the fixed-instant stability assertion). The
  `recentlyViewed` slice test is unchanged.
- **Integration / IT-149 (extended):** added **test 3** — open a detail page, assert the header marker shows
  an absolute timestamp with an explicit UTC offset (`/UTC[+-]\d{2}:\d{2}/`) and NOT a relative "ago". Purely
  **additive** (tests 1+2 byte-unchanged — G-C15 safe). GREEN on the fix: run-confirmed **IT-149 spec 266
  PASS** on the ctrib043 SUT.
- **Full e2e regression** (`run-regression.sh ctrib043`, SUT from worktree @ `bf8e98f4`, digest `700bf851`):
  GREEN-FOR-CHANGE. **feature-complete 326 pass / 1 fail** — IT-149 **ALL THREE GREEN** (264 open→see, 265 the
  CTRIB-042 list column, 266 the new CTRIB-043 absolute detail time); the only fail = the unchanged co-stream
  `ctrib039gb` Group-B Description test (`favorites-star-see-loop.spec.ts:159`, #1815 — not mine). **known-bugs
  3-RED-expected / 0-unexpected-GREEN** (attachment-durability LSN-001, error-boundary F-042, quality-dashboard
  PLT-052).
- **RED proof — run-confirmed:** IT-149 on `ODD_SUT=ref:df70e7a0` (the pre-fix merged main, built fresh) →
  **2 passed / 1 failed**. Test 1 (open→see) + test 2 (the CTRIB-042 list column) PASS (both shipped in
  df70e7a0). **Test 3 FAILS** — Playwright: `Expected pattern: /UTC[+-]\d{2}:\d{2}/` · `Received string:
  "Viewed 0 seconds ago"` — i.e. the test reproduces the EXACT maintainer-reported defect on the base and is
  GREEN only on the fix (a real discriminator, not neutered). G-C15 surviving-RED ✓.

## Docs (G-C10)

`documentation@release/1.0.0` @ `891ed14` — `recently-viewed.md` now distinguishes the two surfaces: the
**detail header** shows the absolute open time (browser timezone + explicit UTC offset); the **list surfaces**
show "how long ago". Publishes at the 1.0.0 release gate.

## Ontology (G-C10)

No refresh — presentation-only change (no new/changed backend node); same basis as CTRIB-041/042.

## Status

`implementing` → regression GREEN + RED proof DONE (DoD met locally) → **push + DRAFT PR GATED on the
maintainer's go-ahead** (the public upstream write needs explicit approval) → `/review` (separate session) → GATE 2.
