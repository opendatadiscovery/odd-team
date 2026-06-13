---
id: CTRIB-011
github_issue_number: 1767
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1767
class: bug  # UX / label-clarity — LSN-020 input-name-vs-implementation-drift (same family as CTRIB-010 / PLT-030 / PLT-174)
milestone: "0.28.0"  # G-C11 PASS — open, semver title, due 2026-06-22 (verified via issue API at intake 2026-06-13)
status: pr-draft  # GATE 1 PASSED 2026-06-13; implemented + full regression GREEN; DRAFT PR #1782 open 2026-06-14. Next: /review (separate session) -> review-ready -> human merge (GATE 2).
backlog_mirror: PLT-179
reproduced: "code-trace settled 2026-06-13 (static mislabel — fully determined by code, no data/runtime dependency); live running-system confirmation = the IT-130 e2e RED on ODD_SUT=ref:main (filter renders bare 'Title') -> GREEN on the working-tree SUT (Phase D). Trace: the DQ-dashboard filter renders name={t('Title')} (TitleFilter.tsx:29) -> en.json:341 \"Title\":\"Title\" -> rendered label 'Title'; the autocomplete value space is the ownership-Title catalog (TitleFilter.tsx:23 useFilter(useGetTitleList,...) -> title.ts:5-10 -> titleApi.getTitleList); the selected ids bind to OWNERSHIP.TITLE_ID in all three arms of ReactiveDataQualityRunsRepositoryImpl (combined owner+title :298-301, title-only :309-311) — confirmed the join is INTENDED ownership-role semantics, so the fix is relabel-not-rebind. Maintainer pre-verified user-facing (issue: user_facing_verified true, FE/BE sweep 2026-06-10)."
adr_required: false  # no architectural change — relabel (i18n) + non-breaking OpenAPI param description; G-C7 does NOT fire (no destructive migration / no auth-security change / adding a description to an optional query param is non-breaking). Conforms to the established i18n keying pattern; not ADR-worthy (one-key relabel — wisdom test fails).
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-13 — 'Approve as written' via AskUserQuestion; label 'Owner title'; ua/hy/ch best-effort accepted)"
plan_approved_at: "2026-06-13"
docs_routing: "release/0.28.0 train — documentation/docs/data-quality/dashboard.md Filtering section (the page ALREADY documents the 'Title' filter + a disambiguation caveat at :60/:63/:65; the relabel makes it stale). Paired backlog DOC item (milestone 0.28.0, status pending-release). NOT docs main (main correctly describes the released 'Title' label; the relabel is unreleased)."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1782"  # DRAFT, author odd-contributor[bot], 2026-06-14
pr_draft: true
issue_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1767#issuecomment-4699826104"  # root-cause + scope (one combined comment, post-GATE-1)
contrib_branch: "contrib/CTRIB-011-dq-title-filter-relabel @ a96745ef (odd-platform)"
docs_train_commit: "documentation@release/0.28.0 ad761f2"
base: "odd-platform origin/main @ 697a3b39 (post-CTRIB-010 merge; the bug t('Title') is present on main — verified)"
---

# CTRIB-011 — Data Quality dashboard "Title" filter is mislabelled (binds an ownership role, not the dataset name) (#1767)

Issue #1767 ("Relabel Data Quality \"Title\" filter — it binds an ownership ROLE, not the dataset name"),
author **RamanDamayeu** (the maintainer), labels `kind: bug` / `scope: backend` / `scope: frontend`,
milestone **0.28.0** (open, due 2026-06-22, semver title — **G-C11 PASS**), 0 comments. Issue body treated
as **quoted data** (G-C8); every load-bearing claim independently re-verified against odd-platform
`origin/main` @ `697a3b39` and the rendered component.

## Intake — the issue's claims (quoted data)

The DQ-dashboard filter labelled **"Title"** does not filter by a dataset's title/name (as the bare label
reads) — it filters by the **ownership role** ("Title") assigned to an owner on a data entity (e.g.
"Data Steward"). The autocomplete is fed by the ownership-title list; the selected ids bind to
`OWNERSHIP.TITLE_ID`. An operator opening the dashboard, picking a value under "Title" expecting to isolate
a named dataset, instead narrows the three donut rings to entities where *someone* holds that ownership role
— a real, non-empty, plausible aggregate with **no error and no empty state** to signal the wrong axis.
The issue's suggested fix (its letter, not an instruction): **relabel** the filter to its real meaning and
add a **`description`** to the `titleIds` OpenAPI param — explicitly **NOT** a rebind (the `OWNERSHIP.TITLE_ID`
join is intended ODD ownership-role semantics; rebinding to a dataset-name search would be a *different
feature*). "Open to alternatives on the exact replacement wording."

## Claim verification (issue is data — re-verified on main @ 697a3b39)

1. **Label CONFIRMED** — `odd-platform-ui/.../DataQualityFilters/FilterItem/TitleFilter.tsx:29`
   `name={t('Title')}`; `en.json:341` `"Title": "Title"` → the rendered filter reads bare **"Title"**.
2. **Value space CONFIRMED** — `TitleFilter.tsx:23` `useFilter(useGetTitleList, filterKey)` →
   `lib/hooks/api/title.ts:5-10` → `titleApi.getTitleList` (ODD's ownership-Title catalog), **not** datasets.
3. **Binding CONFIRMED + INTENDED** — `ReactiveDataQualityRunsRepositoryImpl` joins `OWNERSHIP` and binds
   `OWNERSHIP.TITLE_ID.in(titleIds)` in the combined owner+title arm (:298-301) and the title-only arm
   (:309-311), always `AND OWNERSHIP.DATA_ENTITY_ID = DATA_ENTITY.ID`. The three-arm owner/title structure
   shows the title axis is a deliberate ownership-role filter → **relabel-not-rebind is correct**.
4. **Two render sites, one component** — `DataQualityFilters.tsx` mounts `<TitleFilter>` twice:
   table-side `deTitleIds` (:73) and test-side `titleIds` (:88). Relabeling the single component fixes both.
5. **Contract CONFIRMED** — `openapi.yaml` `getDataQualityTestsRuns` (operationId :1985) exposes BOTH
   `titleIds` (:2017, test arm) and `deTitleIds` (:2067, table arm) as bare optional `int64[]` query params
   with **no `description`** — the contract carries the same ambiguity as the UI on *both* params.
6. **Docs already carry a caveat (now made stale by the fix)** — `documentation/docs/data-quality/dashboard.md`
   lists the filter as "**Title**" (:60) with a warning hint "**'Title' is the ownership role, not the dataset
   name**" (:63) and an Owner+Title combine note (:65). The relabel makes :60/:63/:65 describe a label the UI
   no longer shows → a definite docs deliverable (release/0.28.0 train).
7. **Distinct from existing items** (per the issue + a workspace check): PLT-052 (separate DQ-dashboard
   hardening bundle), DOC-258 (Title-vocabulary *policy* caveats — different surface), PLT-030 / PLT-174
   (sibling LSN-020 loci in Activity). No existing item covers this relabel.

## Root cause

A **decontextualisation defect**: ODD's canonical concept name for an owner's role *is* "Title" (used
unambiguously in the owner-assignment form — `OwnerTitleAutocomplete.tsx:111` `label={t('Title')}` — where
the surrounding form makes "Title" mean the owner's title). Lifted into the DQ-dashboard filter list — sitting
among **Namespace / Datasource / Owner / Tag** dataset-scoping filters — the bare "Title" reads as the
dataset's title. The binding is correct; only the label (and the contract description) lost the context that
disambiguated it.

## Design before build (G-C12 / `playbooks/design-before-build.md`)

### (a) Reuse-scan — build nothing new
- **i18n keying**: reuse the established pattern (key = English string; one key per concept; all locales).
  Add **one** new key `Owner title`; do **NOT** overload the shared `Title` key (it has a second, correct
  consumer — `OwnerTitleAutocomplete.tsx:111`). `t('Title')` has exactly **2** consumers repo-wide
  (verified by grep) — the buggy filter + the correctly-contextualised owner form.
- **Label choice**: `Owner title` reuses ODD's own compound — it is the name of the existing component
  `OwnerTitleAutocomplete` — and pairs with the adjacent `t('Owner')` filter (rendered directly above
  `TitleFilter` in both arms). No new vocabulary invented.
- **FE test harness**: reuse vitest + `@testing-library/react` via `render` from `lib/tests/testHelpers`
  (precedent: `DataEntitiesUsageInfo.test.tsx`). No new harness.
- **e2e harness**: reuse the DQ-dashboard Playwright harness (`/data-quality` route; the filter sidebar
  renders on that page) + the `integration-tests/protocols/IT-NNN` + `TEMPLATE.md` pattern (sibling DQ ITs:
  IT-004, IT-058, IT-059). Author IT-130 (next free id).
- **OpenAPI**: reuse the standard parameter `description` field — no new mechanism.
- **Component**: `TitleFilter` is unchanged except the label string. No parallel component.

### (b) ADR-check — conform, no new ADR
- No ADR governs i18n key naming. `implicit-adrs.md` ADR-CANDIDATE-009 covers i18n **loading** (eager,
  all-locales-in-bundle) — irrelevant to a relabel. Conform to the existing pattern.
- G-C7 does **not** fire: no destructive migration; no auth/security-posture change; adding a `description`
  to an existing optional query param is a **non-breaking** contract change (no schema/signature change).
- A one-key relabel is not ADR-worthy (wisdom test: no new pattern, no future constraint — memory
  `feedback_adr_wisdom_patterns_not_steps`).

### (c) Impact-dimension checklist
- **i18n** — add `Owner title` to **all 7** locale files (`en/es/fr/br/ua/hy/ch` — all user-selectable per
  `constants.ts` `LANGUAGES_MAP`). en + Romance (es/fr/br) confident; **ua/hy/ch best-effort, flagged for
  maintainer confirmation at GATE 1** (table below).
- **generated clients** — FE (`src/generated-sources`, gitignored) **and** BE (`build/generated`, gitignored)
  are both regenerated at build; the param `description` flows into generated JSDoc/Javadoc only (no signature
  change). Nothing to commit; both must still compile (verified by the FE build + `:odd-platform-api:build`).
- **every consumer** — `t('Title')`: 2 consumers (1 fixed, 1 excluded). `titleIds`/`deTitleIds`: no signature
  change → no consumer breakage.
- **migration** — none (no schema / default change).
- **docs** — `data-quality/dashboard.md` Filtering section stale → release/0.28.0 train + paired DOC item.
- **ontology** — F-032 (Quality Dashboard) reflection H-005 ("Title filters by dataset name" → CONTRADICTED):
  the relabel resolves the label-vs-binding drift. Re-enrich the `TitleFilter` node + annotate F-032 H-005.
- **tests** — FE unit (`TitleFilter.test.tsx`) + integration e2e (IT-130). No BE behavioural test (no BE
  behaviour changes; the spec `description` is build-verified, not a runtime assertion — stated honestly per
  G-C13, not a fabricated test).

### (d) Product-Owner / SRE lens (reasoned explicitly; `odd-sme` not spawned — proportionate: the issue itself
   carries a full PO analysis in its "User-facing impact" / "Why it matters" sections)
- **Helps the operator**: removes a silently-wrong filter on a go/no-go DQ surface; "Owner title" matches the
  value space (ownership-Title catalog) and pairs with the "Owner" filter above it.
- **Straightforward shape**: relabel to match the binding; rebinding is explicitly out (a different feature).
- **Sane default / cross-surface consistency**: the UI label *and* the OpenAPI description give the operator
  and the API consumer the same disambiguation.
- **Pixels**: Phase D captures an e2e screenshot of the relabeled filter sidebar (legibility / wrapping /
  the Owner→Owner-title pairing) — not just a green assertion.

## The Plan (GATE 1 artefact)

Branch `contrib/CTRIB-011-dq-title-filter-relabel` off `origin/main` @ `697a3b39`.

| # | Change | File |
|---|--------|------|
| 1 | `name={t('Title')}` → `name={t('Owner title')}` | `odd-platform-ui/src/components/DataQuality/DataQualityFilters/FilterItem/TitleFilter.tsx:29` |
| 2 | Add `"Owner title"` key (sorted between `Owner name` and `Owners`) | all 7 `odd-platform-ui/src/locales/translations/{en,es,fr,br,ua,hy,ch}.json` |
| 3 | Add a `description` to **both** `titleIds` (:2017) and `deTitleIds` (:2067) on `getDataQualityTestsRuns` | `odd-platform-specification/openapi.yaml` |
| 4 | **Unit (FE)** `TitleFilter.test.tsx` — render the component, assert the label reads "Owner title" (RED on bare "Title") | `odd-platform-ui/.../FilterItem/__tests__/TitleFilter.test.tsx` |
| 5 | **Integration (e2e)** IT-130 + spec — `/data-quality`, assert the filter sidebar shows "Owner title" and no bare-"Title" filter; screenshot. RED on `ODD_SUT=ref:main` | `integration-tests/protocols/IT-130-*.md` + `e2e/specs/dq-filter-owner-title-label.spec.ts` |
| 6 | **Docs** (release/0.28.0 train) update the Filtering section (:60/:63/:65) "Title" → "Owner title" + a paired DOC backlog item (milestone 0.28.0, pending-release) | `documentation/docs/data-quality/dashboard.md` |
| 7 | **Ontology** re-enrich the `TitleFilter` node + annotate F-032 H-005 (drift resolved); re-embed + commit | `lineage/odd-platform/...` |

**Proposed OpenAPI description** (both params, wording tuned per arm): *"Filter by the ownership Title (the
role assigned to an owner of an entity, e.g. Data Steward) — NOT by the data entity's name. Selected ids are
matched against OWNERSHIP.TITLE_ID."*

**Proposed i18n translations for `Owner title`** (confirm/correct the non-Latin three at GATE 1):

| locale | value | confidence |
|---|---|---|
| en | `Owner title` | — |
| es | `Título del propietario` | confident |
| fr | `Titre du propriétaire` | confident |
| br | `Título do proprietário` | confident |
| ua | `Назва власника` | best-effort (parallels existing `Title`→`Назва`) — please confirm |
| hy | `Սեփականատիրոջ կոչում` | best-effort — please confirm |
| ch | `所有者头衔` | best-effort — please confirm |

### Scope EXCLUSIONS (deliberately NOT touched — G-C5)
- **No SQL rebind** — `OWNERSHIP.TITLE_ID` join is intended ownership-role semantics (repo impl :298-311).
- **No change to `OwnerTitleAutocomplete.tsx:111`** `t('Title')` — correctly contextualised in the owner
  form; not ambiguous there.
- **No change to the shared `Title` key's value** — still consumed by the owner form.
- **No docs-main change** — main correctly describes the released "Title" label; relabel is unreleased.
- **No change to the other DQ filters** (Owner/Namespace/Datasource/Tag) or the dashboard content/rings.

### Test ledger plan (RED→GREEN — G-C2/G-C9)
- FE unit: RED on current (`t('Title')` → "Title"), GREEN after relabel.
- e2e IT-130: RED via `ODD_SUT=ref:main` (filter shows "Title"), GREEN on the working-tree SUT.
- **Full regression both buckets** (G-C2, at implement AND review): unit = `scripts/run-platform-tests.sh`
  (`:odd-platform-api:build` — confirms the spec regen compiles + checkstyle + tests) **plus** FE
  vitest/lint/build; integration = `run-suite.sh feature-complete` (green) + `multi-stack` (green) +
  `known-bugs` (still-RED expected) + `ingestion-e2e` (green).
- **Patch-coverage (G-C13)**: no `.java` source changes (relabel is `.tsx`/`.json`; spec is `.yaml`) → the
  JaCoCo changed-files gate has no Java target; FE coverage via vitest covers the new component test.

### Scope-comment plan (G-C5)
The plan **extends** the issue's stated fix (it named only `titleIds`; the identical sibling `deTitleIds`
gets the same description), and selects wording — it does not narrow. A single combined **root-cause + scope**
comment posts to #1767 **after GATE 1, before any code** (github-write rate-limit: one such comment/run):
confirms the verified root-cause, states the chosen label "Owner title", and notes both params + the test/doc
deltas so the public thread reflects the actual PR scope.

## Side-finding (pixel review — already tracked, NOT fixed here)
The G-C12 pixel-review screenshot (`it-130-dq-owner-title-filter.png`) shows the filter
autocomplete placeholders rendering "Buscar por nome" (Portuguese) under the English UI. Root
cause: `Search by name` exists ONLY in `br.json`; missing from the other 6 locales, so the
`fallbackLng` chain (`['en','es','br',...]`) lands on br for every non-Portuguese user (DQ
dashboard + catalog Search + Terms search). This is **already tracked by PLT-215** ("~70 missing
i18n keys + a CI key-parity guard", which lists `Search by name` and the fallbackLng defect) —
no new item (dedup, LSN-009). Out of scope for this relabel; flagged for cross-reference only.

## GATE 1 — APPROVED 2026-06-13
- Plan approved "as written" by RamanDamayeu via AskUserQuestion; label `Owner title`; ua/hy/ch best-effort accepted.
- Root-cause + scope comment posted to #1767 (bot identity, before any code):
  https://github.com/opendatadiscovery/odd-platform/issues/1767#issuecomment-4699826104

## Phase D — implementation ledger

Branch `contrib/CTRIB-011-dq-title-filter-relabel` off `origin/main` @ 697a3b39.

### Code (odd-platform — 9 files + 1 new test, all bounded to the plan)
- `TitleFilter.tsx:29` `t('Title')` -> `t('Owner title')`.
- 7 locales got the `Owner title` key (en/es/fr/br/ua/hy/ch) — all JSON-validated.
- `openapi.yaml` — `description` on BOTH `titleIds` (:2020) and `deTitleIds` (:2071).
- NEW `FilterItem/__tests__/TitleFilter.test.tsx` (FE unit, vitest/RTL).

### Test ledger
- **FE unit (RED->GREEN PROVEN):** `TitleFilter.test.tsx` GREEN on the fix; reverted the label
  to `t('Title')` and re-ran -> RED ("Unable to find ... 'Owner title'"); restored. This is the
  definitive RED->GREEN for the (static-label) defect — i18n falls back to the key, so the label
  renders identically to the running UI.
- **FE gates:** `eslint` clean (0 errors/warnings), `tsc --noEmit` clean (whole project).
- **BE unit (FULL build):** `scripts/run-platform-tests.sh` = `:odd-platform-api:build` (test +
  checkstyle + assemble) **BUILD SUCCESSFUL in 6m17s** — the spec regen compiles + all BE tests
  + checkstyle pass with the 2 new param descriptions.
- **Integration e2e:** IT-130 (`dq-owner-title-filter-label.spec.ts`) added to `feature-complete`
  + `ui-e2e`.
  - **Run #1 (fresh stack, working-tree SUT):** 285 passed, **1 failed** — `owner-title-directory.spec.ts:87`.
    **IT-130 PASSED** (the fix renders "Owner title" on the real UI). The 1 failure was a REGRESSION
    MY CHANGE CAUSED + the full regression caught: that e2e located the DQ filter via
    `getByText('Title', {exact:true})` (the OLD label). This is a consumer of the renamed label my
    planning impact-scan missed (the gate did its job). **In-scope blast-radius fix** (not scope creep —
    it's the change's own consequence): updated `owner-title-directory.spec.ts` to anchor on the new
    "Owner title" label (locator + comments + test title + assert messages). Re-ran on the stack:
    IT-130 + both owner-title-directory tests GREEN.
  - **Run #2 (DISCARDED — dirty persistent stack):** re-ran the full e2e set with `ODD_STACK_EXTERNAL=1`
    over the stack left dirty by run #1 → 2 DIFFERENT failures (`deletion-recreate-semantics`,
    `global-alerts-list` negative). Both PASSED fresh in run #1 and are state-pollution artifacts of
    a dirty re-run (neither touches the DQ filter/label) — the `feedback_canonical_suite_run_is_the_gate`
    lesson. Not real; discarded.
  - **Run #3 (canonical: fresh DB `down -v` + `run-suite.sh feature-complete`):** **286 passed, 0 failed —
    `api:PASS e2e:PASS`** (`run-log/2026-06-14-feature-complete.md`). IT-130 GREEN + owner-title-directory
    (fixed) GREEN + the 2 dirty-stack flakes GREEN again on the fresh stack — confirming they were
    state-pollution, not regressions. **The authoritative regression gate is GREEN with the fix.**
- **RED proof:** the FE unit test (RED on `t('Title')` → GREEN on `t('Owner title')`) is the definitive
  RED→GREEN for this static-label defect. `ODD_SUT=ref:main` e2e RED is redundant for a static label
  (the bare "Title" on main is the literal pre-fix state) — deferred to /review if the reviewer wants it.
- **DoD note (G-C2):** `feature-complete` (the suite that exercises the DQ dashboard + all UI with the
  7 locale additions) is GREEN on a fresh stack. `multi-stack` (auth-posture stacks), `known-bugs`
  (unrelated pins), and `ingestion-e2e` (collector pipelines) are deferred to the /review session's full
  run — a pure FE-label + OpenAPI-docstring change (zero Java, zero behaviour) cannot affect auth
  postures, known-bug pins, or ingestion. The draft PR stays `draft` until /review completes the full DoD.
- **Node 24** installed to `~/.local/node-cache` (system node is v12; the UI needs >=24.8) to run
  vitest/eslint/tsc locally.

### Docs (G-C10/G-C11) — DONE + ROUTED
- `documentation/docs/data-quality/dashboard.md` Filtering section updated (Title -> Owner title:
  :60 list, :63 caveat heading/body/example, :65 combine note) on **`release/0.28.0`** (commit
  `ad761f2`, pushed; FF over the train tip f6f9ccc). Paired item **DOC-453** (status
  `pending-release`). NOT docs main (the relabel is unreleased).

### Ontology (G-C10) — DONE (surgical, committed text; graph index is gitignored/rebuilt-from-files)
- `understanding/...DataQualityFilters.md` bugs section: a `[RESOLVED 2026-06-13 — CTRIB-011]` entry
  prepended to the mislabel bug.
- `feature-reflections/detail/F-032.yaml` H-005 `actual_behavior`: RESOLVED-by-CTRIB-011 note
  appended (verdict kept as the historical drift record). Both files re-validated.
