---
ctrib: CTRIB-040
github_issue_number: 1679
issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1679
class: bug + ux-enhancement
milestone: "1.0.0"          # G-C11 — inherits #1679's open+semver milestone (verified at CTRIB-038 intake)
status: pr-draft            # DoD MET; DRAFT PR #1820 OPEN (bot). Hand to /review (separate session) → review-ready → human GATE 2. Never self-review-ready/merged.
reproduced: "maintainer live report (2 defects) + code-definitive root cause (below); formal artifact = the IT RED-on-base e2e (Phase D)"
adr_required: no            # G-C7 does NOT fire (FE-only; no migration / auth / public-contract change)
plan_approved_by: "maintainer (Raman) — GATE 1 via AskUserQuestion, 2026-06-27"
plan_approved_at: "2026-06-27"
docs_routing: "fold into DOC-492 (release/1.0.0) — the behaviour is part of the #1679 filter (now merged via #1818)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1820"
pr_draft: true
pr_url: ""
pr_draft: ""
stream_id: ctrib040
relates_to: "CTRIB-038 / PR #1818 (the #1679 tag/type filter — these two defects are follow-ups ON that feature, which is review-ready but NOT yet merged)"
---

# CTRIB-040 — two UX defects on the #1679 dataset-Structure tag filter (follow-up to CTRIB-038)

## Intake

- **Issue:** [#1679 "Tags / Filterable Datasets"](https://github.com/opendatadiscovery/odd-platform/issues/1679) — **reopened by the maintainer** after spot-checking the CTRIB-038 feature (PR #1818) in the running UI. Two UX defects found.
- **G-C11 (milestone) — PASS** (inherits #1679's `1.0.0` open+semver, verified at CTRIB-038 intake).
- **Relationship:** CTRIB-038 (PR #1818, branch `contrib/CTRIB-038-dataset-structure-tag-filter` @ `c37ca11b`, **review-ready / unmerged**) added the header tag/type column filter. These two defects are on THAT feature — so the fix **stacks on the CTRIB-038 branch** (main has no filter). NOT an amendment of #1818 (maintainer directive: a separate PR to the same issue).

## The two defects (maintainer-reported, treated as the reproduction)

1. **Reactivity — the filter chip list is stale after a column tag-add.** After adding a tag to a column via the per-column Tags editor, the new tag does **not** appear in the header filter-chip list; a full page reload is required.
2. **Discoverability — the chips give no signal they are filterable tags.** The header tag chips render with no label/affordance indicating they are *tags* and that they are *clickable filters* — "the functionality is not obvious."

## Phase B — root cause (code-definitive; verified on the running ctrib038 SUT :18160, image 879ad194)

**Defect 1 — a redux-live / jotai-snapshot split (single-source-of-truth gap).**
- The structure view is backed by **redux** (`datasetStructure.slice.ts`): `getDatasetStructure` (`selectors:56`) derives the field list by mapping `allFieldIdsByVersion[v][parent] → fieldById[id]`; and `updateDataSetFieldTags.fulfilled` (`slice:149-162`) correctly writes `fieldById[id].tags = tags`. ⇒ **after a tag-add, redux is live and correct.**
- But `DatasetStructureOverview.tsx:59` reads that redux structure and passes it to `DatasetStructureOverviewProvider`, which hydrates `datasetStructureRootAtom` via **`useHydrateAtoms(initialValues)`** (`HydrateAtoms.tsx:12`) — and `useHydrateAtoms` **hydrates atoms ONCE at first render only**; it does NOT re-sync when the prop changes. There is **no `useSetAtom`/`useEffect` re-sync anywhere in `…/lib/`** (grep-confirmed).
- ⇒ `availableTags = aggregateFieldTags(datasetStructureRootAtom)` (CTRIB-038's `useStructure.ts`) reads a **frozen snapshot** taken at mount. The per-column tag *display* updates because it reads redux **live** (`getDatasetFieldTags` → `fieldById[id].tags`, `selectors:111-113`); only the atom-derived surfaces (the **filter chips** + the column **list** rows) go stale — until a reload remounts the Provider and re-hydrates. **This matches the maintainer's exact symptom.** (Root cause predates CTRIB-038 — the once-only hydration — but CTRIB-038's aggregate filter is the first surface that makes it user-obvious.)

**Defect 2 — no filter affordance.** `DatasetStructureTagFilters.tsx` (CTRIB-038) renders bare `TagItem` chips with **no label/heading/icon** (grep-confirmed: zero `Filter`/label/heading tokens). The chips look like passive metadata, not a one-click filter — the same is true of the now-clickable type chips. ODD's own precedent labels this gesture: the catalog Overview's tag filter sits under a **"Top tags"** heading (`catalog-overview.md:23`), and Search facets are labelled groups (`search.md`).

## Change-request product analysis (G-C16)

- **Defect 1** is an unambiguous **bug** — the displayed filter set must reflect the column tag set the user just changed; "reload to see it" is not acceptable for a discovery affordance. No product divergence; fix it.
- **Defect 2** is a **discoverability enhancement** — the feature works but is not legible. The product-right shape (per ODD's own catalog-overview "Top tags" + Search-facet labelling) is a short **label** that names the affordance ("Filter by tag"), not a tooltip (invisible at-a-glance). odd-sme/PO convention: filter controls are labelled. Recommend a concise label; exact wording + whether to also label the type chips is a GATE-1 choice.

## Design-before-build (G-C12)

- **(a) Reuse-scan:** Defect 1 reuses jotai's standard sync idiom (`useSetAtom` + `useEffect`) — no new state library; keep `useHydrateAtoms` for the synchronous initial value (no first-paint flash) and ADD a sync effect for the **server-data** atoms only (`datasetStructureRootAtom`, type/field/row counts) — never the **user-interaction** atoms (`searchQuery`, `selectedTagIds`, `selectedFieldTypes`, `selectedFieldId`), so an active filter/search is preserved across the refresh. Defect 2 reuses `Typography variant='body2' color='texts.hint'` (the existing "columns" label idiom in `DatasetStructureHeader.tsx`).
- **(b) ADR-check:** the draft `adrs/drafts/ui-state-management.md` governs server-state fetching; this conforms to the existing redux→jotai Provider pattern (fixes its once-only-hydration gap). No ADR contradicted; none warranted.
- **(c) Impact checklist:** i18n — Defect 2 adds 1 (or 2) new string(s) → **all 7 locales**. Generated clients: none. Consumers: the Provider serves the whole Structure view (blast radius noted — the sync must not clobber user-interaction atoms; covered above). Migrations/API: none. Docs: the behaviour is part of the #1679 filter already routed to DOC-492 (release/1.0.0) — likely fold a one-line "updates live as you tag columns" note there, or `none`. Ontology: FE-presentation only → no node (same as CTRIB-038).
- **(d) PO/SRE lens:** must-haves — the filter reflects post-load tag adds AND removes; the active filter/search survives the refresh; the label is legible (contrast/wrapping) and i18n-complete. Rendered-pixel review on :18160 before handoff (G-C12 step 5).

## Plan (GATE 1 artifact)

**The change (FE only, `odd-platform-ui`, on top of `c37ca11b`):**

1. **Defect 1 — atom re-sync** (`…/lib/`): add a sync that writes the **server-data** atoms (`datasetStructureRootAtom` + the type/field/row-count atoms) from the redux-derived props whenever they change, alongside the existing once-only `useHydrateAtoms` initial hydration. Likely a small `SyncAtoms`/effect inside the `<Provider>` (where `useSetAtom` is in scope) in `DatasetStructureOverviewProvider.tsx`. User-interaction atoms are deliberately NOT synced (preserve active filter/search).
2. **Defect 2 — filter label** (`DatasetStructureTagFilters.tsx` and/or `DatasetStructureHeader.tsx`): add a concise hint label naming the affordance (e.g. `t('Filter by tag')`) before the tag chips; optionally a matching label for the now-clickable type chips. New string(s) → all 7 locales.

**Explicit scope EXCLUSIONS (G-C5):**
- No backend / API / openapi / DB / migration change. No server-side filtering.
- No change to the tag **write** path or the per-column editors (`TagsEditForm`, `DatasetFieldTags`) — Defect 1 is fixed on the read/sync side.
- No wholesale state-management refactor (redux→tanstack-query, the deferred `ui-state-management.md` ADR) — bounded to the Structure-view Provider's hydration gap.
- No change to the CTRIB-038 filter semantics (OR-within/AND-across, Clear-All, reset-on-revision) — only its freshness + discoverability.

**Tests (BOTH buckets, G-C9):**
- **Unit (vitest):** a test that the Structure-view atoms re-sync when the redux structure prop changes (the once-only-hydration regression) — RED on base (atom frozen), GREEN on fix. Plus a render test that the tag-filter label is present.
- **Integration (odd-team IT-NNN, Playwright — MANDATORY, user-facing):** extend/author an IT that loads the Structure tab on a tagged dataset, **adds a NEW tag to a column via the UI**, and asserts the new tag chip appears in the filter **without a reload** (RED on `c37ca11b` = the unfixed CTRIB-038 SUT, GREEN on the fix) + asserts the filter label renders. This RED-on-base run is the **formal reproduction artifact** (a client-side render-staleness bug is invisible to curl).
- **Regression:** full unit build + the FULL integration regression on the working-tree SUT, RED-proof via `ODD_SUT=ref:<CTRIB-038 head>` (the base is the CTRIB-038 branch, not main — main has no filter to regress).

**Docs (G-C10):** fold a one-line freshness note into DOC-492 (release/1.0.0) or record `none + why` after re-reading the page. `docs_routing` TBD at GATE 1.

**Ontology (G-C10):** no refresh (FE-presentation only; no BE node) — same as CTRIB-038.

## GATE 1 — APPROVED 2026-06-27 (maintainer, via AskUserQuestion)

1. **Packaging** — ✅ **one PR** for both defects (CTRIB-040).
2. **Defect-2 affordance** — ✅ **label BOTH the tag AND the type chips** (`"Filter by tag"` + `"Filter by type"`) — the type chips were made clickable in #1679 and share the discoverability gap. **2 new i18n strings × 7 locales.**
3. **Base branch** — ✅ **stack on the CTRIB-038 branch**: branch from `c37ca11b`, target `contrib/CTRIB-038-dataset-structure-tag-filter` (clean review diff of only the fixes; auto-retargets to `main` when #1818 merges; merge #1818 first, then this).

Implementation may proceed (Phase D). RED-proof base = `ODD_SUT=ref:c37ca11b` (the CTRIB-038 head — main has no filter).

## Phase D — implementation + DoD ledger

**Branch:** `contrib/CTRIB-040-dataset-structure-filter-ux` in worktree `../odd-platform-ctrib040` (off the CTRIB-038 head `c37ca11b`; push-safe — `push.default=current`, no `origin/main` upstream). FE commit **`ecd24c35`**.

**Files (FE only — `odd-platform-ui`):**
- **Defect 1:** new `lib/SyncAtoms.tsx` (re-syncs the server-data atoms — structure root + row/type/field counts + versions — from the redux-derived props on change, via `useSetAtom`+`useEffect`, leaving the user-interaction atoms untouched); `lib/DatasetStructureOverviewProvider.tsx` (renders `<SyncAtoms>` inside `<Provider>` alongside the existing `<HydrateAtoms>` initial hydration).
- **Defect 2:** `DatasetStructureHeader.tsx` (a `texts.hint` `Filter by type` label before the type chips in row 1, a `Filter by tag` label before the tag chips in row 2 — the tag label guarded on `availableTags.length > 0`); 7 locale JSONs (`{en,es,fr,br,ch,hy,ua}.json`) — 2 new strings each, translated from each file's own established Tag/Type/Filter vocabulary.
- New test `lib/SyncAtoms.test.tsx`.
- No backend / API / migration / generated-client change.

**Unit bucket (vitest, node 24.13.0) — GREEN + RED-on-base proven.**
- `SyncAtoms.test.tsx` — **2/2 PASS** on the fix: (1) the available tag set re-syncs when a column gains a tag without a remount; (2) an active tag filter survives the re-sync. **RED-on-base CONFIRMED** — with the `<SyncAtoms>` render neutralized (= the `c37ca11b` base), test (1) FAILS at `toHaveTextContent('gdpr')` (the new tag never appears — the once-hydrated atom stays frozen); test (2) still passes (it is a non-regression guard, correct). *(Running it caught a wrong order-assumption in my first draft — the resync worked but `aggregateFieldTags` sorts by name, so the assertion is now presence-based, order-independent — the "run what you write" discipline.)*
- `filtering.test.ts` (CTRIB-038) — **14/14 still PASS** (no regression).
- `tsc --noEmit` whole-project — **clean (0 errors)**; `eslint` touched files — **clean (0)**.
- i18n: 2 new strings (`Filter by tag` / `Filter by type`) present in **all 7 locales** (parity preserved); accurate per-locale translations (e.g. es `Filtrar por etiqueta/tipo`, ua `Фільтрувати за тегом/типом`, ch `按标签过滤/按类型过滤`, hy genitive ` Ֆիլտրել ըստ թեգի/տեսակի`).

**Integration bucket (odd-team `integration-tests/IT-147`).**
- Authored `protocols/IT-147-dataset-structure-filter-reactivity.md` + `e2e/specs/dataset-structure-filter-reactivity.spec.ts`; registered in `suites.yaml` (feature-complete + ui-e2e). Seeds a 3-column dataset (one baseline-tagged via the IT-047 stats path), then **adds a tag through the per-column UI editor** (the only path that exercises the redux→atom flow) and asserts the new chip appears in the header filter **without a reload** + the `Filter by tag/type` labels render.
- **RED proof base = the cached CTRIB-038 image `879ad194` (built from `c37ca11b`)** — IT-147 will RED there (no labels; the new chip never appears without reload). [pending run — see below]
- **GREEN + regression (RAN — SUT built from `ecd24c35`, digest `c66f23f3`):** `run-regression.sh ctrib040 feature-complete known-bugs` (2026-06-27):
  - **feature-complete: 318 passed / 2 failed (6.8m) — GREEN-for-change.** IT-147 **GREEN** (the in-page tag-add updates the filter without reload + labels render); IT-146 (the CTRIB-038 filter) + IT-023/IT-039 (structure display/ingest) all GREEN — the Provider + shared header change broke nothing. The 2 fails = `owner-association-history:93` (F-174) + `remove-user-owner-mapping:123` (F-173), the recurring **TST-054 owner-association SPA-nav flake cluster** (1.0m timeouts; `remove-user-owner-mapping:123` failed identically in the CTRIB-034/037 reviews) — zero code overlap with the Provider/atom/header change.
  - **known-bugs: 3 failed = the 3 expected-RED pins** (IT-004/006/007), 0 unexpected-green.
- **IT-147 RED proof — CONFIRMED.** Against the cached pre-fix CTRIB-038 image `879ad194` (built from `c37ca11b`): IT-147 **e2e:FAIL** at `getByText('Filter by tag')` — "element(s) not found" (the labels do not exist on the base; the reactivity assertion is independently RED-proven by the unit test). GREEN on the fix image (`c66f23f3`, re-confirmed 1-passed).
- **multi-stack + ingestion-e2e:** FE-only-skip per the maintainer-approved CTRIB-031/CTRIB-038 precedent (pure client-side presentation change; the Structure tab + Provider are exercised by feature-complete's IT-023/IT-039/IT-146/IT-147). [reviewer may re-run]

**Pixel review (G-C12 step 5) — rendered header captured on the fix image, TWICE.** First cut matched the GATE-1 option-C layout (type label inline in row 1) — the pixel review surfaced that the inline label tightens the type-chip row so a type chip collapses behind CTRIB-038's pre-existing "Show N hidden" at constrained widths. **The maintainer directed the refinement** ("add for types there row"), so the **type chips were moved to their own full-width row** (`Filter by type` row + `Filter by tag` row, both labelled, below a clean row-1 of columns-count + search + revision). Re-captured screenshot confirms: **both type chips (`2 Str` + `1 Dec`) render fully — no truncation, no "Show N hidden"** — and both filters read clearly as filters. This is the shipped layout (`b69ea1e6`); it deviates from the ASCII option-C mockup precisely because the rendered reality (truncation) defeated that mockup's intent.

**Docs (G-C10) — folded into DOC-492 (release/1.0.0).** No separate doc item: CTRIB-040 changes the same #1679 filter DOC-492 documents. Updated DOC-492's drafted content — the two chip rows are now labelled (**Filter by type** / **Filter by tag**) and the filter "stays in step with the column tags as you edit them — tag a column and its tag appears in the **Filter by tag** row immediately." Gate 11 clean (operator language). `docs_routing: release/1.0.0` (DOC-492, pending-release; publishes at the 1.0.0 gate).

**Ontology (G-C10) — no refresh warranted.** FE-presentation only (a client-side atom-sync + header labels); adds no BE concept / entity / operation / edge; no DatasetStructure-FE sidecar exists. Same basis as CTRIB-038.

**Principal sufficiency (G-C13).** The non-trivial logic (the atom re-sync + the "don't clobber user state" guard) is unit-covered RED→GREEN; the user-observable flow (tag-add → filter updates, labels render) is IT-147-covered. No control lost — `SyncAtoms` is a small additive component; the Provider keeps its initial `useHydrateAtoms` (no first-paint flash) + gains the sync. No existing functionality harmed (feature-complete regression is the measurement). UI reviewed as rendered pixels on the running stack (see Pixel review above).

## Phase E — draft PR + handoff (GATE 2)

**The world moved while this was in flight (trust the live tree, O4/O8/O9):** the CTRIB-038 filter PR **#1818 MERGED to `main`** (squash `de6992c1`; its `Closes #1679` re-closed the issue → the maintainer **reopened** it, `state_reason: reopened`, milestone 1.0.0), and `main` advanced further (favorites #1819 → `66c472e2`). So this follow-up no longer stacks on a branch — it **targets `main`**. The filter FE on `main` is **byte-identical** to the `c37ca11b` I built on (the favorites slices are BE-only), so the change **rebased cleanly** onto `origin/main`.

- **Branch:** `contrib/CTRIB-040-dataset-structure-filter-ux` @ **`b69ea1e6`** (rebased onto `origin/main` 66c472e2; 1 commit, 11 files +242/−10). **PUSHED** via the `odd-contributor` App (same-name refspec; `main` untouched, O6/LSN-038; pre-push `@{u}≠origin/main` guard passed).
- **DRAFT PR [#1820](https://github.com/opendatadiscovery/odd-platform/pull/1820)** — `draft: true`, base `main`, author `odd-contributor[bot]` (cannot self-approve → human GATE 2, G-C4), body **`Part of #1679`** (live auto-close-keyword check CLEAN — no `Closes/Fixes/Resolves #1679`). Title/body: `contributor/CTRIB-040-pr-body.md`.
- **GitHub credentials (the user's "consult /contribute"):** the bot mints a short-lived **1-hour** installation token from the `odd-contributor` GitHub App key — `scripts/gh-app/gh-token.sh` (auto-sources `~/.config/odd-contributor/`), per `playbooks/github-write.md`. Used inline for the push (token-URL, **masked in all output, never persisted** to the remote config) + the `POST /pulls`, then discarded. *(My initial "no token" read checked only the git remote — the App-mint path WAS configured; the user's pointer was right.)* App scope: Issues/PR/Contents (write) + Metadata (read) — no Administration, no merge endpoint.
- **#1679:** open (reopened). This PR uses `Part of #1679` (not a closing keyword) so it does NOT auto-close on merge — the maintainer closes #1679 when satisfied (it has drawn two rounds of follow-ups; leaving the close to the human is the safe call).
- **DoD — five gates run** at the FE-identical `9ff83c46` (+ the **confirmation rebuild on the pushed `b69ea1e6`**, below): (1) FE unit GREEN (`SyncAtoms.test.tsx` 2/2 + `filtering.test.ts` 14/14; tsc+eslint clean) + RED-on-base proven; (2) integration — IT-147 GREEN + feature-complete **320 passed FULLY GREEN** + known-bugs 3-RED-expected; IT-147 RED proof on the cached pre-fix CTRIB-038 image (`879ad194`) confirmed; (3) docs → DOC-492 (release/1.0.0); (4) ontology no-refresh; (5) Principal sufficiency — pixel-reviewed, **type chips moved to their own full-width row → no truncation (the maintainer's requested refinement)**. The rebased base (`66c472e2`) differs from the build base only in orthogonal favorites BE (#1817/#1819) — not exercised by feature-complete and already green on `main` (ctrib039's run).
- **Confirmation rebuild on the pushed SHA `b69ea1e6`:** [RUNNING — counts recorded on completion].
- **Next:** a separate `/review` session (reject-by-default; can re-run IT-147 GREEN + RED against the cached SUTs in ~2 min) flips `pr-draft → review-ready` → **human GATE 2** approves + merges PR #1820.
- **Stream hygiene:** the ctrib040 SUT images kept for `/review`'s cheap re-run; the RED-proof + screenshot stacks torn down `-v`; `lineage/**` probe drift reverted to HEAD (G-C10 no-refresh).
