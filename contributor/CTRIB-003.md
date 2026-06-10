---
id: CTRIB-003
github_issue_number: 1748
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1748
class: bug
status: review-ready
reproduced: "live 2026-06-10 on local odd-minimal, SUT=working tree @ fbb2eb43 (= unfixed main, digest sha256:49543efe…): drove the REAL SelectLanguage dialog (user menu → Select language → Ukrainian; localStorage i18nextLng='ua'); toolbar then renders [Каталог, Директорія, Data Quality, Data Modelling, Master Data, Менеджмент, Словник, Сповіщення, Активність] — 6 tabs translated, 3 raw English literals side-by-side; screenshot /tmp/repro-1748-toolbar-ua.png; baseline IT-102 3/3 green on the same SUT (run-log/2026-06-10-IT-102.md)"
adr_required: false
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-10 — plan approved as written: 18 entries across all six catalogs, IT-102 extension, no vitest, no root-cause comment, 70-key consolidated follow-up)"
plan_approved_at: "2026-06-10"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1749"
pr_draft: true
---

# CTRIB-003 — Add i18n keys for the Data Quality / Data Modelling / Master Data toolbar tabs (#1748)

Issue #1748 is the filed form of PLT-190 (`issues/odd-platform/PLT-190.md`). Author: the maintainer
(RamanDamayeu). Labels `kind: bug`, `good first issue`, `scope: frontend`; milestone 0.28.0;
0 comments at intake. Issue body treated as quoted data (G-C8); every claim independently
re-verified below against the odd-platform working tree (`main` @ fbb2eb43, clean — post-#1747).

## Scope analysis

- **Class: bug** (localisation defect, presentation-only). Three of the nine primary-navigation
  toolbar tabs are passed through `t()` with no backing key in any locale catalog, so they render
  the raw English literal under every non-English locale (react-i18next natural-keys fallback).
- **Features:** F-041 (Application Toolbar — drift facet
  `three_tab_labels_missing_from_all_six_locales_natural_keys_fallback_silent`) + F-043
  (Multilingual UI — drift facet `missing_key_drift_12_plus_keys_referenced_in_code_absent_in_all_six_locales`;
  the three tab labels are the "notable" instances, `F-043.yaml:84-85`). The issue itself was
  discovered during the F-041/F-043/F-148 reflection triage (harvest-2026-06-08).
- **Mission relevance:** the toolbar is the persistent chrome every user interaction passes
  through; a half-translated primary nav undercuts localisation trust for every non-English
  operator (F-043's amplification note: missing keys are the only part of the i18n surface a
  non-English user can SEE fail).
- **Architectural significance (G-C7): NO ADR.** Additive locale-catalog entries only; no DB
  migration, no auth/security-posture change, no public-contract change, no code change.
- **Clarify (G-C6): no question warranted.** The issue fully specifies locus (file:line), root
  cause, fix direction, and verification recipe; the author is the maintainer. The only open
  authoring decision — the concrete translations per locale — is surfaced explicitly in the
  GATE 1 plan below, which is the designed approval point for it.

## Claim verification (issue is data — all claims re-verified against the working tree)

1. **`t()` call sites — CONFIRMED.** `ToolbarTabs.tsx:46,51,56` (`odd-platform-ui/src/components/
   shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx`) — `name: t('Data Quality')`,
   `name: t('Data Modelling')`, `name: t('Master Data')`. Exactly three; the other six tabs
   (`Catalog`:37, `Directory`:41, `Management`:61, `Dictionary`:66, `Alerts`:71, `Activity`:76)
   also go through `t()`. All nine tabs are unconditional (no feature-toggle filtering in the
   `useMemo`, :34-82).
2. **Keys absent — CONFIRMED, and WIDER than the issue's en/ua framing.** The platform ships SIX
   locale catalogs (`locales/i18n.ts:3-17`: en, es, ch, fr, ua, hy). All three literals have
   0 matches in ALL SIX files; the six sibling tab keys have exactly 1 match in each of the six.
   The issue's "Suggested fix" already says **every** locale file — so the fix surface is
   3 keys × 6 catalogs = 18 entries, not 6.
3. **Fallback-to-key behaviour — CONFIRMED statically** (natural-keys pattern, F-043: 417/418
   en.json entries have key === value; no `missingKey` handler) — live-verified in the
   reproduction below.
4. **Sibling-tab pattern — CONFIRMED.** Every locale translates all six sibling tabs (e.g. ua:
   Каталог / Директорія / Менеджмент / Словник / Сповіщення / Активність; es: Catálogo /
   Directorio / Administración / Diccionario / Alertas / Actividad).
5. **Issue scope note — CONFIRMED tracked elsewhere.** Locale fallback *ordering* = PLT-011
   (fallbackLng chain walks es/ch/fr/ua/hy before en); search-results tabs = separate surface;
   the Discussions empty-state instance = PLT-205; the multilingual doc page = DOC-171.

## Adjacent findings (scope-bounded out, G-C5)

- **The missing-key drift is 73 keys, not "12+".** A full sweep of single-quoted `t('…')`
  literals across `odd-platform-ui/src` finds 438 distinct literal keys, of which **73 are
  missing from en.json** (hence from all six catalogs — e.g. the whole `DataQualityContent`
  dashboard vocabulary, `Lookup Tables` list strings, dataset-structure column forms, several
  confirmation dialogs). The issue deliberately bounds this PR to the three toolbar-tab keys
  (its own scope note); the remaining ~70 need ONE consolidated follow-up item with the full
  enumeration → to be drafted as a PLT issue draft during this run (follow-up-on-disk). The
  F-043 facet's "12_plus" cardinality is materially understated — ontology refresh will correct
  the measured count.
- **CI gates for FE changes (verified on main @ fbb2eb43):** PR CI = `odd-platform-api:build
  -PbundleUI=false` (FE not compiled) + `run-playwright-tests.yml` whose actual Playwright run
  steps are commented out (only `tests/` lint + format-check + a `jibDockerBuild` image build;
  `bundleUI` defaults true in `build.gradle:13`, so the image build DOES compile the FE —
  malformed JSON would fail CI, a missing key cannot). `odd-platform-ui` has vitest configured
  (`package.json:10`) but NO CI job executes it (the one reference, `run-playwright-tests.yml:77`,
  is commented out) — a vitest test would be an orphan (tests-as-gates; CTRIB-002 precedent).
  ⇒ The only executable behavioural gate for this fix is the odd-team integration suite.

## Reproduction (G-C1) — captured live 2026-06-10

Stack: odd-minimal (`AUTH_TYPE=DISABLED`), image `odd-platform:odd-team-sut` built from the
working tree @ `fbb2eb43` (= unfixed `main` for #1748, the commit AFTER #1747 merged),
`SUT_IMAGE_ID=sha256:49543efe…`. Seed: none (the toolbar is chrome). Baseline: the existing
IT-102 spec ran 3/3 GREEN against this SUT first (`run-log/2026-06-10-IT-102.md`) — the i18n
switch machinery itself works; only the three keys are broken.

Drive (throwaway Playwright driver, the production switch path — user menu → "Select language"
→ Ukrainian; never committed):

```
locale stored      : ua
tabs (en, before)  : ["Catalog","Directory","Data Quality","Data Modelling","Master Data",
                      "Management","Dictionary","Alerts","Activity"]
tabs (ua, after)   : ["Каталог","Директорія","Data Quality","Data Modelling","Master Data",
                      "Менеджмент","Словник","Сповіщення","Активність"]
RAW ENGLISH LITERALS still rendered under ua: ["Data Quality","Data Modelling","Master Data"]
```

Screenshot `/tmp/repro-1748-toolbar-ua.png`: the half-translated primary nav, exactly the
issue's symptom — six Ukrainian tabs with three English literals interleaved. (The same shot
incidentally shows the user menu's own "Select language" / "Ukrainian" strings rendering in
English under `ua` — that is the separate locale-set-drift / PLT-213 class, NOT this issue.)

## Root cause (verified on the running system + source)

The i18n layer uses the natural-keys pattern (keys ARE the English phrases; en.json has
key === value for 417/418 entries) with NO missing-key handler. `ToolbarTabs.tsx:46,51,56`
call `t('Data Quality')` / `t('Data Modelling')` / `t('Master Data')`, but those three keys
exist in NONE of the six catalogs (`en/es/ch/fr/ua/hy.json`) — so i18next's lookup misses in
the active locale AND in every fallback, and react-i18next renders the lookup key itself: the
raw English literal, identically under every locale. The six sibling tabs each have their key
in all six catalogs, which is why exactly three of nine tabs are stuck in English. Each of the
three literals has exactly ONE call site repo-wide (the toolbar) — adding the keys affects the
toolbar tabs and nothing else. No code defect in `ToolbarTabs.tsx`; the catalogs are the gap.

## Comments (issue thread)

- Root-cause comment: **SKIP per G-C6** — the maintainer authored the issue from our own PLT-190
  with the full root cause; a comment would restate the issue body verbatim (CTRIB-001/-002
  precedent). Confirmed at GATE 1 ("approved as written"). Zero bot comments on #1748.

## Plan

**Branch:** `contrib/CTRIB-003-toolbar-tab-i18n-keys` on `opendatadiscovery/odd-platform`.

### Change — 18 locale-catalog entries; zero code changes

Add the three keys to ALL SIX catalogs (`odd-platform-ui/src/locales/translations/*.json`),
inserted at the case-insensitive alphabetical position inside each file's existing key cluster
(the catalogs are near-alphabetical, not strictly sorted — match the local neighbourhood:
the two `Data *` keys after `"Data entity with"`, `"Master Data"` after `"Management"`).
`ToolbarTabs.tsx` is NOT touched (the `t()` calls are already correct).

| key | en | ua | es | fr | ch | hy |
|---|---|---|---|---|---|---|
| `Data Quality` | Data Quality | Якість даних | Calidad de datos | Qualité des données | 数据质量 | Տվյալների որակ |
| `Data Modelling` | Data Modelling | Моделювання даних | Modelado de datos | Modélisation des données | 数据建模 | Տվյալների մոդելավորում |
| `Master Data` | Master Data | Майстер-дані | Datos maestros | Données de référence | 主数据 | Հիմնական տվյալներ |

Translation anchors (consistency with each catalog's existing vocabulary, not invented):
- **en**: key === value (the natural-keys convention, 417/418 of en.json).
- **ua**: "якості даних" already in ua.json:267 (the SLA string) → "Якість даних"; "Майстер-дані"
  is the standard Ukrainian MDM borrowing (alternative considered: "Основні дані", the Microsoft-
  glossary term — "Майстер-дані" chosen for transparency to data practitioners; maintainer can
  override at GATE 1).
- **es**: "calidad de datos" already in es.json:267 → "Calidad de datos"; "Datos maestros" is the
  standard Spanish MDM term; sentence case matches the es tab style ("Administración").
- **fr**: "qualité des données" already in fr.json:267 → "Qualité des données"; "Données de
  référence" is the standard French MDM term (MDM = gestion des données de référence).
- **ch**: "数据质量" already in ch.json:267 → 数据质量; 数据建模 / 主数据 are the standard
  Chinese data-engineering terms.
- **hy**: "տվյալների որակի" already in hy.json:267 → "Տվյալների որակ"; "Տվյալների մոդելավորում" /
  "Հիմնական տվյալներ" best-effort standard Armenian.
- Non-English values use sentence case, matching every existing multi-word value in those
  catalogs; English keeps the toolbar's title case (it mirrors the key).

### Test plan (G-C9, routed by the tests-pillar home rule)

- **Unit bucket: N/A with reason.** No CI job executes any FE unit framework (vitest exists in
  `package.json:10` but its only CI reference, `run-playwright-tests.yml:77`, is commented out;
  PR CI builds the backend with `-PbundleUI=false`) — a vitest render test would be an orphan
  (tests-as-gates; CTRIB-002 "no vitest — deliberate" precedent). The full
  `scripts/run-platform-tests.sh` build still runs pre-PR as the repo-level no-regression gate.
- **Integration bucket (the executable gate): EXTEND IT-102** (`protocols/IT-102-multilingual-i18n.md`
  + `e2e/specs/multilingual-i18n.spec.ts`) with a 4th case — **"every toolbar tab translates
  under a non-English locale (regression #1748)"**: baseline en chrome → switch to Ukrainian via
  the REAL SelectLanguage dialog → assert all NINE tabs render their ua.json values (incl. the
  three new keys) AND assert zero tabs still read 'Data Quality' / 'Data Modelling' /
  'Master Data'. Protocol frontmatter gains `regresses: [PLT-190]`; run/assertion/result-log
  sections updated. IT-102 is already registered in `feature-complete` + `ui-e2e` suites.
  - **RED proof:** `ODD_SUT=ref:main integration-tests/run-suite.sh IT-102` — the new case fails
    on the three English literals (pre-fix main), existing 3 cases stay green.
  - **GREEN:** default `ODD_SUT=working` post-fix — 4/4.
  - This also flips F-043's use-case "Every t() call site has a key in en.json AND each
    non-English locale" from `unverified` toward partially-verified (toolbar surface).

### Docs decision (G-C10)

Expected: **no doc change** — the multilingual feature is undocumented end-to-end (tracked
DOC-171: supported locales, persistence, gear-menu discovery, missing-key caveat); this fix
restores intended behaviour of that undocumented surface and changes nothing English-facing.
Final decision AFTER reading the candidate live pages during Phase D (the *why* requires the
read; if a page does document the toolbar/localisation, re-decide).

### Ontology refresh (G-C10)

`/enrich --touched` on the three touched-node sidecars:
`odd-platform__json__locales_translations__i18n-resource__en.md` (the catalog node),
`odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md`,
`odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md`; correct F-041's
`three_tab_labels_missing_from_all_six_locales_natural_keys_fallback_silent` facet and F-043's
`missing_key_drift_12_plus…` facet (mark the three-tab instance FIXED-1748; correct the measured
missing-key cardinality to the sweep's 73); re-embed the graph; COMMIT (not narrate).

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **The remaining ~70 missing `t()`-literal keys** (full sweep: 73 missing from en.json; this PR
  fixes exactly the 3 the issue names, per its own scope note). → ONE consolidated follow-up
  PLT draft with the full enumeration + a suggested CI key-parity guard, drafted this run
  (follow-up-on-disk). Cross-refs: F-043 facet, PLT-205 (the UNwrapped-string class), DOC-171.
- **No `ToolbarTabs.tsx` change** — the `t()` calls are correct as-is.
- **No `fallbackLng` change** — the cross-locale fallback-ordering defect is PLT-011.
- **No language-switcher changes** — native-name filtering is PLT-213; the untranslated
  "Select language" menu entry under `ua` is the locale-set-drift class (F-043 facet), among the
  follow-up's scope, not this PR.
- **No vitest/CI wiring** — the CI key-parity guard belongs to the consolidated follow-up.
- **No unused-key cleanup** in the catalogs (separate concern; unsafe to infer from a literal
  sweep because dynamic `t(variable)` call sites exist).

## Test ledger

- **Unit bucket: N/A with reason (recorded per plan).** No CI job executes any FE unit
  framework — vitest exists (`odd-platform-ui/package.json:10`) but its only workflow
  reference (`run-playwright-tests.yml:77`) is commented out; PR CI builds the backend with
  `-PbundleUI=false` and the jib image build gates JSON *syntax* only. A vitest render test
  would be an orphan (tests-as-gates; CTRIB-002 precedent). Repo-level no-regression gate run
  instead: **full `scripts/run-platform-tests.sh` (`:odd-platform-api:build` = test +
  checkstyle + assemble + jacoco) GREEN on the branch — `BUILD SUCCESSFUL in 6m 4s`
  (2026-06-10, working tree = the 18-entry fix).**
- **Integration — IT-102 extended (case 4, `regresses: [PLT-190]`).**
  - **Baseline** (pre-extension, pre-fix SUT @ fbb2eb43 clean, digest `sha256:49543efe…`):
    3/3 GREEN — the switch/persist/fallback machinery works; only the keys were broken.
  - **RED** (extended spec, pre-fix SUT — working tree CLEAN @ fbb2eb43 = the same bits as
    `ODD_SUT=ref:main`; digest `sha256:c1e521f2…`): case 4 FAILED waiting for
    `getByRole('tab', { name: 'Якість даних' })` — the tabs still rendered the raw English
    literals under `ua`; the 3 pre-existing cases passed.
  - **GREEN** (fixed working-tree SUT @ `fbb2eb43+uncommitted`, digest `sha256:09ac74fc…`):
    **4/4 passed** — all nine tabs render their ua.json values, zero English literals
    (case 4: 1.4s). Run-log: `integration-tests/run-log/2026-06-10-IT-102.md` (3 entries).
- **Reproduction driver** (throwaway, never committed): drove the production SelectLanguage
  dialog pre-fix; captured the half-translated toolbar + screenshot (recorded in
  `reproduced:` frontmatter).

## Definition of Done (four merge-readiness gates — `retrospectives/LSN-032`)

1. **Unit (full build, on the branch):** ✅ `:odd-platform-api:build` GREEN
   (`BUILD SUCCESSFUL in 6m 4s`, test + checkstyle + assemble + jacoco, 2026-06-10).
2. **Integration (working-tree SUT):** ✅ IT-102 **4/4 GREEN** via `run-suite.sh IT-102`
   (SUT digest `sha256:09ac74fc…` built from the fixed working tree) and **RED pre-fix**
   against the SUT built from the clean tree @ fbb2eb43 — the same bits as `ODD_SUT=ref:main`
   (LSN-033: the SUT is a run parameter, never a frozen tag).
3. **Docs:** ✅ READ + **CHANGE REQUIRED + SHIPPED** — `docs/multilingual-ui.md` (live at
   `docs.opendatadiscovery.org/features/multilingual-ui`, HTTP 200, GitBook slug nests under
   `features/`; the clean `/multilingual-ui` slug 404s) documents this exact defect as a
   current-behaviour caveat (the "second, sharper gap" paragraph) — stale the moment #1748
   merges. Rewritten as a version-anchored fixed-note + corrected the understated "14 or
   more" missing-key count to the verified ~70. Commit `d6b42f8` on
   `fix/multilingual-ui-1748-fixed-note` (documentation repo) — **merge AFTER PR #1749**.
4. **Ontology:** ✅ committed (this commit) — sidecars `ToolbarTabs` (i18n-corpus note,
   i18next runtime note, FIXED-1748 bugs entry), `i18n-resource:en` (measured 73/70 counts,
   key-count refresh, DOC-171-resolved entry, FIXED-1748 bugs entry), `i18n_ts`
   (DOC-171-resolved audience + bugs entries); flows F-041 (description, contributing-node
   note, three-tab facet RESOLVED line) + F-043 (description, amplification ~350, terminal
   side-effect counts, facet measured-73 lead, undocumented facet RESOLVED, contributing-node
   note, **UC-5 coverage unverified → partial** with the IT-102 trace); graph re-embedded
   (`graph-build odd-platform`: nodes=7071, vectors=7995, `BAAI/bge-small-en-v1.5`,
   2026-06-10).

## Branch / PR

- Branch `contrib/CTRIB-003-toolbar-tab-i18n-keys` pushed to `opendatadiscovery/odd-platform`
  (commit `3049b9af`, authored + committed `odd-contributor[bot]`; 6 files, +18 lines — the
  locale catalogs only).
- Draft PR: **#1749** — https://github.com/opendatadiscovery/odd-platform/pull/1749
  (`draft: true`, `Closes #1748`, review requested from `RamanDamayeu`; the bot cannot merge —
  GATE 2 is the human's).
- Follow-up drafted: `issues/odd-platform/PLT-215.md` — the remaining 70 missing keys
  (full grouped enumeration) + a CI key-parity guard proposal.
- Bookkeeping folded into this batch: CTRIB-002 status `review-ready` → `merged`
  (PR #1747 merged by RamanDamayeu 2026-06-10T17:02Z — verified via API).

## Review (2026-06-10, separate session — implementer shipped `ba0df7b`/`3049b9af`/`d6b42f8`)

- **Result**: **ACCEPTED** — `pr-draft` → `review-ready`. One process finding logged (LSN-034, below); it does not invalidate any deliverable and its remediation IS the GATE 2 merge.
- **Contributor gates**:
  - G-C1 (reproduce-first) — PASS: `reproduced:` frontmatter carries the live capture (pre-fix SUT digest `49543efe…`, ua tab-text dump, screenshot); baseline IT-102 3/3 on the same SUT isolates the defect to the keys. VERIFIED via run-log entries 1-2 + frontmatter.
  - G-C2 (verify the running system) — PASS: reviewer independently re-ran `run-suite.sh IT-102` against the SUT built from the COMMITTED branch (clean tree @ `3049b9af`, digest `67f5cc2a…`) → **4/4 GREEN in 8.4s** (run-log entry 4). Implementer's RED half verified: distinct digest `c1e521f2…` on the clean pre-fix tree, failure at the exact first missing tab (`Якість даних`). PR CI on `3049b9af`: 6/6 checks green (GitHub API). VERIFIED via my own suite run + check-runs API.
  - G-C3 (GATE 1 before code) — PASS: `plan_approved_by/at` frontmatter ("approved as written", RamanDamayeu 2026-06-10); the shipped diff matches the plan's translation table **character-for-character** (all 18 values re-read from `git show 3049b9af`). VERIFIED via diff-vs-plan comparison.
  - G-C4 (human merge gate) — PASS: PR #1749 `draft: true`, author `odd-contributor[bot]`, review requested from RamanDamayeu, unmerged. VERIFIED via GitHub API.
  - G-C5 (diff bounded by plan) — PASS: 6 files, +18/−0, locale catalogs only; `ToolbarTabs.tsx` untouched; every exclusion honoured (no fallbackLng / switcher / vitest / unused-key changes). VERIFIED via `git show --stat 3049b9af` + workspace greps.
  - G-C6 (clarify bar) — PASS: zero comments on #1748 (API: `comments: 0`); skip decision recorded + GATE-1-confirmed.
  - G-C7 (blast radius) — PASS: additive JSON entries only; `adr_required: false` correct.
  - G-C8 (issue is data) — PASS: all five issue claims independently re-verified by the reviewer against the tree (t() sites :46/:51/:56; 0→3 matches across six catalogs pre/post; natural-keys 420/421 post-fix; sibling keys 6/6; scope cross-refs PLT-011/PLT-205/DOC-171 exist).
  - G-C9 (both test buckets) — PASS: integration = IT-102 case 4 (`regresses: [PLT-190]`, registered in `feature-complete` + `ui-e2e` suites — `suites.yaml:16,66`), failing condition injected via the pre-fix SUT (RED), GREEN post-fix, re-confirmed by reviewer; unit = N/A-with-reason VERIFIED: `grep -rn vitest .github/workflows/` → **zero hits**; PR CI builds `-PbundleUI=false` (`run-pr-tests.yaml:58`); Playwright workflow's run steps commented out; full `:odd-platform-api:build` green on the branch (implementer, 6m4s) + the same suite green in PR CI (reviewer-verified). *Citation correction:* the record's "`run-playwright-tests.yml:77` is vitest's one CI reference" mislabels that line — `:77` is the commented `npm run test:ci` (tests/ Playwright); vitest has zero CI references. Conclusion unchanged (strictly stronger).
  - G-C10 (ontology + docs move with the code) — PASS: 3 sidecars + F-041/F-043 facet/count/UC-5 updates committed in `ba0df7b` (not narrated); graph re-embed verified on disk (`graph/build-info.yaml`: built 2026-06-10, nodes=7071, vectors=7995, bge-small, 6 cache misses = the changed nodes); docs page READ + changed (`d6b42f8`).
- **Universal gates**: Gate 1 (no duplicate item; PLT-215 deduped against PLT-205/PLT-011/DOC-171 with explicit do-not-merge notes) PASS. Gate 2 (aliases) PASS — no new alias; `main-concepts.md:124` row pre-exists with all four aliases. Gate 3 (caveats) PASS — missing-key caveat is an admonition-grade section on the live page. Gate 4/9 (consumer-read / provenance) PASS — every `Consumer-read:` file re-read by the reviewer; every numeric claim re-derived independently (438 literals / 73→70 missing / 421-417-418 key counts / 18 entries — all exact matches). Gate 7 (layout) PASS — no SUMMARY change needed (page pre-exists). Gate 8 — see finding. Gate 10 (homing) PASS — locale data in catalogs, test in IT-102, follow-up in issues/, doc note on the feature page. Gate 11 (audience isolation) PASS — banned-term grep on `docs/multilingual-ui.md` clean.
- **Gate 8 / publishing — PASS on content, one process FINDING (LSN-034):** live `features/multilingual-ui` HTTP 200, NEW text rendering ("about 70…", the #1748 fixed-note), old text gone, anchor `#how-to-contribute-a-new-locale` present, no GitHub-fallback substring. **Finding:** documentation `main` was fast-forwarded to `d6b42f8` by a push from the implement session's machine (`origin/main@{0}: update by push`) — the fixed-note went LIVE while PR #1749 is still a draft, contradicting the recorded "merge AFTER #1749" sequencing (DoD item 3 above documents the intent; execution violated it). Mechanism: branch upstream auto-set to `origin/main` + the bare-push hint trap; full chain + guards in `retrospectives/LSN-034-…`. Guard applied: `push.default=current` in `../documentation`. Remediation: **merge PR #1749 (GATE 2) — the live claim becomes true at that instant**; a revert would re-publish the 5×-understated "14 or more" count and flip back within hours, so it is NOT recommended unless GATE 2 is expected to stall.
- **Outbound URL sweep**: 5 verified — issue #1748 (API 200, labels/milestone match), PR #1749 (API: draft/open/bot/+18), PR #1747 (merged 17:02:33Z by RamanDamayeu — bookkeeping exact), live page (200 + content), in-page anchor (3 hits in raw HTML). In-repo refs: PLT-190/PLT-215/IT-102/run-log all exist. 0 broken.
- **Banned-phrase check**: none used (mechanical grep on this record: clean).
- **Regressions**: none — IT-102 cases 1-3 (pre-existing) green in the reviewer's run; full backend build green twice (branch + CI).
- **Navigation**: `navigation/domains/i18n.md` was stale (claimed UNDOCUMENTED per 2026-05-08, `en.json` "complete") — refreshed during review: DOC-171-resolved doc pointer, per-catalog key counts, ToolbarTabs/#1748/IT-102/PLT-215 pointers.
- **Upstream issues logged**: none new (PLT-215 was the implementer's; verified complete + ASCII-clean, ID = max+1 ✓).
- **Doc-product editorial findings**: coverage this run — focused pass on `multilingual-ui.md` end-to-end + its outbound targets (`management.md`, `main-concepts.md#terms-and-aliases`, `developer-guides/build-and-run/…` — all exist), per the partition protocol (full-tree sweep ran 2026-06-08, `6463778`). **No new editorial findings**; the page coheres internally (the "about 70" excludes the three fixed keys; tense and version-anchor consistent — premature only until GATE 2, which is the LSN-034 finding, already tracked).
- **Notes**: GREEN-digest provenance — implementer's GREEN ran on `fbb2eb43+uncommitted` (digest `09ac74fc…`, the same 18 entries pre-commit); reviewer's GREEN on committed `3049b9af` (digest `67f5cc2a…`) closes that gap. VERIFIED via run-log digests + `git show`. Armenian/Chinese translation quality is GATE-1-approved as written; sentence-case + neighbourhood-anchor checks done against each catalog's existing vocabulary (es/fr/ua/ch `:267` SLA strings confirmed in the diff context). VERIFIED via `git show 3049b9af`.
