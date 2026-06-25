---
id: IT-143
title: "The home main-search placeholder renders the translated hint under a non-en locale, not a literal key-gloss"
gates:
  validates: [F-141]
  enforces: []
  regresses: [PLT-221]
test_class: integration
stack: odd-minimal
automation: "e2e:specs/i18n-main-search-placeholder.spec.ts"
plan_ref: "I9"
status: ready
---

# IT-143 — non-en home main-search placeholder is a translated hint, not a key-gloss (F-141 / #1776)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The home page (`/`) MainSearch box is `Overview.tsx:47` `<MainSearch mainSearch />` (no `placeholder`
prop), so `MainSearchInput.tsx:71` renders `t('main search placeholder')`. `main search placeholder`
is the one **symbolic** i18n key (its en VALUE is the long search hint, not the key). Under a
non-English locale, the rendered placeholder must be a **translation of that hint**, NOT a literal
gloss of the KEY. If it FAILS, a non-English operator sees a meaningless literal ("main search space"
/ "main search pointer" / the word "placeholder" in Chinese) on the first surface they meet, and
never learns what the catalog search covers. IT-071 covers the EN placeholder; this is the non-en
complement. Source: odd-platform#1776 / PLT-221 (CTRIB-036).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reuse the shared stack (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: none. The MainSearch box renders once the home skeleton lifts (identity + the
  popular-tags fetch), which resolves on an empty catalog — no entity/tag seed is required.
- **Locale**: set in the browser before the app boots — `localStorage('i18nextLng') = '<locale>'`
  (`i18n.ts:24` reads it at init). The spec does this via `page.addInitScript`.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Skeleton-lift gate fires: `/` issues `GET /api/tags?page=1&size=30` (popular tags).

## 4. Run protocol
For each non-en locale (`es`, `ua` — Latin + Cyrillic representatives):
1. Set `localStorage('i18nextLng')` to the locale (before navigation).
2. Open `/`; wait for the popular-tags fetch (`GET /api/tags?...size=`) that lifts the skeleton.
3. Observe the MainSearch hero box's `placeholder`.

**Automated rail**: `integration-tests/run-suite.sh IT-143` (Playwright `e2e/specs/i18n-main-search-placeholder.spec.ts`).

## 5. What it checks — assertions
- **PASS** when: under each locale, the search-box placeholder contains the translated-hint fragment
  (`es` → "tablas de datos"; `ua` → "таблиць даних") AND the pre-#1776 literal-key gloss
  (`es` → "espacio para búsqueda principal"; `ua` → "основний покажчик пошуку") is absent.
- **FAIL** (the #1776 regression signature): the placeholder is the literal key-gloss (the hint
  fragment is not present) — the translator rendered the KEY, not the en VALUE.

## 6. Result log
Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · runner · outcome (PASS|FAIL) · evidence (captured placeholder) · notes`.

## Cross-references
- Source: F-141 (Overview home) · odd-platform#1776 / PLT-221 (CTRIB-036) · sibling EN test IT-071.
- Unit complement: `odd-platform-ui/src/locales/__tests__/i18n-key-parity.test.ts` (the symbolic-key
  hint guard — all six non-en catalogs, structural).
- Plan: `lineage/odd-platform/test-plan.md` batch I9.
