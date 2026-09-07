---
id: PLT-269
title: "Every date in the UI renders in English on every locale -- useAppDateTime never passes a date-fns locale"
target_repo: odd-platform
issue_type: bug
status: filed            # FILED 2026-09-07 as odd-platform#1886 by odd-contributor[bot] during CTRIB-067 Phase D,
                         # with NO milestone (release planning is the maintainer's - G-C11). Read back publicly:
                         # 52 body lines, both labels applied, zero workspace-internal ids.
severity: medium
discovered_during: "CTRIB-067 / #1844 ST-10 -- the Last-viewed facet's pixel review under `ua` (the chip read 'від 1 Sep 2026' beside a calendar reading '1 вер.')"
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1886"
github_issue_number: 1886
found_date: "2026-09-07"
user_facing_verified: true   # seen in a rendered `ua` screenshot on a running stack, then traced to the hook
suggested_milestone: ""      # none -- release planning is the maintainer's (G-C11)
filed_title: "Dates render in English on every locale (useAppDateTime passes no date-fns locale)"
filed_labels: "kind: bug, scope: frontend"
ascii_exception: >-
  The body is ASCII except for two lines that QUOTE the rendered Ukrainian text. That is the documented
  native-language exception (issues/README.md; memory reference_issue_drafts_ascii_only, PLT-213): the mixed
  language IS the evidence, and transliterating it would delete the finding.
---

## Summary

The platform ships a seven-language UI, and every **date** in it is formatted in English regardless of the
active language. The label next to a date is translated; the date itself is not.

## What was seen

Driven on a running stack with the UI language set to Ukrainian: a filter chip read

    Останній перегляд: від 1 Sep 2026

directly beneath a calendar that read `1 вер. ~ 7 вер.` and preset links reading `Сьогодні` / `Останні 7 днів`.
Every word around the date is Ukrainian; the month is English.

The same holds anywhere a date is rendered -- entity detail headers, the "last viewed" markers, alert
timestamps, dataset-structure versions, quality-test runs, activity rows.

## Cause

`odd-platform-ui/src/lib/hooks/useAppDateTime.ts` formats every date through `formatInTimeZone(date, tz,
pattern)` from `date-fns-tz`. `date-fns` defaults to **en-US** when no `locale` option is supplied, and the hook
never supplies one -- so the fourteen named patterns it exposes (`dataEntity`, `alert`, `activity`,
`qualityTest`, ...) all render English month and day names in every locale. The related
`formatDistanceToNow` / `formatDistanceStrict` / `formatDuration` re-exports have the same gap, which is why a
list row says "Viewed 6 minutes ago" under a Ukrainian UI.

## Why it matters

A partially translated screen reads as a half-finished translation, and it is the half a translator cannot fix:
the strings are all in the catalogs and pass a key-parity check, so nothing in the existing i18n tooling
surfaces this. It is only visible by looking at a rendered page in a non-English language.

## Suggested fix

Resolve a `date-fns` locale from the active language once and pass it to every `format*` call in the hook. Two
things to get right, both already solved elsewhere in the codebase:

1. **Three of the seven catalog keys are not valid language tags.** `br` is Brazilian Portuguese (the bare tag
   means Breton), `ch` is Chinese, `ua` is Ukrainian (a country code). A map is needed; one already exists at
   `odd-platform-ui/src/components/shared/elements/AppDateRangePicker/calendarLocale.ts`, which hit exactly this
   when giving the date-range calendar its month names.
2. `date-fns` locales are separate imports (`date-fns/locale/uk` etc.); importing all seven is small, but they
   should be selected by the same map so the two surfaces cannot drift.

A test that renders one dated surface under a non-English language and asserts the month name is not English
would keep it fixed -- a catalog-parity check cannot.

## Scope note

This is app-wide and pre-existing; it is not introduced by any one feature. The Last-viewed filter chip that
surfaced it formats its own dates through `Intl` in the meantime, so that one surface is correct today while the
rest of the app is not.
