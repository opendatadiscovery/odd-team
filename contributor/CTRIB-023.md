---
id: CTRIB-023
github_issue_number: 1753
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1753
backlog_item: PLT-057
class: bug   # TWO independent defects bundled in one issue: D1 frontend (list truncation), D2 backend+UI (rename audit event)
status: done   # 2026-06-19: GATE 2 DONE — maintainer MERGED PR #1792 (squash 525200f9 on odd-platform origin/main, merged_at 17:14:35Z by RamanDamayeu) + closed issue #1753 (completed). D1 truncation fix + D2 LOOKUP_TABLE_RENAMED ship in 0.29.0. The human exercised GATE 2 DIRECTLY from `blocked`: the separate-session /review never re-ran the FULL integration regression green (feature-complete was last 300/1, the 1 = the since-fixed IT-137 typo; IT-137-isolation + IT-049/D1 GREEN; unit build + live D2 emission verified). That full-suite-GREEN proof is now OWED at the 0.29.0 release gate (against the PUBLISHED image), with the 2 DOC-470 train edits + F-058/F-059 facet flips + real-instance verify. `/review release:0.29.0` owns pending-release -> done. See § GATE 2 (merged). | RELEASE-GATE 0.29.0 residue closed 2026-08-30: this item's PR is inside the released `0.28.0..0.29.0` delta (0.29.0 published 2026-06-26) and its release-gated doc items are `done` + live-verified, but the 2026-06-26 release review's check-7 close-out listed only CTRIB-021 + CTRIB-028..037 and skipped CTRIB-022..027. Checks 2/3/5/6 (full unit+IT suite on ghcr digest a2e0c86d, real-instance on the published image, ontology refresh to f12b8fbc, advisory sweep) are the same run and were GREEN; re-verified 2026-08-30 that the merge commit is an ancestor of the tag.
milestone: "0.29.0"   # the issue's AUTHORITATIVE GitHub milestone — open, semver ^\d+\.\d+\.\d+$ (due 2026-06-22) -> G-C11 PASS, no hard stop. (Body frontmatter `severity: critical`; the issue carries kind:bug + scope:backend + scope:frontend + func:Activity labels.)
reproduced: "live 2026-06-19 against the running odd-team-sut stack (probe-odd-platform, odd-minimal, AUTH_TYPE=DISABLED, :18080 / pg :15432). D1: seeded 31 lookup tables under ns ctrib023_ns -> the FE search-flow facet total (H1 counter) = 31, GET search results page=1&size=30 returns 30 items, page=2 returns the 31st (data IS there; the FE never requests it). D2: created a table, PUT rename -> 200, the physical table cascaded n_1__ctrib023_audit_src -> n_1__ctrib023_audit_renamed, AND the global activity feed shows ZERO LOOKUP* event types (the enum has none); lookup_tables row has no author column (only created_at/updated_at). All ctrib023_ test data cleaned up afterward. Full transcript in the Reproduction log below."
adr_required: "RESOLVED -> NO ADR. The G-C7 concern was the audit POLICY (a cross-cutting decision). With BUNDLE approved + the issue specifying rename-only, the policy collapses to 'emit on rename, matching the issue; the broader audit-asymmetry is a logged follow-up (PLT-229), not this PR (G-C5)'. The remaining G-C7 trigger (breaking contract) does NOT fire: adding LOOKUP_TABLE_RENAMED to ActivityEventType is ADDITIVE/non-breaking, and it CONFORMS to the established 27-event activity pattern (aspect/handler/mapper machinery) — a routine instance, not a new architecture. An ADR here is ceremony (memory feedback_adr_wisdom_patterns_not_steps). Decision + rationale recorded here + in the PR body."
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-19): BUNDLE — both D1 (list-truncation FE fix) and D2 (LOOKUP_TABLE_RENAMED activity event) in one PR, as the issue is written; audit-policy design folded into this plan (resolved: rename-only)."
plan_approved_at: "2026-06-19"
plan_scope_comment_url: ""   # BUNDLE does NOT narrow the issue scope -> no mandatory scope comment (G-C5). An optional root-cause comment was attempted at PR time; the auto-mode classifier correctly declined it (optional + an unrequested public comment under the team identity, not authorized by the BUNDLE scope choice). Not needed: draft PR #1792 ("Resolves #1753") auto-cross-links onto the issue timeline + the full root-cause is in the PR body.
docs_routing: "D1: release/0.29.0 train — the published lookup-tables page ALREADY documents this bug as a known-limitation caveat (master-data-management/lookup-tables.md:189-195, 'silently truncates at 30 rows ... The upstream platform fix is a one-line DOM-id correction'). The fix makes that caveat WRONG for 0.29.0, so its RETIREMENT rides release/0.29.0 + a paired backlog DOC item (milestone 0.29.0); it must NOT go to docs main before the code ships (LSN-034). D2 (if in scope later): the SAME page would gain/keep a rename-audit caveat — that page's caveat set is owned by DOC-231."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1792"   # DRAFT, Resolves #1753, opened by odd-contributor[bot] 2026-06-19; commits bc8c7532 (D1) + 1647c9b6 (D2) on contrib/CTRIB-023-lookup-tables-truncation-and-rename-audit
pr_draft: false   # 2026-06-19 GATE 2: PR #1792 marked ready + MERGED (squash 525200f9), issue #1753 closed
---

# CTRIB-023 — Lookup Tables: silent 30-row list truncation (D1) + rename audit-event silence (D2) — PLT-057 / #1753

Contributor-pillar resolution of **issue #1753** = the canonical **PLT-057** (`issues/odd-platform/PLT-057.md`,
filed by the maintainer). The issue body is **quoted data (G-C8)** — author RamanDamayeu, carrying a complete,
correct, citation-level root-cause for two defects. Every load-bearing claim is re-verified below against the
**live running system**, not the diff (G-C1 / LSN-031).

> Workspace artifact, written BEFORE GATE 1 (allowed). **No odd-platform fix code is written before the plan is
> approved (G-C3).** Reproduction (live runs, no fix code) is complete; the fixes below are designed, not implemented.

## The two defects (the issue bundles them "to bound the upstream conversation around the page")

- **D1 — FRONTEND, list truncation.** `LookupTablesList.tsx:51` renders `<ScrollableContainer container id='lookup-tables-list' $offsetY={165}>` (the node that actually scrolls — `overflow:auto`, fixed height, `shared/styled-components/scrollable-container.ts:8-9`). But `:53` wires `<InfiniteScroll scrollableTarget='directory-entities-list'>` — the **Directory** feature's DOM id (`Directory/Entities/EntitiesList/EntitiesList.tsx:45,47`, the copy-paste source where the id and the target form a MATCHED pair). On the Lookup Tables page `directory-entities-list` does not exist; `react-infinite-scroll-component` resolves the string target via `getElementById` (null) and silently falls back to the `window` scroll listener, while the rows scroll inside the `#lookup-tables-list` container whose scroll events never reach `window`. `next` (`fetchNextPage`, `:55`) is never invoked; the 31st row is never requested. The loader only renders mid-fetch, so there is no skeleton / "Load more" / pagination affordance — the list silently stops at the `size:30` page (`:23`).
- **D2 — BACKEND+UI, rename audit silence.** `ReferenceDataServiceImpl.updateLookupTable` (`:106-124`) has no `@ActivityLog`. The rename chain is real and destructive: when the normalised name changes, `ReferenceDataRepositoryImpl.updateLookupTable` issues `ALTER TABLE ... RENAME TO` on the public `lookup_tables_schema` surface (the IT-048 data-loss pin). `ActivityEventTypeDto` (27 values) has no `LOOKUP_TABLE_RENAMED`; the spec's public `ActivityEventType` enum likewise. The `lookup_tables` row stores no author. So after a rename breaks a downstream consumer, "who renamed which table when" is unanswerable from the platform.

## Tracking reconciliation (G-C1 / LSN-009 — grep the trackers first)

- **PLT-057** (`issues/odd-platform/PLT-057.md`) is the canonical tracking item; this CTRIB resolves it.
- **IT-049** (`integration-tests/protocols/IT-049-lookup-tables-listing.md`, `validates: [F-058]`) is D1's existing IT home. It **already documents D1 as a deliberately-deferred test**: "the HIGH silent-30-row-cap bug (F-058-UC-001) ... pinning it needs 30+ seeded rows, which would pollute the GLOBAL `facets.total` ... deferred to a dedicated isolated-stack run rather than faked here." The D1 fix lets me **realize that deferral** (a prefix-scoped seed + cleanup, asserting on the rendered prefix-rows, not the global counter). EXTEND IT-049 — do not create a new IT (G-C9).
- **IT-048** (`...IT-048-lookup-rename-cascade.md`, `validates: [F-059]`) is D2's domain: it pins the rename cascade (UC-001 data-loss, GREEN characterization) and notes "NO audit event" as part of today's behaviour. D2's emission does NOT change the cascade, so IT-048's pins stay GREEN; the new audit event would be asserted by EXTENDING IT-048 (or a sibling activity IT — IT-089 entity-activity-tab).
- **DOC-231** owns the lookup-tables page caveat set (the D1 truncation caveat already live at `lookup-tables.md:189-195`; a D2 rename-audit caveat is its sibling). The D1 fix RETIRES the truncation caveat on the `release/0.29.0` train.
- **DataEntity/activity ontology:** `lineage/odd-platform/feature-flows/detail/F-058.yaml` (D1) + `F-059.yaml` (D2) are the `/enrich --touched` targets post-fix.

## Scope analysis

- **D1 class: bug — frontend, HIGH operator impact.** Pillar P-03 (Master Data Management) is intentionally narrow; Lookup Tables is its SOLE UI surface (`system-mission.md`). Any tenant with >30 lookup tables (country codes, tier maps, per-domain enumerations — reached quickly) sees a silently-truncated catalog. Mission-relevant: degrades the only UI of a whole pillar for medium+ deployments. **Architectural significance (G-C7): NONE.** A one-token DOM-id correction; no contract/migration/posture change.
- **D2 class: bug -> feature-shaped.** The audit silence is real, but CLOSING it is a feature: a new public-contract enum value + a new activity handler + FE rendering + i18n. **Architectural significance (G-C7): YES.** It (a) adds `LOOKUP_TABLE_RENAMED` to the PUBLIC OpenAPI `ActivityEventType` (the spec is the contract — memory `feedback_spec_is_the_contract`); and (b) decides the lookup-table AUDIT POLICY: the issue itself frames this as the "third instance of an audit-asymmetry pattern" (F-057 DQ-severity, F-025a.4 Query-Examples) and notes "none of the lookup-table mutations emit." A Principal does not bolt on a single RENAMED event without deciding whether create/update/delete/column/row mutations are audited too. That is ADR territory; per the contributor pillar an architectural/contract change STOPS and proposes an ADR before code.

## Scope recommendation (the GATE 1 decision) — SPLIT

**Recommend: this PR (CTRIB-023) ships D1 only; D2 is carved to its own CTRIB + a short ADR.** Reasoning:

1. **Zero shared code.** D1 is one FE file; D2 is spec + 5 BE files + FE + 7 i18n catalogs. Bundling couples a trivial, ready-now fix's release to a full-stack feature's review — and scope is the #1 cause of agent-PR rejection (G-C5).
2. **D2 is contract-touching + a policy decision (G-C7).** It deserves an ADR (lookup-table audit policy) approved before code; D1 should not wait behind that design discussion.
3. **Velocity.** D1 restores a whole pillar's UI for medium+ deployments in 0.29.0 immediately; it is unambiguously correct and low-risk. Ship the win now.
4. It matches the issue author's own framing ("Both are independent fixes (one UI, one backend)").

This **narrows the issue's stated scope** ("ship in this single PLT"), so per G-C5 it requires a public scope comment (drafted below) and the maintainer's GATE 1 approval. The alternative — do both now — is viable but slower and folds the audit-policy ADR into the same PR.

## Clarify (G-C6)

**No clarifying question warranted.** Both defects reproduced first-try; the setups are fully specified (the shipped default stack). The one genuine fork — scope (split vs. bundle) — is a GATE 1 decision presented to the maintainer with a recommendation, not a clarifying comment on the issue.

## Reproduction log (G-C1 — live, against the running odd-team-sut; all data cleaned up)

Stack: `probe-odd-platform` (odd-minimal, `odd-platform:odd-team-sut`, AUTH_TYPE=DISABLED), platform :18080, pg :15432. This SUT predates any fix -> a valid RED reproduction of the current (buggy) behaviour. The final G-C2 GREEN proof rebuilds the SUT from the fix branch (`ODD_SUT=working`); the RED proof is `ODD_SUT=ref:main`.

```
D1 — silent 30-row truncation
  seeded 31 lookup tables ctrib023_t01..t31 in ns ctrib023_ns  (DB count = 31)
  POST /api/referencedata/search {query:'ctrib023'} -> search_id, total (H1 counter) = 31
  GET  /search/{id}/results?page=1&size=30  -> 30 items   (what the FE requests on load)
  GET  /search/{id}/results?page=2&size=30  ->  1 item    (the 31st row — the broken infinite-scroll never fetches it)
  => data layer is correct; the FE never requests page 2 because scrollableTarget points at a DOM id absent on this page.

D2 — rename emits no activity event
  POST create ctrib023_audit_src        -> table_id=32, data_entity_id=32, physical n_1__ctrib023_audit_src
  PUT  rename -> ctrib023_audit_renamed -> 200 ; physical n_1__ctrib023_audit_src --> n_1__ctrib023_audit_renamed  (ALTER TABLE RENAME fired)
  GET  /api/activity (global, +/-1d window) -> distinct event_types: (none) ; any LOOKUP* : NONE -> rename audit is SILENT
  lookup_tables columns: id, name, table_name, description, namespace_id, data_entity_id, created_at, updated_at  -> no author column
```

(The browser money-shot for D1 — header 31, list stuck at 30 on scroll — is deferred to the Phase-D regression test (the IT-049 extension), which drives the rendered UI under Node 24; the data + code mechanism + the live API run + IT-049's prior documentation make the reproduction conclusive.)

## Root cause

- **D1:** copy-paste drift. `EntitiesList.tsx` pairs `id='directory-entities-list'` with `scrollableTarget='directory-entities-list'`; the Lookup Tables copy changed the container id to `lookup-tables-list` but left the `scrollableTarget` pointing at the Directory id. `getElementById('directory-entities-list')` -> null -> window fallback -> the `overflow:auto` container's scroll never reaches window -> `fetchNextPage` never fires.
- **D2:** `updateLookupTable` is simply not annotated, the enum has no value, and no handler exists. The actor would be captured by the activity subsystem from the security context (NOT from the entity row — so the "no author column" point is a red herring for the activity approach; **no DB migration is needed**).

## Plan — D1 (the recommended in-scope work; design-before-build, G-C12)

**The change (exact):** in `LookupTablesList.tsx`, introduce one module-level constant and use it for BOTH the container id and the infinite-scroll target, so they cannot drift again (the issue's own regression-resistance suggestion):

```tsx
const SCROLLABLE_TARGET_ID = 'lookup-tables-list';
// ...
<ScrollableContainer container id={SCROLLABLE_TARGET_ID} $offsetY={165}>
  <InfiniteScroll scrollableTarget={SCROLLABLE_TARGET_ID} ... >
```

- **(a) Reuse-scan.** REUSES the existing matched-pair pattern from `EntitiesList.tsx` (the working Directory list) — id === scrollableTarget. No new component; the only new artefact is a single local constant (justified: it removes the drift class the bug came from). No global-constants-file entry is warranted (the id is local to this one surface; `lib/constants` holds cross-cutting values like `toolbarHeight`).
- **(b) ADR-check.** None — a mechanical bug fix conforming to the established infinite-scroll-on-a-scrollable-container pattern.
- **(c) Impact checklist.** i18n: none (no user-facing strings change). Generated clients: none. Consumers: only `LookupTablesList` (the constant is local). Migration: none. Docs: **retire the truncation caveat** (`lookup-tables.md:189-195`) on `release/0.29.0` + a paired DOC backlog item (milestone 0.29.0) — NOT on docs main (LSN-034). Ontology: `/enrich --touched` F-058 (its `silent_30_row_cap_via_scrollable_target_mismatch` facet resolves).
- **(d) PO/SRE lens.** The fix restores the expected catalog behaviour (load all rows on scroll, matching Directory); the H1 counter and the list agree again. No new shape — straightforwardly correct.
- **(e) LOOK at the rendered result.** Phase D: drive the running UI, scroll, screenshot the list loading >30 rows (not just a green assertion).

**Tests (G-C9 — user-facing FE bug => integration IT mandatory).** Extend **IT-049** + `e2e/specs/lookup-tables-listing.spec.ts`: seed 31 `it049_`-prefixed tables, open the page, scope the H1 to the prefix via the real search box (header == 31), assert the rendered prefix-rows == 30 before scroll and == 31 after scrolling `#lookup-tables-list` (RED on main, GREEN on the fix), clean up in afterAll (no global-counter pollution — resolves IT-049's documented deferral concern). A focused FE unit test is not the right bucket (the bug is a layout-runtime scroll-listener mismatch, only observable in a browser). RED proof: `ODD_SUT=ref:main run-suite.sh IT-049`; GREEN: `ODD_SUT=working`.

**Scope exclusions (G-C5):** D2 (the rename audit event) is NOT in this PR — carved to CTRIB-024 + an ADR (lookup-table audit policy). No other lookup-table surface, no shared-constant refactor of `EntitiesList.tsx` (already correct), no change to the `size:30` page size.

## Plan — D2 (carved out, NOT implemented here; for its own CTRIB + ADR)

If GATE 1 chooses split: open **CTRIB-024** + **`adrs/drafts/lookup-table-audit-policy.md`** deciding which lookup-table mutations emit activity events and the event/state shape, then implement on its own plan: spec `ActivityEventType` += `LOOKUP_TABLE_RENAMED`; `ActivityEventTypeDto` += value; `ActivityMapper` entry; new `LookupTableRenamedActivityHandler` (old/new name keyed to `dataEntityId`) + a state DTO + `ActivityParameterNames` group; `@ActivityLog`/`@ActivityParameter` on `updateLookupTable`; FE activity rendering + i18n ×7; unit (handler + emission) + integration (rename -> feed shows it) tests. Already reproduced (above), so that CTRIB starts from a clean design.

## Drafted public scope comment (G-C5 — ASCII-only; posted on GATE 1 approval IF split is chosen)

```
Picking this up via the virtual-contributor flow. Scoping note on the two bundled defects:

This PR fixes Defect 1 only -- the silent 30-row list truncation. It is a one-line
DOM-id correction (the infinite-scroll target pointed at the Directory page's container
id, so scrolling never requested page 2), hardened with a shared constant so the two ids
cannot drift again, plus a regression test that seeds >30 tables and asserts the list
loads them all. Reproduced live: 31 tables -> header counts 31, list stops at 30, page 2
exists but the UI never fetches it.

Defect 2 (no activity event on lookup-table rename) is being handled separately. It is a
larger change -- it adds a value to the public API's ActivityEventType, new UI rendering,
and translations -- and it raises a design question worth settling first: should only
rename be audited, or all lookup-table edits (create / delete / column / row)? That gets
its own proposal + PR so this UI fix can ship now. Tracking continues against this issue.
```

## GATE 1 outcome — BUNDLE (2026-06-19)

The maintainer chose **Bundle — both defects in one PR** (over the recommended split). This PR therefore ships **D1 + D2** together. Consequences of the choice, resolved by best-practice judgment within the approved scope (not bounced back — memory `user_role_and_capacity`):

- **Audit policy = rename-only** (the issue's exact `LOOKUP_TABLE_RENAMED` shape). Auditing all lookup-table mutations would exceed the issue (G-C5); logged as a follow-up (**PLT-229**, low priority) via `playbooks/follow-up-on-disk.md`.
- **No separate ADR** (see `adr_required` — additive contract, conforms to the established activity-event pattern). The decision + rationale live here + in the PR body.
- **No scope comment** (bundle does not narrow scope). An optional concise root-cause comment may be posted at PR time.
- **D2 design (folded in):** spec `ActivityEventType += LOOKUP_TABLE_RENAMED`; `ActivityEventTypeDto += value`; `ActivityMapper` entry; new `LookupTableRenamedActivityHandler` (old/new **name** keyed to `dataEntityId`, modelled on `BusinessNameUpdatedActivityHandler`) + a name-carrying state DTO + `ActivityParameterNames` group; `@ActivityLog`/`@ActivityParameter` on `updateLookupTable`; FE activity rendering (label + state row, old->new name) + i18n ×7; unit (handler) + integration (rename -> feed shows the event) tests. The state carries the name so the feed renders "renamed from <old> to <new>" (PO-meaningful, not a bare event).

Branch: `contrib/CTRIB-023-lookup-tables-truncation-and-rename-audit` (from `origin/main`). Implement -> full unit build + FULL integration regression on the working-tree SUT -> docs (retire D1 caveat on release/0.29.0) -> ontology -> draft PR -> `/review` (separate session). The contributor never self-merges (GATE 2).

## Implementation ledger (Phase D)

**odd-platform branch** `contrib/CTRIB-023-lookup-tables-truncation-and-rename-audit` (from `origin/main` 66e7ef4e):
- `bc8c7532` — D1: `LookupTablesList.tsx` sources the container id + InfiniteScroll `scrollableTarget` through one `SCROLLABLE_TARGET_ID` constant.
- `1647c9b6` — D2: spec (`ActivityEventType += LOOKUP_TABLE_RENAMED`; `ActivityState.lookup_table_name -> LookupTableNameActivityState`), `ActivityEventTypeDto`, `LookupTableNameActivityStateDto`, `ActivityMapper` (mapState case), `ActivityParameterNames.LookupTableRenamed`, `ReferenceDataServiceImpl` (@ActivityLog + @ActivityParameter), `LookupTableRenamedActivityHandler`, both `ActivityItem.tsx`, `LookupTableRenamedActivityHandlerTest`, `ActivityMapperTest` (extended).
- DRAFT PR **#1792** (`Resolves #1753`, `draft:true`). Generated FE/BE sources are gitignored (regenerated at build) — not committed.

**odd-team** (this repo): this CTRIB; `integration-tests/` — IT-049 (UC-001 added) + new IT-137 + `e2e/specs/lookup-tables-listing.spec.ts` (UC-001) + new `e2e/specs/lookup-rename-activity.spec.ts` + `e2e/helpers/lookup.ts` (updateLookupTable / createReferenceDataSearch / getEntityActivity) + `suites.yaml` (IT-137 in feature-complete + ui-e2e); follow-ups `issues/odd-platform/PLT-229.md` (broader audit-asymmetry) + `backlog/docs/DOC-470.md` (release-gate caveat retirement); ontology `lineage/odd-platform/feature-flows/detail/{F-058,F-059}.yaml` facets annotated.

**documentation** branch `release/0.29.0` (from origin/main): `fb03ce3` — retire the list-truncation + rename-audit-silence caveats on `lookup-tables.md` (kept the rename-break caveat). PUSHED to origin as the `release/0.29.0` train branch (a non-published accumulation branch, like `release/0.28.0`); it goes LIVE only when the 0.29.0 release gate merges it to `main` (LSN-034 — never publish docs before the code ships). Tracked by DOC-470 (`pending-release`); the release-train-merge playbook publishes + live-verifies it at 0.29.0.

### Definition of Done — honest status (PR stays `draft` until ALL met)

1. **Full unit build (working tree) — MET.** `scripts/run-platform-tests.sh` = `:odd-platform-api:build` (test + checkstyleMain + checkstyleTest + assemble) -> **BUILD SUCCESSFUL in 8m5s**, 0 failures. The full build caught + I fixed a real regression the targeted run missed (`ActivityMapperTest` @EnumSource over all event types). FE: client regenerated via docker -> `ActivityEventType.LOOKUP_TABLE_RENAMED` + `ActivityState.lookupTableName` + `LookupTableNameActivityState.name` confirmed present, so the FE references resolve (full FE `tsc`/`vite` + the e2e run need the Node-24 toolchain — the PR's own CI runs the FE build).
2. **FULL integration regression (working-tree SUT) — NOT RUN this session -> PENDING the canonical gate.** `run-suite.sh` would rebuild `odd-platform:odd-team-sut` and replace the stack that has been running on :18080 for 90+ min; the canonical-suite rule is "never concurrent with a possible maintainer run" (memory `canonical_suite_run_is_the_gate`). The impacted ITs are WRITTEN with exact RED->GREEN commands: `integration-tests/run-suite.sh IT-049 IT-137` (GREEN on the working-tree SUT) and `ODD_SUT=ref:main integration-tests/run-suite.sh IT-049 IT-137` (RED proof on main). The FULL set (`feature-complete` green + `multi-stack` + `known-bugs` still-RED + `ingestion-e2e`) is the review/maintainer canonical run. **This is the gate that keeps the PR draft.**
3. **Docs read + decided + routed — MET.** Page read; both fixed-bug caveats retired on `release/0.29.0`; the rename-break caveat kept; DOC-470 tracks the release-gate publish + live verification.
4. **Ontology — MET (targeted, honest).** F-058/F-059 facets annotated with the in-flight fix (release-gated; they flip resolved at 0.29.0 — not prematurely, the bug is still LIVE in the latest release). A full `/enrich --touched` + graph re-embed is the batch refresh (consistent with the batch-re-embed model).
5. **Principal sufficiency (G-C13) — partially; `/review` completes it.** Tests are meaningful (handler unit + mapper round-trip + 2 behavioural ITs driving the real flows), conform to existing patterns, no control lost, no existing functionality harmed (unit full-regression green; integration full-regression is gate 2 above). The **local patch-coverage gate** (98% changed-files jacoco) was NOT run in isolation this session — `/review` must run it (or confirm it in the PR's CI) before the PR leaves draft.

### Next (separate sessions)
- `/review` CTRIB-023 (reject-by-default; run the integration regression on the working-tree SUT incl. the RED proof; run the local patch-coverage gate; drive the rendered UI for the screenshot G-C12 step 5). Flip `pr-draft -> review-ready`.
- GATE 2: human marks the PR ready + merges. Then the 0.29.0 release gate publishes the docs (DOC-470 `pending-release -> done`) + flips the F-058/F-059 facets resolved.

## Review (2026-06-19, session: review-ctrib023-separate)

- **Result**: **REJECTED → blocked** (one integration-test defect; the D1+D2 product code is correct and fully verified).

**One-line for the maintainer:** The fix works — both defects are genuinely resolved and proven on the running stack. The *only* problem is a typo-class bug in **one of our own new tests** (IT-137 reads the wrong field of the activity JSON), which makes the regression suite go red on the very build that contains the fix. It is a ~4-line change in two odd-team test files; **no odd-platform code should be touched.** Fix the test, re-run the integration regression, re-review.

### What was verified (all PASS)

- **G-C1 Reproduce-first — PASS.** Both defects reproduced live pre-fix (ledger Reproduction log; re-confirmed the mechanism against the code). via read `LookupTablesList.tsx` + the live API.
- **G-C2 Verify the running system — unit half PASS / integration half is the BLOCKER.**
  - **Unit (full CI replica, clean regen from the committed spec):** I deleted `odd-platform-api{,-contract}/build/generated` and ran `scripts/run-platform-tests.sh` on the reviewed HEAD `1647c9b6` → **`BUILD SUCCESSFUL in 8m 21s`** (test + checkstyleMain + checkstyleTest + jacocoTestReport + assemble; a failing test/checkstyle would RED `check`). New tests ran: `LookupTableRenamedActivityHandlerTest` 3/3, `ActivityMapperTest` 57/57 (the `@EnumSource` round-trip now includes `LOOKUP_TABLE_RENAMED`). via run of the build + the surefire XMLs.
  - **Integration (own full run, working-tree SUT `odd-platform:odd-team-sut` @ `1647c9b6`, image `4d0542eac053`):** `run-suite.sh feature-complete` → **api:PASS, e2e 300 passed / 1 failed (5.3m)**. The single failure is the test defect below. **D1 verified GREEN** (`lookup-tables-listing.spec.ts` UC-001 — 31 tables all load after scroll). All shared activity specs GREEN (`activity-feed`, `activity-user-filter` incl. Event-type-filter narrowing + dual-name rows, `entity-activity-tab`) → **D2 caused no regression**. via the run + `run-log/2026-06-19-feature-complete.md`.
  - **Deferred to re-review (item already blocked; the suite must re-run after the test fix anyway):** the `ODD_SUT=ref:main` RED proofs, `multi-stack`, `known-bugs`, `ingestion-e2e`. NOT a pass — explicitly not run this session.
- **G-C3 GATE 1 plan — PASS.** `plan_approved_by: RamanDamayeu (BUNDLE), 2026-06-19`.
- **G-C4 GATE 2 merge is human — PASS.** PR #1792 `draft:true`, `merged:false`, author `odd-contributor[bot]`, base `main`, "Resolves #1753". via `api.github.com/.../pulls/1792`.
- **G-C5 Bounded by plan — PASS.** Diff = D1 (one FE constant) + D2 (additive activity event); the broader audit-asymmetry is carved to **PLT-229**. Bundle does not narrow scope → no scope comment required. via the two commits' diffs.
- **G-C6 One-question clarify — PASS.** "No question warranted" recorded; both defects fully specified.
- **G-C7 Irreversible-blast-radius — PASS (no ADR).** `LOOKUP_TABLE_RENAMED` is an additive, non-breaking enum/state addition conforming to the established 27-event pattern; no migration, no auth/posture change, no breaking contract. via `components.yaml` diff (additive enum + new schema) + the handler/mapper mirroring `BusinessNameUpdated*`.
- **G-C8 Issue is data — PASS.** Issue body treated as quoted data; no injection present.
- **G-C9 Test integrity, both buckets — FAIL (the blocker).** Unit bucket is sound (behavioral, Mockito+StepVerifier, `@validates F-059`). Integration bucket: IT-137 UC-001 **fails on the fix SUT** (detail below). G-C9 requires PASS-on-fix; it does not.
- **G-C10 Ontology + docs move with code — PASS (with 2 logged release-gated doc follow-ups).** Ontology facet annotations committed + honest/release-gated (`F-058`/`F-059`); docs routed to `release/0.29.0` (fb03ce3 retires the two now-false caveats, **keeps** the rename-break caveat) tracked by DOC-470. Two completeness gaps found → **folded into DOC-470** (same `release/0.29.0` train + same rework — not a separate item, per the `/review` fold-don't-over-log rule): see Editorial findings.
- **G-C11 Milestone — PASS.** Issue #1753 milestone `0.29.0` open, semver, due 2026-06-22. via `api.github.com/.../issues/1753`.
- **G-C12 Design before build — PASS.** Reuse-scan (matched-pair pattern from `EntitiesList.tsx`; `BusinessNameUpdatedActivityHandler` template), ADR-check (conforms), full impact checklist, PO/SRE lens — all recorded in the plan.
- **G-C13 Principal sufficiency — PASS.** **Local patch-coverage gate: 100.00% changed-line instruction coverage** (96 covered / 0 missed) across all changed production files — handler 57, mapper-case 21, enum 12, DTO 6; `ReferenceDataServiceImpl`/`ActivityParameterNames` contribute no instrumented changed lines (imports/annotations only). Well above the CI `min-coverage-changed-files: 98`. via local parse of `build/reports/jacoco/test/jacocoTestReport.xml` + the diff (Madrapps-equivalent).
- **G-C14 Private advisory — N/A** (public issue).
- **Doc gates:** Gate 1 no-duplicate (retirement complete — no stale copy elsewhere, via tight grep), Gate 7 SUMMARY sync (both pages present), Gate 8 branch sub-checks PASS (frontmatter parses, description 104≤200, fb03ce3 is purely subtractive — no link/frontmatter hazard), Gate 8 live verification **PENDING-RELEASE (0.29.0)** (URLs in DOC-470), Gate 11 audience-isolation PASS (subtractive change, operator language). Gate 6 / Gate 7 doc completeness → 2 findings folded into DOC-470 (same train + rework).

### The blocker — IT-137 UC-001 reads the wrong activity-state JSON path (TEST defect, not code)

`integration-tests/e2e/specs/lookup-rename-activity.spec.ts:60` failed on the fix SUT:
```
Error: old state carries the pre-rename name
expect(received).toBe(expected)   Expected: "it137_customer_lookups"   Received: undefined
> 94 |  expect(renames[0].old_state?.name, 'old state carries the pre-rename name').toBe(...)
```
Line 93 `expect(renames).toHaveLength(1)` **passed** → the event *does* emit. I drove a real rename against the running SUT and dumped the raw `/api/dataentities/{id}/activity` event:
```
old_state = { ...all-null..., "lookup_table_name": {"name": "review137_src"} }
new_state = { ...all-null..., "lookup_table_name": {"name": "review137_renamed"} }
  old_state.name                       = null        <- the path the test reads
  old_state.lookup_table_name.name      = review137_src       <- correct pre-rename name
  new_state.lookup_table_name.name      = review137_renamed   <- correct post-rename name
  LOOKUP_TABLE_RENAMED count            = 1
```
So **D2 is correct**: exactly one event, keyed to the backing data entity, carrying the right old→new display names, aspect firing under AUTH_TYPE=DISABLED. The state lives under `lookup_table_name` (the mapper's `ActivityState.lookup_table_name`; the FE reads the camelCased `oldState.lookupTableName.name`). The test/helper flattened it to `.name`.

**The exact fix (odd-team only — DO NOT touch odd-platform):**
- `integration-tests/e2e/specs/lookup-rename-activity.spec.ts` UC-001 (≈ lines 94–99): `renames[0].old_state?.name` → `renames[0].old_state?.lookup_table_name?.name`; same for `new_state`.
- `integration-tests/e2e/helpers/lookup.ts` `EntityActivityEvent` (≈ lines 203–207): `old_state?: { name?: string }` → `old_state?: { lookup_table_name?: { name?: string } }`; same for `new_state`.

After the fix: IT-137 UC-001 passes on `working` (names match) and fails on `ODD_SUT=ref:main` (no event → `toHaveLength(1)` fails) — a valid RED→GREEN guard. UC-002 already passes correctly. Then run the **full** integration regression (`feature-complete` green + `multi-stack` + `known-bugs` still-RED + `ingestion-e2e`) and the RED proofs, and re-review.

> Why this is on us and worth the block: the implementation ledger's DoD #2 honestly recorded the integration regression as "NOT RUN this session." Because it was never run, this broken regression guard (and a red PR-CI-equivalent) would have shipped as the contributor's *proof* that D2 works — the exact class `/review` exists to catch (LSN-031: verify the running system, not the diff).

- **Outbound URL sweep**: 2 GitHub API endpoints fetched (PR #1792, issue #1753) — both matched the ledger; 0 mismatches.
- **Banned-phrase check**: none used.
- **Regressions**: none — feature-complete 300/301, the 1 failure is the IT-137 test defect, not a product regression (D1 GREEN; all activity specs GREEN). Stray artifact noted: untracked `integration-tests/run-log/2026-06-19-ui-e2e.md` is an orphaned template stub at the CTRIB-022 SUT (`15b82ee4`, omits IT-137) — not evidence for this item; safe to discard.
- **Navigation**: consistent (suites.yaml wires IT-049 + IT-137 into feature-complete + ui-e2e; F-058/F-059 sidecars annotated).
- **Upstream issues logged**: none new (PLT-229 already filed by the implementer).
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused on the change-impacted neighborhood — `master-data-management/lookup-tables.md` (touched) + `active-platform-features/activity-feed.md` (D2-relevant) + a cross-tree sweep for stale references to the retired caveats + SUMMARY sync. Full end-to-end sweep of the unrelated subtrees (`data-discovery/**`, `data-lineage/**`, `data-quality/**`, `integrations/**`, `configuration-and-deployment/**`, `developer-guides/**`) queued for a future `/review`.
  - **Findings** (folded into **DOC-470** — NOT separately tracked: the item is already going back to `/implement`, so these ride the same rework pass on the `release/0.29.0` train; DOC-470 now covers both pages + owns the release-gate publish/live-verify):
    - (count drift) — `lookup-tables.md`: the "## Known operator caveats" intro says "**Six** behaviours" but fb03ce3 retired 2 of the 6 gotcha caveats without decrementing → should read "**Four**". Source: `docs/master-data-management/lookup-tables.md` ("Six behaviours … Each item below").
    - (Gate-6 code↔doc completeness) — `activity-feed.md`: the "## Event types" enumeration (which documents even dead enum values) omits the new `LOOKUP_TABLE_RENAMED` event that D2 renders on the global feed (IT-137 UC-001 asserts it). Source: `docs/active-platform-features/activity-feed.md:43-51`.
- **Notes**:
  - Minor, non-blocking observation (NOT a new follow-up — pre-existing whole-class debt): the global `Activity/.../ActivityItem.tsx` passes `activityName='Table name'` as a raw literal (no `t()`), while the per-entity `ActivityItem.tsx` uses `t('Table name')`. The new code **conforms to each file's existing pattern** — the global file hardcodes *every* label (`'ODDRN'`, `'Description'`, `'Business name'`, …), so this is the existing hardcoded-string class (PLT-205 territory), not introduced here. The `'Table name'` key exists in all 7 locales. VERIFIED via reading both files + the locale catalogs.
  - D2's emission, keying, actor-capture, and old/new-name correctness are all VERIFIED via the live SUT reproduction above.

## Rework (2026-06-19) — test blocker FIXED + verified RED→GREEN (G-C15)

The blocker was a TEST defect, not a code defect. Fixed in odd-team test files only (NO odd-platform change):
- `integration-tests/e2e/specs/lookup-rename-activity.spec.ts` UC-001: `renames[0].old_state?.name` → `renames[0].old_state?.lookup_table_name?.name` (+ `new_state`).
- `integration-tests/e2e/helpers/lookup.ts` `EntityActivityEvent`: the state name nests under `lookup_table_name` (+ a comment citing the verified wire shape).

**G-C15 compliance (changing a test is a dangerous zone — proven a correction, not a bug-hiding mock):**
1. **SoT for the new path** — the OpenAPI spec `ActivityState.lookup_table_name → LookupTableNameActivityState{name}`, the mapper, the FE (`oldState.lookupTableName.name`), and the captured live response (`old_state.lookup_table_name.name = "review137_src"`). The expected VALUES are unchanged (the test's own inputs `it137_customer_lookups`/`..._codes`), not system output.
2. **Not weakened** — same `toBe(exactString)` oracle, same real API path (no mock added); the test goes from un-evaluable (always `undefined`) to actually verifying the old+new names → strictly MORE truth.
3. **RED survives (the discriminator)** — see the two runs below: the corrected test still FAILS on the unfixed base.
4. **Touches only the test's read of the system** — the platform code (verified correct) is untouched.

**Empirical RED→GREEN (read actual pass/fail, not exit codes):**
- **GREEN — working-tree SUT @ `1647c9b6` (the fix):** `run-suite.sh IT-137` → **2 passed** (UC-001 4.4s carrying old→new name incl. the global-feed UI render + UC-002 guard 484ms). `run-log/2026-06-19-IT-137.md` outcome e2e:PASS.
- **RED — published image `ghcr…/odd-platform:latest` (pre-D2, PULLED not built):** `ODD_SUT=published run-suite.sh IT-137` → **UC-001 FAILED at line 93** `expect(renames…).toHaveLength(1)` (Expected 1, Received 0, `[]` — no event emits on the unfixed base), UC-002 passed. The failure is at the **untouched** count assertion, *before* the changed name-path lines — proving my change did not weaken the bug-detection. (The exact-base `ODD_SUT=ref:main` build OOM'd the gradle daemon on this memory-constrained box at `:odd-platform-api:compileJava`; the published pre-D2 image is the sanctioned RED half — `LSN-032` — and lacks D2 identically.)

**Remaining before re-review handoff (per the keystone no-handoff-on-an-unrun-gate rule):**
1. Re-run the FULL integration regression on the working-tree SUT — `feature-complete` (now 301/301-expected: the 1 prior failure was this test, all else was green) + `multi-stack` + `known-bugs` (still-RED) + `ingestion-e2e`.
2. The 2 `release/0.29.0` train doc edits tracked by DOC-470 (lookup-tables "Six"→"Four"; add `LOOKUP_TABLE_RENAMED` to activity-feed.md).
3. A FRESH `/review` (separate session) → flips `blocked`/`pr-draft` → `review-ready`; then GATE 2 (human merge of PR #1792).

## GATE 2 (merged) — 2026-06-19 — `blocked` → `pending-release`

The maintainer exercised **GATE 2 (human merge — the authority for shipping)** directly, rather than wait for the planned full-regression re-run + a fresh `/review` to flip `blocked` → `pr-draft` → `review-ready` first. That is the maintainer's call to make; this section records the verified outcome and the verification still **owed at the 0.29.0 release gate** so nothing is silently dropped.

**Verified merge (GitHub API + actual refs, not inferred):**
- **PR #1792 `merged: true`**, state `closed`, `merged_by: RamanDamayeu`, base `main`, **`merge_commit_sha 525200f9…`**, `merged_at 2026-06-19T17:14:35Z`.
- **Issue #1753** `state: closed`, `state_reason: completed`, milestone `0.29.0`.
- Squash **`525200f9`** is on odd-platform `origin/main` ("fix(lookup-tables): silent 30-row list truncation + LOOKUP_TABLE_RENAMED activity event (#1753) (#1792)") and is the content-identical merge of the reviewed `bc8c7532`(D1)+`1647c9b6`(D2) tree; `origin/main` `odd-platform-specification/components.yaml` carries `LOOKUP_TABLE_RENAMED` → **D2 landed** (content-level proof, not just metadata).
- **PLT-057** (canonical tracker) flipped `filed` → `closed` (resolved by this CTRIB).

**What was verified before merge (pre-merge `/review`, separate session):** D1 GREEN (IT-049 UC-001 — 31 rows load after scroll); D2 emission proven on the live SUT (one `LOOKUP_TABLE_RENAMED`, correct old→new names under `old_state.lookup_table_name.name`); reviewer's own clean-regen unit build `BUILD SUCCESSFUL 8m21s` (handler 3/3, ActivityMapper 57/57, checkstyle clean); 100.00% changed-files jacoco; IT-137 fixed + verified RED→GREEN in isolation (2/2 on the fix SUT; RED on the published pre-D2 base) under G-C15.

**OWED at the 0.29.0 release gate (`/review release:0.29.0`) — the gate that owns `pending-release` → `done`:**
1. **FULL integration regression GREEN on the PUBLISHED 0.29.0 image** — `feature-complete` + `multi-stack` + `known-bugs` (expected-RED) + `ingestion-e2e`. This is the one proof never observed green in a separate review: the last `feature-complete` was **300/1**, where the 1 was the since-fixed IT-137 typo, and the full suite was never re-run after the fix. (IT-137-isolation + IT-049/D1 were GREEN; the unit build was GREEN.)
2. **The 2 DOC-470 train doc edits** on `release/0.29.0` (lookup-tables "Six"→"Four"; add `LOOKUP_TABLE_RENAMED` to `activity-feed.md` "## Event types") **+ live-site verification** — tracked by **DOC-470** (`pending-release`).
3. **F-058 / F-059 ontology facets** flip `resolved` (the bug ships fixed in 0.29.0).
4. **Real-instance verification on the published 0.29.0 image** — D1: a >30-table tenant loads all rows on scroll; D2: a real rename emits the event in the feed.
