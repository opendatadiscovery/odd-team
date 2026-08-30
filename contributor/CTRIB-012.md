---
id: CTRIB-012
github_issue_number: 1751  # PLT-215 (filed) — the i18n missing-keys issue this fix rides. CONFIRM milestone at GATE 1.
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1751
class: bug  # cross-cutting i18n regression (foreign-language leak) + the deterministic prevention guard
milestone: "0.28.0"  # VERIFIED 2026-06-14 via GitHub — #1751 is OPEN with milestone 0.28.0 (G-C11 satisfied). The leak is UNRELEASED (root cause 8b0155f7 in no tag); the fix ships in 0.28.0 so it never reaches users.
status: done   # GATE 1 + GATE 2 done 2026-06-14 — PR #1783 squash-merged to odd-platform main (9c6fb074). Delivered fallbackLng:'en' + en.json +70 keys + guard test (maintainer merged the draft fast; the IT was scoped, not blocking). IMPORTANT: #1783 over-claimed "Closes #1751" — it did en+guard+leak, NOT the per-locale TRANSLATION (each non-en catalog missing 84 of en's 505 keys, ~500 strings). #1751 REOPENED 2026-06-14 (issuecomment-4701762200); PLT-215 tracks the translation; PLT-011 (fallbackLng) closed-resolved. | LEDGER-RECONCILED 2026-08-30: was `merged`; PR #1783 (`9c6fb074`) is in the released `0.28.0` tag (published 2026-06-17). GATE 2 is done; `/review release:0.28.0` owns the flip to `done`. | RELEASE-GATE 0.28.0 (2026-08-30): fix confirmed inside the released `0.28.0` tag; the paired doc item(s) live-verified on docs.opendatadiscovery.org; full unit+IT suite and real-instance checks satisfied by the 0.29.0 release record (superseding published artifact ghcr digest a2e0c86d, unit BUILD SUCCESSFUL @ f12b8fbc, feature-complete 317/1, known-bugs 3-expected-RED).
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1783"  # DRAFT, author odd-contributor[bot], 2026-06-14
pr_draft: true
issue_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1751#issuecomment-4701630189"  # root-cause + scope (post-GATE-1)
contrib_branch: "contrib/CTRIB-012-i18n-fallback-leak-guard @ 8fe7faca (odd-platform)"
base: "odd-platform origin/main @ 3e182fca (br fallback leak present — verified)"
backlog_mirror: "PLT-011 (reopened, high) + PLT-215 (escalated, high)"
reproduced: "Static + deterministic (no runtime dependency), verified 2026-06-14: `git show 0.27.13:odd-platform-ui/src/locales/i18n.ts` = `fallbackLng: ['en','es','ch','fr','ua','hy']` (no br) and `git cat-file -e 0.27.13:.../br.json` = ABSENT -> at 0.27.13 `t('Search by name')` rendered the raw English key; on `main`, `8b0155f7` (#1564) inserted `br` into the chain + added `br.json` with that key -> i18next `[active,en,es,br,...]` resolves the en-missing key at br -> 'Buscar por nome' for every locale. Impact script (keys in br-en intersect t('literal') sites) = 4 rendered strings. Running-system half: open the UI at any non-br locale -> the DQ filter placeholder reads Portuguese (the IT in Part 4 is the RED proof on `ref:main`)."
adr_required: false  # no architectural change. fallbackLng:'en' is a non-breaking render fix (missing key -> English key, strictly better); en.json additions are additive (natural-keys); the CI guard is additive tooling. Conforms to the existing i18n natural-keys pattern. G-C7 does not fire.
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-14 — 'Approve — implement now' via AskUserQuestion; guard default = en-completeness-fails + catalog-divergence-warns, accepted as written)"
plan_approved_at: "2026-06-14"
---

# CTRIB-012 — i18n foreign-language leak: en-incomplete catalog + `br` in the fallback chain renders Portuguese to all users; install the deterministic prevention (root cause #1564 / `8b0155f7`)

> **STATUS: GATE-1 PLAN — awaiting maintainer approval. No code written. No branch. No PR.** Per the
> contributor pillar (G-C3), code begins only after the maintainer approves this plan.

## Root cause (verified — see `reproduced`)

`t('Search by name')` (and `Query` / `Query examples` / `Relationships`) are keys `en.json` does not define.
Commit `8b0155f7` ("feat brazilian portuguese translation", #1564) added `br.json` **and inserted `br` into**
`fallbackLng: ['en','es','br','ch','fr','ua','hy']` (`odd-platform-ui/src/locales/i18n.ts:32`). i18next
resolves `[activeLang, en, es, br, ...]`; a key absent from `en` (and `es`) but present in `br` resolves at
**`br` -> Portuguese for every locale.** Regression vs 0.27.13 (`ede5d277`, no `br`). Scripted blast radius:
**4 rendered strings** (`Search by name`, `Query`, `Query examples`, `Relationships`). UNRELEASED -> ships
0.28.0 unfixed. Full case-law: `retrospectives/LSN-036`.

## The plan (GATE-1 artefact)

Branch `contrib/CTRIB-012-i18n-fallback-leak-guard` off `origin/main`. **Four parts, one cohesive class-fix:**

| # | Change | File | Why |
|---|--------|------|-----|
| 1 | `fallbackLng: ['en','es','br',...]` -> `fallbackLng: 'en'` | `odd-platform-ui/src/locales/i18n.ts:32` | **Structural floor.** A fallback chain routed through *other* locales IS the leak; with `'en'`, an en-missing key renders the English key, never a foreign language. Non-breaking (the locale list was mis-used as `supportedLngs`; selectable-locale validation is separate at `i18n.ts:25`). Subsumes the reopened **PLT-011**. |
| 2 | Add the en-missing `t('literal')` keys to `en.json` (natural-keys: value === key, then proper English) | `odd-platform-ui/src/locales/translations/en.json` | So the 4 leaking strings (and the rest of PLT-215's ~70) render proper English + become translatable. Required for Part 3 to pass on merge. |
| 3 | **CI key-parity guard**: a small script (node/python) that extracts `t('...')` literals from `src/**` and **fails the build** when any is absent from `en.json`; **warns** (not fails) on catalog-to-catalog divergence | `.github/workflows/*` (wire into the existing PR test job) + a script under `odd-platform-ui/` | **The prevention.** Makes "en incomplete" un-mergeable — the precondition for the whole leak class. Would have failed #1564 at CI. Free + self-hosted (no-budget constraint). This is **PLT-215 #2** and the lead deliverable. |
| 4 | **i18n-leak IT** — extend the existing `multilingual-i18n.spec.ts` to assert the affected surfaces (DQ filter placeholder / DataModelling labels) render English (or the active language), NOT a `br` string, under a non-`br` locale | `integration-tests/e2e/specs/multilingual-i18n.spec.ts` (odd-team) | The behavioural regression guard. RED on `ODD_SUT=ref:main` (renders Portuguese), GREEN on the fix. |

### Scope EXCLUSIONS (G-C5)
- **No full 7-catalog translation pass.** Part 2 completes `en.json` (the leak precondition); translating all
  ~70 keys into es/fr/br/ua/hy/ch is the rest of PLT-215, a separate effort. The guard's strict catalog-parity
  mode stays **warn-only** until then (so the build doesn't break on the existing divergence).
- **No change to `br.json` or the br translations** (#1564's content is correct; the bug is the fallback wiring).
- **No removal of `br` as a selectable locale** — Brazilian users keep Portuguese; the fix only stops br
  leaking to *non-br* users.
- **No CTRIB-011 overlap** — that relabel is correct and already `review-ready`; this is a disjoint surface.

## Design before build (G-C12)
- **Reuse-scan:** (a) `fallbackLng:'en'` is the i18next-documented idiom — no new mechanism; (b) the **i18n-leak
  IT reuses the EXISTING `multilingual-i18n.spec.ts`** harness (do not author a new spec); (c) the natural-keys
  convention is the established en.json pattern; (d) the CI guard wires into the **existing** PR test workflow,
  no new infra. Net-new = one small parity script (justified: there is no existing key-parity check — its
  absence is the root cause).
- **ADR-check:** no ADR governs i18n key/fallback config; conform to the natural-keys pattern. `adr_required:
  false` (non-breaking render fix + additive tooling). G-C7 does not fire.
- **Impact checklist:** i18n (en.json + the IT) — handled; generated clients — none (FE-only); every consumer
  of `fallbackLng` — one (`i18n.ts`); migration — none; docs — the `multilingual-ui` "renders raw English"
  caveat is wrong for the br-only keys and must be corrected when this ships (paired DOC item, release-train);
  ontology — F-043 multilingual facet re-enrich (the "missing-key drift" cardinality + the fallback-leak).
- **PO/SRE lens:** a non-English operator seeing random Portuguese on the DQ dashboard reads as a broken
  product; the fix restores language coherence and the guard makes it stay fixed.

## Tests (G-C2 / G-C9, both buckets)
- **Unit/CI:** the **key-parity guard** itself is the deterministic gate (build-time); RED today (4+ keys
  missing from en), GREEN after Part 2. Plus the existing FE vitest/lint/tsc must stay green.
- **Integration:** the extended `multilingual-i18n.spec.ts` IT — RED on `ODD_SUT=ref:main` (Portuguese),
  GREEN on the working-tree SUT. Full 4-suite regression at implement AND review (G-C2).

## Milestone / clarify (G-C11 / G-C6)
- **G-C11 — SATISFIED (verified 2026-06-14):** the fix rides issue **#1751** (PLT-215), which is **Open** with
  an **open `0.28.0` milestone** (WebFetch). No hard stop; the leak ships in 0.28.0 if unfixed, so this rides
  the same train.
- **G-C6 clarify:** none warranted. The one design choice — guard strictness — defaults to **en-completeness
  fails + catalog-divergence warns** (un-breaks the build given the existing ~70-key divergence). Confirm or
  override at GATE 1.

## What GATE-1 approval authorises
The four-part change above, bounded to these files, on a fresh `contrib/CTRIB-012-*` branch, with the scope
comment posted to #1751 (the fix extends PLT-215's stated scope with `fallbackLng:'en'` + the guard as the
lead). Then: code -> the two test buckets -> docs (the multilingual-ui caveat correction, release-train) ->
ontology refresh -> draft PR (GATE 2 = human merge).
