---
id: CTRIB-011
github_issue_number: 1767
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1767
class: bug  # UX / label-clarity — LSN-020 input-name-vs-implementation-drift (same family as CTRIB-010 / PLT-030 / PLT-174)
milestone: "0.28.0"  # G-C11 PASS — open, semver title, due 2026-06-22 (verified via issue API at intake 2026-06-13)
status: review-ready  # /review 2026-06-14 (re-review, separate session): the deferred FULL integration regression RAN GREEN on a free stack (P-001 torn down per maintainer OK) — unit BUILD SUCCESSFUL 5m51s + feature-complete 286/286 (IT-130 PASS) + multi-stack 9 + ingestion-e2e 6 + known-bugs 5-RED-as-expected (0 unexpected GREEN). All criteria + Quality Bar gates re-verified PASS. ACCEPTED -> review-ready; GATE 2 (human merge of draft PR #1782) owns the tail. A SEPARATE i18n Portuguese-leak regression surfaced during review (root cause #1564 / 8b0155f7, NOT CTRIB-011) — logged PLT-011 (reopened) + PLT-215 (escalated). See ## Re-review.
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

### Docs (G-C10/G-C11) — ROUTED (committed locally on the train; maintainer pushes at the release gate)
- `documentation/docs/data-quality/dashboard.md` Filtering section updated (Title -> Owner title:
  :60 list, :63 caveat heading/body/example, :65 combine note) on **`release/0.28.0`** (commit
  `ad761f2`). **Routing-claim correction (2026-06-14, /review un-block):** the original ledger said
  "pushed; FF over the train tip f6f9ccc" — that was **false** at review time: `ad761f2` was a
  *dangling* commit (its parent was f6f9ccc but the `release/0.28.0` ref still pointed at f6f9ccc),
  and it was never pushed. It is **now** fast-forwarded onto the train (`git branch -f release/0.28.0
  ad761f2`, verified `release/0.28.0:.../dashboard.md` reads "Owner title"). It remains **local** —
  the maintainer pushes the train at the release gate (the bot is scoped to odd-platform and cannot
  push docs), same as CTRIB-010. Paired item **DOC-453** (status `pending-release`). NOT docs main
  (the relabel is unreleased; released `main` correctly still reads "Title").

### Ontology (G-C10) — DONE (surgical, committed text; graph index is gitignored/rebuilt-from-files)
- `understanding/...DataQualityFilters.md` bugs section: a `[RESOLVED 2026-06-13 — CTRIB-011]` entry
  prepended to the mislabel bug.
- `feature-reflections/detail/F-032.yaml` H-005 `actual_behavior`: RESOLVED-by-CTRIB-011 note
  appended (verdict kept as the historical drift record). Both files re-validated.

---

## Review (2026-06-14, session: `/review` separate-session — distinct from the implement session)

**Lifecycle (contributor pillar):** `/review` owns `pr-draft → review-ready` (accept) | `pr-draft → blocked`
(reject); GATE 2 (human merge of draft PR #1782) owns the tail. The `/review` skill's `review-ready`
precondition is the standard-backlog contract; the contributor review-input state is `pr-draft` (precedent:
CTRIB-010 "REVIEWED -> ACCEPTED (pr-draft -> review-ready)"). Reviewed code head: odd-platform
**`a96745ef`** (clean working tree == the contrib branch tip == the reviewed SUT).

- **Result: REJECTED — `pr-draft` → `blocked`.** The **code** deliverable (PR #1782) passes every gate with
  cited evidence and is excellent. The **block is a single root cause**: the paired docs commit is **not on
  the release train** — the DOC-453 relabel `ad761f2` is a **dangling commit** (verified three ways below), so
  the work item's "on `release/0.28.0`, pushed; FF over the train tip f6f9ccc" / "DONE + ROUTED" claim is
  **false**. Left as-is, the 0.28.0 release publishes the stale **"Title"** docs against the relabeled
  **"Owner title"** UI — the `retrospectives/LSN-034` docs-train drift class, and a false "done" claim of the
  `retrospectives/LSN-002` class. This surfaces through criterion 6 + Gates 6/8/9. The fix is ~2 commands;
  the re-review will be fast.

### The blocker (one root cause, three confirmations)
The dangling DOC-453 commit `documentation@ad761f2` ("relabel ... on the 0.28.0 train"):
- `git merge-base --is-ancestor ad761f2 release/0.28.0` → **NO** (not in the branch).
- `git branch -a --contains ad761f2` → **empty** (no local or remote branch contains it).
- `git show release/0.28.0:docs/data-quality/dashboard.md` → still reads **"Title"** (`:60/:63/:65`), not
  "Owner title". (Remote `origin/release/0.28.0` is at `f67851e`, further behind — so "pushed" was never true
  either; the CTRIB-010 train docs `3a4f6ad..f6f9ccc` ARE correctly on the local branch, so this is a
  CTRIB-011-specific slip, not a general train problem.)

The edit **content** is correct and high quality (verified on the dangling `ad761f2`: dimension list +
warning-hint heading/body/`Owner title = Steward` example + combine note, substantive guidance retained,
ASCII-clean, tree-relative links). The defect is purely that the commit is not on the branch the maintainer
will push.

**Fix to un-block (implementer, separate from this review):**
1. In `../documentation`, fast-forward the train onto the edit — `ad761f2`'s parent IS the current train tip
   `f6f9ccc`, so it is a literal FF: `git branch -f release/0.28.0 ad761f2` (then confirm
   `git show release/0.28.0:docs/data-quality/dashboard.md` reads "Owner title"). The maintainer pushes the
   train at GATE 2 (the bot is scoped to odd-platform; it cannot push docs) — same as CTRIB-010.
2. Correct the **false routing claims** in `contributor/CTRIB-011.md` ("pushed; FF over the train tip ... DONE
   + ROUTED") and `backlog/docs/DOC-453.md` ("Authored + **pushed** on `release/0.28.0`") to reflect reality:
   committed locally on `release/0.28.0`; maintainer pushes at the release gate; never pushed yet.
3. Re-`/review` (separate session) — which runs the **full integration regression** on a free stack (deferred
   here; see Regression) and flips `blocked → review-ready`.

### Contributor acceptance criteria (gates.md §Acceptance 1–14)
1. **Code-after-plan** — PASS (`plan_approved_by` GATE 1 2026-06-13; bot commit `a96745ef` dated Jun 14 follows; the post-GATE-1 scope comment 2026-06-13T21:20:20Z precedes the code). via git log + GitHub API.
2. **Reproduction logged** — PASS (`reproduced:` frontmatter — static-label defect fully code-determined; FE unit RED→GREEN is the definitive reproduction for a static label; IT-130 RED-on-`ref:main`/GREEN-on-working-tree as the running-system half). via read.
3. **Diff bounded by plan** — PASS — the PR #1782 diff is EXACTLY the 10 planned files (`TitleFilter.tsx` + 7 locales + `openapi.yaml` (2 params) + the new `TitleFilter.test.tsx`); no scope creep. The `owner-title-directory.spec.ts` blast-radius fix is in **odd-team** (test harness), not the PR — correct (doesn't widen the upstream diff). via `git diff origin/main...a96745ef`.
4. **Unit test injects the failing condition** — PASS — `TitleFilter.test.tsx` renders the component (stubbed `useFilter` + a stub `MultipleFilterItemAutocomplete` that renders `{name}`) and asserts `getByText('Owner title')`. Pre-fix `name={t('Title')}`→"Title" (i18n returns the key) → the matcher throws → RED; post-fix → GREEN. Mock paths verified against the real imports (`hooks/index.ts`, the default export). Verified by inspection; the implementer logged the explicit revert→RED→restore. (My own FE vitest re-run was **permission-denied** this session — noted, not a gap: the RED→GREEN is airtight by construction and the unit build green covers the spec regen.) via read.
5. **Pins re-grounded** — N/A (no characterization pin existed for the DQ filter label; fresh relabel).
6. **Docs decision + routed** — **FAIL** — decision stated + content correct, but **not routed**: `ad761f2` is dangling, not on `release/0.28.0` (the blocker above). This is the block. via git.
7. **Ontology committed** — PASS (`F-032.yaml` H-005 + the `DataQualityFilters.md` sidecar carry `[RESOLVED 2026-06-13 — CTRIB-011]` annotations on disk in `0955445`; the original `contradicted`/drift entries retained as the historical record — correct per the feature-reflector contract). via `git show 0955445`.
8. **Status review-ready not self-done** — PASS (was `pr-draft`; this separate session reviews and flips to `blocked`, not self-`done`/`merged`).
9. **Architectural ADR before code** — N/A (`adr_required: false`, correctly justified — relabel + a non-breaking `description` on an existing optional query param; G-C7 does not fire).
10. **Prompt injection discarded** — N/A (maintainer-authored issue, treated as quoted data per G-C8; no injected instruction present).
11. **DoD met before draft** — **PARTIAL/FAIL** — unit build GREEN (my own + implementer's); integration `feature-complete` 286/0 GREEN per the implementer's logged fresh-stack run (my own FULL run **deferred** — see Regression); ontology committed; **docs read but NOT routed** (criterion 6). The docs-routing failure means the DoD is not fully met.
12. **Milestone gate** — PASS (milestone `0.28.0` open, semver, due 2026-06-22 — re-verified via GitHub API at review; the docs routing TARGETS the `release/0.28.0` train — intent right, execution slipped per #6).
13. **Design before build (G-C12)** — PASS (the plan records the reuse-scan — reuse the i18n-key pattern, a dedicated key not overloading the shared `Title`, reuse the `OwnerTitleAutocomplete` naming + the vitest/RTL + DQ-Playwright harnesses; the ADR-check — conform, no ADR; the full impact checklist — i18n ALL 7 locales, generated BE+FE clients, every consumer, docs, ontology, tests; the PO/SRE lens; the IT-130 screenshot is the step-5 pixel gate). via read.
14. **Principal sufficiency (G-C13)** — PASS (code) — zero Java source change → no JaCoCo changed-files Java target; FE coverage via the new component test; IT-130 proves the user-visible label; no control lost, no parallel component. The one open measurement is the FULL **integration** regression (deferred; unit GREEN + implementer's `feature-complete` 286/0 logged).

### Quality Bar gates
- **Gate 1 (no duplicates)** — PASS — the new `Owner title` key does not overload the shared `Title` key (kept for `OwnerTitleAutocomplete.tsx:111`); `TitleFilter` is the same component with only the label changed; no parallel copy. via grep/diff.
- **Gate 4 (consumer-read)** — PASS — independently enumerated every `t('Title')` consumer: **exactly 2** in production code — `TitleFilter.tsx:29` (the ambiguous one, now `t('Owner title')`) + `OwnerTitleAutocomplete.tsx:111` (correctly contextualised owner form, deliberately untouched). The shared `"Title"` key remains at `en.json:342`; `'Owner title'` is used only by `TitleFilter.tsx`. Root cause re-verified in code: `ReactiveDataQualityRunsRepositoryImpl.java:296-311` binds `titleIds`→`OWNERSHIP.TITLE_ID` in both arms (`:301`, `:309`) joined on `DATA_ENTITY_ID` → relabel-not-rebind is correct. via grep + read.
- **Gate 5 (unset-param SDK)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — **FAIL (docs half)** — the code change's doc coverage is AUTHORED (DOC-453 content correct) but NOT on the train (criterion 6). Ontology half: PASS (committed).
- **Gate 8 (publishing — branch sub-check for a release-gated item)** — **FAIL** — Gate 8's branch-verifiable precondition for `PENDING-RELEASE` is "the edit exists on the train branch"; it does **not** (dangling). The edit's own hygiene (PyYAML/ASCII/tree-relative links) is fine, but it is not on `release/0.28.0`, so `PENDING-RELEASE` cannot be recorded honestly. Live-site verification remains release-gated regardless. via git.
- **Gate 9 (provenance)** — **FAIL** — one load-bearing claim is false: "ad761f2 pushed; FF over the train tip f6f9ccc / DONE + ROUTED". All OTHER claims VERIFIED — root-cause `OWNERSHIP.TITLE_ID` bind (read), the 2 consumers (grep), milestone open (API), draft PR by the bot (API), the root-cause+scope comment posted (API), the ASCII OpenAPI descriptions (diff). The single false claim is the routing one. via git + API.
- **Gate 10 (content homing)** — PASS — OpenAPI parameter-doc content homed in the spec; feature-doc content homed in `dashboard.md`; no misplaced reference content.
- **Gate 11 (audience isolation)** — PASS — the OpenAPI descriptions + the `dashboard.md` edit use operator/consumer language; no workspace-internal terms (`Cornerstone`/`Gate`/`LSN`/`CTRIB`) leak into published surfaces. (Minor observation, not a leak: the OpenAPI description's trailing "Selected ids match `OWNERSHIP.TITLE_ID`" exposes an internal DB column to API consumers — precise but slightly leaky; it was in the GATE-1-approved wording, so within scope. Optional future polish.)

### Regression (G-C2)
- **Unit — PASS (reviewer's OWN run, working-tree SUT @ `a96745ef`):** `scripts/run-platform-tests.sh`
  (= `:odd-platform-api:build` = test + checkstyleMain + checkstyleTest + assemble) → **BUILD SUCCESSFUL in
  5m 46s**. Confirms the OpenAPI spec regen (the 2 new param descriptions) compiles into the generated
  Java/clients, all BE tests + checkstyle pass. (Independent of the implementer's 6m17s run.)
- **Integration — DEFERRED to the re-review (NOT a silent skip; the no-concurrent-run rule + the block):**
  a **maintainer probe stack is currently up** — `probe-odd-platform` + `probe-database` (Up 10 hours,
  healthy). G-C2 / `feedback_canonical_suite_run_is_the_gate` is explicit: "one e2e suite at a time — never
  concurrent with a possible maintainer run." Launching `run-suite.sh` now would collide (port 18080 /
  postgres / the maintainer's P-001 WIP). Since the item is **blocked on docs-routing regardless** (it returns
  for re-review where the FULL 4-suite regression IS the flip gate, on a free stack), I deferred my own run
  rather than collide. Standing evidence meanwhile: the implementer's logged fresh-stack run #3 —
  `feature-complete` **286 passed / 0 failed** (`api:PASS e2e:PASS`, SUT digest `sha256:e5115c68…`, IT-130
  GREEN + the owner-title-directory blast-radius fix GREEN), `run-log/2026-06-14-feature-complete.md`. The
  change is FE-label + OpenAPI-description only (zero Java/behaviour — the unit build green confirms compile),
  so `multi-stack`/`known-bugs`/`ingestion-e2e` are structurally unaffected; the re-review confirms all four.
- **RED proof:** the FE unit RED→GREEN (revert→"Unable to find 'Owner title'"→restore, logged) is definitive
  for a static-label defect; IT-130's `ODD_SUT=ref:main` RED is the redundant running-system half.

### Doc-product editorial audit (step 5, `playbooks/doc-product-editorial-read.md`)
- **Coverage this run**: the changed surface read end-to-end — `data-quality/dashboard.md` on both `main`
  (correctly still "Title" — released UI not yet relabeled) and the train edit `ad761f2` (correctly "Owner
  title") — plus a parallel-surface sweep across `docs/**` for the DQ "Title"/"Owner title"/`titleIds` filter.
  Broader subtrees covered by prior `/review` passes (CTRIB-010 covered activity/collab/ADR).
- **Findings**: **none new.** The parallel-surface sweep is clean — `dashboard.md` is the ONLY doc page
  describing this filter, so no other surface needs the relabel; the edit content is high quality. The single
  docs issue (the dangling commit) is the per-item blocker above, tracked by DOC-453 — not a separate
  editorial finding.

### Notes
- **What's excellent (so the block is read correctly):** the diff is minimal and exactly plan-bounded; the
  root cause is code-verified (`OWNERSHIP.TITLE_ID`, both query arms); Gate 4 consumer-read holds exactly
  (2 consumers, only the ambiguous one changed, shared key preserved); the unit build is green on my own run;
  the FE unit + IT-130 are well-designed; the ontology moved with the code; the GitHub artefacts (draft PR,
  root-cause+scope comment, milestone) are all real and verified. The implementer also self-caught the
  `owner-title-directory.spec.ts` blast-radius via the full regression (run #1) and fixed it in-scope — the
  gate working as intended.
- **Evidence-hygiene nit (not a blocker):** `run-log/2026-06-14-feature-complete.md` left the `runner:` and
  `evidence/notes:` template placeholders unfilled — fill them so the run-log is self-describing evidence.
- **i18n:** `ua/hy/ch` translations are maintainer-accepted best-effort per GATE 1 — not re-litigated.
- **Banned-phrase check:** none used.
- **Upstream/follow-ups on disk:** none new (DOC-453 already tracks the docs; its status claim is corrected as
  part of the un-block).
- **VERIFIED via:** `git merge-base --is-ancestor` / `git branch --contains` / `git show <branch>:<path>` (the
  dangling commit); `git diff origin/main...a96745ef` (the bounded diff); `grep` (consumers); `scripts/run-platform-tests.sh`
  (unit build, my run); GitHub API (`/issues/1767/comments`, `/pulls/1782`, issue milestone). The integration
  bucket is **NOT VERIFIED by me this session → deferred to re-review** (reason recorded above).

---

## Fix applied (2026-06-14, maintainer-directed un-block)

The maintainer directed the un-block immediately after the review. Both fixes applied + verified:

1. **Docs routed — FF applied.** `git branch -f release/0.28.0 ad761f2` in `../documentation` (preconditions
   verified first: `ad761f2^ == f6f9ccc ==` the `release/0.28.0` tip → a clean fast-forward, no CTRIB-010
   commits lost; `release/0.28.0` was not the checked-out branch, so the maintainer's WIP on
   `docs/lookup-table-description-caveat` was undisturbed). Verified after: `release/0.28.0` `f6f9ccc → ad761f2`;
   `git show release/0.28.0:docs/data-quality/dashboard.md` now reads **"Owner title"** (`:60` list, `:63`
   caveat, `:65` combine note); `git log release/0.28.0` shows `ad761f2` on top of `f6f9ccc` (linear). The
   commit is **local** — the maintainer pushes the train at the release gate (the bot cannot push docs).
2. **Routing claims corrected.** The false "pushed; FF over the train tip f6f9ccc / DONE + ROUTED" in the
   `### Docs` block above and "Authored + **pushed**" in `backlog/docs/DOC-453.md` are rewritten to the true
   state: committed locally on the train, fast-forwarded 2026-06-14, not yet pushed.

**Effect on the verdict:** the sole blocker (criterion 6 / Gates 6/8/9 — docs not routed) is **RESOLVED**.
The verdict's `## Review` table stands as the point-in-time record. Status returned `blocked → pr-draft`.

**Still required before `review-ready` (do NOT self-flip):** the FULL integration regression (G-C2 —
`feature-complete` + `multi-stack` + `known-bugs` + `ingestion-e2e`) deferred at review must run on a free
stack in a **separate** `/review` session (this session has now also done implement-side work — the FF +
claim corrections — so a fresh session owns the flip). That re-review flips `pr-draft → review-ready`; then
human GATE 2 merges PR #1782.

---

## Re-review (2026-06-14, session: separate /review — the deferred integration regression)

**Result: ACCEPTED — `pr-draft` → `review-ready`.** This separate session ran the FULL integration
regression that the prior review deferred (a maintainer P-001 probe stack had occupied the odd-minimal
ports 18080/15432). The maintainer authorised tearing it down; I ran the whole G-C2 set on a fresh stack
from the working-tree SUT (`a96745ef`). Every gate re-verified PASS first-hand; the docs-routing blocker
(resolved by the un-block FF) was independently re-confirmed on disk.

### Full regression (G-C2) — both buckets, my own runs on `a96745ef`
- **Unit** (`scripts/run-platform-tests.sh` = `:odd-platform-api:build`): **BUILD SUCCESSFUL in 5m 51s**
  (test + `checkstyleMain` + `checkstyleTest` + assemble) — the 2 OpenAPI param descriptions compile.
- **feature-complete** (fresh odd-minimal, working-tree SUT): **286 passed / 0 failed — api:PASS e2e:PASS**.
  IT-130 GREEN (`dq-owner-title-filter-label.spec.ts:27` — "the ownership-role filter reads 'Owner title',
  not the bare 'Title'"); the `owner-title-directory.spec.ts:87` blast-radius spec GREEN.
  (`run-log/2026-06-14-feature-complete.md`)
- **multi-stack** (MinIO / LOGIN_FORM / LDAP / notifications, each self-managed): **9 passed — e2e:PASS**.
- **ingestion-e2e** (real source -> collector -> platform stands): **6 passed — e2e:PASS**.
- **known-bugs** (expected RED): **5 failed, all expected known-bug pins, ZERO unexpected GREEN** —
  IT-007/PLT-086 (attachment durability), IT-006/F-042 (error boundary), IT-004/PLT-052 (DQ unknown-status),
  IT-003/PLT-090 + IT-003/PLT-127 (tsquery poisoning). None CTRIB-011-related; no un-flipped fix.

### Gates re-verified (first-hand, this session)
- **Criterion 6 / Gates 6/8/9 (docs routed — the prior blocker)**: PASS — `git merge-base --is-ancestor
  ad761f2 release/0.28.0` = YES; `git show release/0.28.0:docs/data-quality/dashboard.md` reads
  "Owner title" (:60/:63/:65); routing claims corrected; `main` correctly still reads "Title".
- **Criterion 3 (bounded diff)**: PASS — `git diff origin/main...a96745ef` = exactly the 10 planned files.
- **Gate 4 (consumer-read)**: PASS — post-fix `t('Title')` has ONE production consumer
  (`OwnerTitleAutocomplete.tsx:111`, untouched); `TitleFilter.tsx:29` now binds `t('Owner title')`; shared
  `"Title"` key preserved (`en.json:342`).
- **Gate 1**: PASS — `Owner title` in all 7 catalogs, no overload of the shared key.
- **Criterion 7 (ontology)**: PASS — F-032 H-005 + the DataQualityFilters sidecar `[RESOLVED … CTRIB-011]`
  notes committed (`0955445`).
- **Gate 11**: PASS — operator/consumer language; the `OWNERSHIP.TITLE_ID` mention is GATE-1-approved wording.
- **GitHub artefacts**: PASS — PR #1782 Open + **Draft** + `odd-contributor[bot]`, base `main`, **unmerged**;
  issue #1767 Open, milestone **0.28.0** (WebFetch, this session).
- **Editorial parallel-surface sweep**: clean — `dashboard.md` is the only page describing this filter.

### Separate finding — i18n Portuguese-leak regression (NOT CTRIB-011; logged; does not block)
A maintainer spot-check during this review surfaced the DQ filter placeholders (+ DataModelling labels)
rendering Portuguese ("Buscar por nome", etc.) under every non-Brazilian locale. **Verified root cause:
commit `8b0155f7` (#1564) inserted `br` into `fallbackLng` while `en.json` lacks the keys `br` translates
-> the chain resolves to Portuguese for all users.** Regression vs 0.27.13 (`ede5d277`); unreleased (ships
0.28.0). Scripted blast radius: 4 rendered strings (`Search by name`, `Query`, `Query examples`,
`Relationships`). **CTRIB-011 is clean on this axis** — it added `Owner title` to all 7 catalogs *incl en*,
so it cannot leak, and doesn't touch these fields. Logged: **PLT-011 reopened** (root cause + the
`fallbackLng:'en'` fix), **PLT-215 escalated** (CI key-parity guard = lead prevention). Process-hardening
(LSN + gate rules + a contributor code-fix at GATE 1) tracked separately per the maintainer's direction.

### Working-tree byproducts (not part of the review deliverable)
`run-suite.sh`'s probe phase re-stamped, in the odd-team working tree:
`lineage/odd-platform/feature-flows.yaml`, the two `DataEntityController` sidecars
(`…getDataEntityDetails.md`, `…getPopular.md`), and wrote `lineage/odd-platform/probe-runs/2026-06-14-P-001.yaml`.
Probe-merge artefacts of the regression run, not CTRIB-011 changes — keep or `git checkout` at will.

### Verdict
- **Result**: ACCEPTED — all acceptance criteria + Quality Bar gates + the FULL G-C2 regression PASS.
- **Status**: `pr-draft` -> `review-ready`. GATE 2 (human merge of draft PR #1782) owns the tail.
- **Banned-phrase check**: none.
- **VERIFIED via**: `git merge-base`/`show`/`diff` (docs FF + bounded diff), `grep` (consumers + locale keys),
  `scripts/run-platform-tests.sh` (unit), `run-suite.sh feature-complete/multi-stack/ingestion-e2e/known-bugs`
  (integration — fresh stacks, actual pass/fail read), WebFetch (PR + issue state), the impact script (i18n radius).
