---
id: CTRIB-023
github_issue_number: 1753
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1753
backlog_item: PLT-057
class: bug   # TWO independent defects bundled in one issue: D1 frontend (list truncation), D2 backend+UI (rename audit event)
status: pr-draft   # 2026-06-19: DRAFT PR #1792 opened (both defects). Awaiting /review (separate session) -> review-ready -> GATE 2 (human merge). The contributor never self-dones.
milestone: "0.29.0"   # the issue's AUTHORITATIVE GitHub milestone — open, semver ^\d+\.\d+\.\d+$ (due 2026-06-22) -> G-C11 PASS, no hard stop. (Body frontmatter `severity: critical`; the issue carries kind:bug + scope:backend + scope:frontend + func:Activity labels.)
reproduced: "live 2026-06-19 against the running odd-team-sut stack (probe-odd-platform, odd-minimal, AUTH_TYPE=DISABLED, :18080 / pg :15432). D1: seeded 31 lookup tables under ns ctrib023_ns -> the FE search-flow facet total (H1 counter) = 31, GET search results page=1&size=30 returns 30 items, page=2 returns the 31st (data IS there; the FE never requests it). D2: created a table, PUT rename -> 200, the physical table cascaded n_1__ctrib023_audit_src -> n_1__ctrib023_audit_renamed, AND the global activity feed shows ZERO LOOKUP* event types (the enum has none); lookup_tables row has no author column (only created_at/updated_at). All ctrib023_ test data cleaned up afterward. Full transcript in the Reproduction log below."
adr_required: "RESOLVED -> NO ADR. The G-C7 concern was the audit POLICY (a cross-cutting decision). With BUNDLE approved + the issue specifying rename-only, the policy collapses to 'emit on rename, matching the issue; the broader audit-asymmetry is a logged follow-up (PLT-229), not this PR (G-C5)'. The remaining G-C7 trigger (breaking contract) does NOT fire: adding LOOKUP_TABLE_RENAMED to ActivityEventType is ADDITIVE/non-breaking, and it CONFORMS to the established 27-event activity pattern (aspect/handler/mapper machinery) — a routine instance, not a new architecture. An ADR here is ceremony (memory feedback_adr_wisdom_patterns_not_steps). Decision + rationale recorded here + in the PR body."
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-19): BUNDLE — both D1 (list-truncation FE fix) and D2 (LOOKUP_TABLE_RENAMED activity event) in one PR, as the issue is written; audit-policy design folded into this plan (resolved: rename-only)."
plan_approved_at: "2026-06-19"
plan_scope_comment_url: ""   # BUNDLE does NOT narrow the issue scope -> no mandatory scope comment (G-C5). An optional root-cause comment was attempted at PR time; the auto-mode classifier correctly declined it (optional + an unrequested public comment under the team identity, not authorized by the BUNDLE scope choice). Not needed: draft PR #1792 ("Resolves #1753") auto-cross-links onto the issue timeline + the full root-cause is in the PR body.
docs_routing: "D1: release/0.29.0 train — the published lookup-tables page ALREADY documents this bug as a known-limitation caveat (master-data-management/lookup-tables.md:189-195, 'silently truncates at 30 rows ... The upstream platform fix is a one-line DOM-id correction'). The fix makes that caveat WRONG for 0.29.0, so its RETIREMENT rides release/0.29.0 + a paired backlog DOC item (milestone 0.29.0); it must NOT go to docs main before the code ships (LSN-034). D2 (if in scope later): the SAME page would gain/keep a rename-audit caveat — that page's caveat set is owned by DOC-231."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1792"   # DRAFT, Resolves #1753, opened by odd-contributor[bot] 2026-06-19; commits bc8c7532 (D1) + 1647c9b6 (D2) on contrib/CTRIB-023-lookup-tables-truncation-and-rename-audit
pr_draft: true
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
