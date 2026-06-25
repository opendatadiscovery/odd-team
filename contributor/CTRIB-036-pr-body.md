# fix(i18n): translate the main-search hint value in 6 locales + 3 pt-BR value fixes

Closes #1776

## Root cause

The i18n catalogs use **natural keys** (the key *is* the English text), with one **symbolic**
exception: `main search placeholder`, whose English value is the home-page search hint
(`Search data tables, feature group, jobs and ML models via keywords`), not the key. Working from the
key list alone, all six non-English translators rendered the **key's words** instead of the value, so a
non-English operator saw a meaningless literal on the first surface they meet:

| locale | was | back-translation |
|---|---|---|
| es | `espacio para búsqueda principal` | "main search space" |
| fr | `espace de recherche principal` | "main search space" |
| ch | `主搜索占位符` | the i18n word "placeholder" |
| ua | `основний покажчик пошуку` | "main search pointer" |
| hy | `հիմնական որոնման փոխարինող` | "main search substitute" |
| br | `local de busca principal` | "main search location" |

The render path is single-hop and user-facing: `Overview.tsx:47` `<MainSearch mainSearch />` (no
`placeholder` prop) → `MainSearchInput.tsx:71` `placeholder ?? mainSearchPlaceholder` → `t('main search placeholder')`.

## Change

- **Six `main search placeholder` values** translated to the English hint. Brazilian Portuguese uses the
  value suggested in the issue; `es`/`fr`/`ua`/`ch`/`hy` are best-effort — **native-speaker review is
  welcome**, especially Chinese and Armenian (they are unambiguously better than the current literals).
- **Three pt-BR (`br.json`) value defects** from #1564: `Toal de entidades` → `Total de entidades`; the
  gender agreement `excluir esta rótulo` → `excluir este rótulo`; `History` → `Histórico` (matching the
  existing `Ocultar/Mostrar histórico`).
- **A new i18n build guard** (`i18n-key-parity.test.ts`): for a symbolic key, every non-English value
  must be a translated hint (a multi-item list), not a literal key-gloss.

## Scope — deliberately **not** in this PR (see the scope comment on the issue)

- The Label / Tag → Etiqueta / Rótulo terminology split (both render `Etiqueta` on some screens). Needs a
  Brazilian-Portuguese decision (@fredguth), tracked as a follow-up.
- A generalised value≠key prevention lint. The issue's proposed `value == key` check would not catch this
  class (the broken values are translations *of* the key, never literally equal to it); it needs design.

## Verification (the running system, not the diff)

- **Unit (vitest):** the new guard fails on the pre-fix catalogs (6 per-locale) and passes on the fix;
  the suite is 16/17 (the lone red is a pre-existing, unrelated guard false-positive on `LinkedTermsList.tsx`).
- **Integration (Playwright, odd-team IT-143):** loads the home page under `es` and `ua`, asserts the
  search placeholder is the translated hint and the old key-gloss is gone — GREEN on this build, RED on
  the pre-fix base. Runs in the `feature-complete` browser suite (full FE regression green; backend
  `multi-stack`/`ingestion-e2e` buckets are unaffected by a locale change and were not run).

## Docs

`Docs: documentation@release/0.29.0 — publishes with the 0.29.0 release.` The Multilingual UI page is
updated to document the value-correction class + the third guard (it previously listed two and described
the natural-keys pattern as universal).

Milestone: 0.29.0
