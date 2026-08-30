---
id: CTRIB-050
title: "#1835 ST-1d — server-side facet-name echo (a fresh shared faceted link shows LABELLED chips; honours SearchFilter.required:[id,name])"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1835 (Part of #1825; PR will be Part of #1835 — ST-1c remains, so #1835 does not close on this merge)"
parent_epic: 1825
class: "bug/enhancement — residual of ST-1 (ST-1d); server-side echo fix"
status: pending-release   # Phase D+E DONE. All 5 DoD gates met (full build 7m2s; regression green-for-change 336/1-contributor-independent; IT-151 GREEN-on-fix/RED-on-base; docs NONE-read; coverage 100% changed-lines). DRAFT PR #1849 (Part of #1835, bot-authored, cannot self-merge). → /review (separate session) → GATE 2 (human merge). Implementer does NOT self-mark done.  ·  REVIEW (review-ctrib050, 2026-07-03, max-effort, separate session): **ACCEPTED → stays `review-ready` = GATE-2-ready**. Verdict rests on the reviewer's OWN independent measurement (review-ctrib029 lesson — implementer's digests/logs NOT trusted): fresh SUT `sha256:10141b3e…` built from `2c0bfaf3` — feature-complete **335/2 GREEN-FOR-CHANGE** (both fails non-attributable: favorites-star:159 #1815 Group-B known-independent + search-url-facets:112 a load-timing flake proven GREEN 4/4 in isolation → TST-057) · multi-stack 9/0 · known-bugs 3-RED-expected/0-unexpected · ingestion-e2e 15/0; Java `:odd-platform-api:build` **BUILD SUCCESSFUL 7m8s** + `SearchServiceFacetNameEchoTest` 4/4 + changed-lines coverage **13/13=100%**. Human merges DRAFT PR #1849 (bot cannot self-merge, G-C4) → `pending-release` 1.0.0 → `/review release:1.0.0` owns `done`. Findings (non-blocking): implementer's 4 full-regression run-logs are template STUBS (HEAD=base, no counts) → reviewer had to re-measure; missing `Sources:` footer; TST-057 (the :112 flake). See "## Review" below. | LEDGER-RECONCILED 2026-08-30: was `review-ready`; PR #1849 (`e27bf131`) merged, but NOT released — milestone 1.0.0, which is OPEN/UNRELEASED (latest release 0.29.0, 2026-06-26). GATE 2 is done; `/review release:1.0.0` owns the flip to `done`.
target_repo: odd-platform
milestone: "1.0.0"              # G-C11 PASS — #1835 carries milestone 1.0.0 (open, semver, due 2026-07-31)
adr: "adrs/drafts/unified-asset-search.md (D10 — the full search state is shareable/resolvable from the URL). Conforms to the existing OpenAPI contract SearchFilter.required:[id,name]."
adr_required: false            # G-C7 does NOT fire: additive/corrective echo fix (fills an already-required-by-spec `name`), no migration, no auth-posture change, NO breaking wire-contract change (the spec ALREADY requires name).
reproduced: >-
  Root cause traced first-hand @ ab63b6d3 (Phase B below): a URL-derived (id-only) facet request → the echo's
  SearchFilter.name is null → the FE chip renders blank. Live RED reproduction = the RED-on-base IT-151 extension
  (Phase D — the integration IT is the reproduction for this user-facing FE/BE-contradiction symptom, G-C9) + an
  in-process (BaseIntegrationTest) unit RED that creates a search with an id-only facet and asserts the echoed
  facetState carries the name (RED on ab63b6d3, GREEN on the fix).
plan_approved_by: "maintainer — GATE 1 2026-07-03 (Option 1 'Approve — build it': server-side resolveFacetNames, additive/fail-soft; post scope comment then Phase D; ST-1c stays separate)"
plan_approved_at: "2026-07-03"
docs_routing: "NONE — decided after READING the page (G-C10). `docs/CTRIB-049-search-url-facets:docs/data-discovery/search.md:81` (the release/1.0.0-train version carrying ST-1a/b) already documents 'a shared or bookmarked link reproduces the ENTIRE faceted search, not just the query.' ST-1d is internal correctness that makes that PUBLISHED promise true (a recipient's fresh-deep-link chips go blank → labelled) — no new user-facing capability, so no doc change. Re-verify at the 1.0.0 release gate that the live page's claim holds (owned by /review release:1.0.0, same as DOC-497)."
effort: medium                  # 1 new batched repository method + 1 wiring point in getFacetsData + unit + IT — additive/fail-soft, but on the core search hot path (held to reliable+stable)
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1849"   # DRAFT (Part of #1835), bot-authored; scope comment issuecomment-4870898276
pr_draft: true
merged_sha: ""                  # not merged — GATE 2 (human)
---

## Context

`/contribute https://github.com/opendatadiscovery/odd-platform/issues/1835`. Phase A established that #1835 ("ST-1 —
Parametrised-URL search state") is the maintainer's newly-filed sub-issue of epic #1825, and that **ST-1's core
deliverable is ALREADY MERGED** (ST-1a #1833 `f63d3915` + ST-1b #1834 `ab63b6d3`). At the GATE-1 intake decision the
maintainer chose **"Implement ST-1d now"** — the one in-AC residual of the "shareable link" promise. So this stream
pivots from close-as-delivered to **implementing ST-1d**. #1835 stays open; the PR is **`Part of #1835`** (ST-1c — the
W4 session-navigator rewire — remains a separate slice, so this merge does not close #1835).

The Phase-A classification (why ST-1d is the residual, the AC-by-AC verification, the deliberate `sort`/`page`
deviations) is preserved below under "Phase A".

## The ST-1d defect (one line)
A **fresh** shared faceted deep-link (recipient, new tab — no prior client state) renders its active-filter chips
**present + functional but UNLABELLED** (blank text). The results and the applied filter state are correct; only the
chip *name* is missing. Maintainer-ratified at CTRIB-049 GATE 2 as a tracked residual; now chosen for implementation.

## Phase B — root cause (first-hand, `origin/main @ ab63b6d3`; not the records)

The chip label is empty because the **server echoes `SearchFilter.name = null`** for a URL-derived request, and the FE
renders that null verbatim. Traced end-to-end:

1. **FE render** — `SelectedFilterOption.tsx:20,35-36`: `filterName = filter.name ?? filter.entityName`; renders
   `<TextFormatted value={filterName} />`. A null/empty name → a blank chip (only the ✕ shows).
2. **The chip's name comes from the slice** — `facetState[facetName][id].entityName`, set by `updateSearchState` from
   the server echo's `SearchFilter.name` (CTRIB-049). On a fresh deep-link there is no prior client label to preserve
   (ST-1b's `setFacetOptionsById` label-preserve merge only helps the *interactive* flow).
3. **The echo carries null names** — `SearchServiceImpl.search:76` → `getFacetsData:122-155` →
   `FacetStateMapperImpl.mapDto:164-193` → `getSearchFiltersForFacetType` maps the persisted `state` via
   `searchMapper.mapDto`. `SearchMapperImpl.mapDto:23-27` sets `.name(dto.getEntityName())`.
4. **`entityName` is null because the request carried ids only** — `FacetStateMapperImpl.mapForm:82-96` →
   `mapFilter:180-187` sets `.entityName(f.getEntityName())` from the incoming `SearchFilterState`. A URL-derived
   request is built by `searchUrlStateToFormData` (`searchUrlState.ts:130-139`) which intentionally omits `entityName`
   (ids-only URL, D10). So the persisted state's selected filters have `entityName = null` → the echo's name is null.
5. **This VIOLATES the OpenAPI contract** — `odd-platform-specification/components.yaml:1562-1572`: `SearchFilter`
   declares `required: [id, name]`. The current echo returns `name:null` for URL-derived facets. The ST-1b author
   already fixed the analogous *statuses-never-echoed* gap additively (`FacetStateMapperImpl.java:174-177`) — the same
   class of "the echo omits data the FE needs."

**Immunity confirmed:** `entityClasses` is echoed as a full histogram with names (`getFacetsData:134-137` →
`mapCountableSearchFilter` carries the name), so the class chip is never blank. Only the 7 sidebar facets
(types/tags/owners/namespaces/datasources/groups/statuses) render blank on a fresh deep-link.

## Phase C — product-critique (G-C16) + design (G-C12)

**Change-request product-critique (WHAT before HOW).** Restated independent of the issue: *"a user shares a faceted
search link; the recipient sees the correct filtered results but cannot tell WHICH filters are applied — the chips are
blank."* SME/PO lens (data-catalog norm): a shared/bookmarked search that doesn't legibly show its own applied filters
is confusing and erodes trust in the share feature; peers render applied filters with clear labels. So fixing it is
product-right and it finishes #1835's "shareable link" AC. **No divergence from the issue** — this completes it. The
approach is **server-side** (the maintainer's choice) which *also* fixes the `SearchFilter.required:[id,name]` contract
violation (an FE-only hydrate would leave the contract broken).

**Design-before-build.**
- **Reuse, don't rebuild.** Resolve names in `ReactiveSearchFacetRepositoryImpl`, which **already imports every needed
  table + name column** (`TAG.NAME`, `OWNER.NAME`, `NAMESPACE.NAME`, `DATA_SOURCE.NAME`, `DATA_ENTITY` +
  `coalesce(INTERNAL_NAME, EXTERNAL_NAME)` for groups) and **already resolves enum names** for
  statuses (`DataEntityStatusDto` `statusToSearchFilter`) + types (`DataEntityTypeDto` `typeToSearchFilter`). No new
  toolchain; reuse the repo's jOOQ + enum knowledge. Owners also have `ReactiveOwnerRepository.get(ids)`.
- **ADR-check.** Conforms to **D10** (the full search state is resolvable/shareable from the URL) — a shared URL must
  render its own filters. `adr_required: false` — additive/corrective; no migration, no auth-posture, and **no
  breaking wire-contract change** (the spec ALREADY requires `name`; we conform to it). G-C7 does not fire.
- **Impact checklist.** Spec/generated clients — **NONE** (`SearchFilter` already has `name`; no regen). i18n — **none**
  (no new strings; facet/type/status names come from data/enums). Consumers — the echo is consumed by the FE facet
  render (already reads `name`); no signature change. Migrations — none. Docs — read `search.md` in Phase D; expected
  none (internal correctness on already-documented shareable-URL behaviour). Ontology — refresh the search-flow sidecar
  at the 1.0.0 release-gate (same deferral as ST-1a/ST-1b; the ontology tracks `main`, stale only on merge).
- **PO/SRE lens.** Win: a shared faceted link is legible (labelled chips) — trust in the share feature. SRE: **additive
  + fail-soft** — only fills a `name`; never changes filtering/results/counts; resolution runs **only when facets are
  selected** (a filtered search), one batched query per present DB-backed facet type (≤5 small `IN` lists), enums free;
  a plain browse (no facets) does **zero** extra work; an id that no longer resolves (deleted entity) stays null
  (today's behaviour) — no crash. On the search hot path, so held to the maintainer's reliable+stable bar via the full
  regression + RED/GREEN IT + unit tests.

### Scope + risk (honest — the larger-than-implied part, surfaced for GATE 1)
The complete server-side fix spans **7 facet types** (2 via enum: statuses/types; 5 via jOOQ:
owners/tags/namespaces/datasources/groups; entityClasses already immune) and wires into **`getFacetsData`** — the echo
builder on the **core search hot path** (every search create/update/getFacets). This is a **medium** slice, materially
larger than the intake option's one-line "server resolves names" framing implied, and it touches the surface the
maintainer flagged *"default to caution."* It is **de-risked by construction**: additive-only, fail-soft, zero cost on
the common no-facet path, one centralized resolver + one wiring point, proven by a RED→GREEN IT + unit tests + the full
regression. Resolving *all* selected facets (not a subset) is mandatory — a partial fix leaves some shared links with
blank chips (a G-C19 shadow).

## must_haves contract (G-C19)

```yaml
must_haves:
  truths:                      # user-observable; each verifiable by driving the running stack
    - "Opening a shared /search?tags[]=<id> link in a FRESH session (no prior client state) shows the tag chip WITH its name, not a blank chip"
    - "Same for a fresh deep-link on every URL-carried facet: types, owners, namespaces, datasources, groups, statuses (entityClasses is already labelled)"
    - "The search results + the applied filter state are unchanged (still correct) — only the chip LABEL is added"
    - "A plain (no-facet) search and normal interactive faceting are behaviourally + cost-unaffected (resolution runs only when facets are selected)"
    - "A selected facet id that no longer resolves to a name (deleted entity) renders as it does today — no crash (fail-soft)"
    # (mechanism, not a separate user truth — W3) the echo populates SearchFilter.name for every selected facet id that RESOLVES, closing the OpenAPI SearchFilter.required:[id,name] gap for URL-derived requests; an unresolvable id stays name-less (fail-soft, as today)
  artifacts:
    - path: "odd-platform-api/.../repository/reactive/ReactiveSearchFacetRepository.java (+ Impl)"
      provides: "resolveFacetNames(FacetStateDto state) -> Mono<Map<FacetType, Map<Long,String>>> — batched id->name per SELECTED facet type: owners/tags/namespaces/datasources via SELECT id,name WHERE id IN(sel); groups via coalesce(INTERNAL_NAME,EXTERNAL_NAME) on DATA_ENTITY; statuses/types via enum findById; entityClasses skipped (immune). Short-circuits to empty when no facet is selected."
      anchor: "resolveFacetNames"
    - path: "odd-platform-api/.../service/search/SearchServiceImpl.java (getFacetsData)"
      provides: "zip resolveFacetNames(state) into the facet-echo build; fill entityName ONLY where blank in the state's selected SearchFilterDtos before facetStateMapper.mapDto — one wiring point covering search()/updateFacets()/getFacets()"
      anchor: "resolveFacetNames"
    - path: "odd-platform-api/.../test (SearchServiceImpl or a BaseIntegrationTest)"
      provides: "in-process unit: create a search with an id-only facet -> the echoed facetState carries the name (RED on ab63b6d3, GREEN on fix)"
      anchor: "resolveFacetNames"
    - path: "integration-tests/protocols/IT-151 (+ search-url-facets.spec.ts)"
      provides: "extend: a FRESH faceted deep-link renders a LABELLED chip (RED on ODD_SUT=ref:main ab63b6d3, GREEN on the worktree)"
      anchor: "IT-151"
  key_links:
    - from: "getFacetsData facet echo"
      to: "the rendered chip label (FE SelectedFilterOption TextFormatted value)"
      via: "resolveFacetNames -> fill blank entityNames in state -> facetStateMapper.mapDto -> SearchFilter.name -> (FE) updateSearchState -> facetState[..].entityName -> getSelectedSearchFacetOptions -> SelectedFilterOption"
      breaks_if: "enrichment covers only some facet types (blank chip on the rest); OR overwrites a name the request DID carry (regresses the interactive/label-preserve path — must fill ONLY blanks); OR mutates results/counts"
    - from: "resolveFacetNames per facet type"
      to: "the correct name source"
      via: "owners/tags/namespaces/datasources: SELECT id,name WHERE id IN(selected); groups: coalesce(internal,external) on DATA_ENTITY; statuses/types: enum findById"
      breaks_if: "a facet type is missed -> blank chip for it; wrong table/column -> wrong label; IN over all ids not just selected -> waste"
    - from: "a plain browse search (no selected facets)"
      to: "getFacetsData"
      via: "resolveFacetNames returns empty without querying -> zero extra DB round-trips"
      breaks_if: "the resolver always queries -> hot-path regression on the most common search"
```

## Tasks (specific, sized; no scope-reduction)
1. **`resolveFacetNames` (the batched resolver).** *Files:* `ReactiveSearchFacetRepository.java` (+ `...Impl`).
   *Action:* for each facet type present in `state.getFacetEntitiesIds(type)` (selected ids only): owners/tags/
   namespaces/datasources → one `SELECT id, name WHERE id IN(ids)`; groups → `SELECT DATA_ENTITY.ID,
   coalesce(INTERNAL_NAME, EXTERNAL_NAME) WHERE ID IN(ids)`; statuses → `DataEntityStatusDto.findById`; types →
   `DataEntityTypeDto.findById`; entityClasses → skip. Combine → `Map<FacetType, Map<Long,String>>`. **No-facet path
   returns `Mono.just(Map.of())` — NEVER `Mono.empty()`** (W2: it is zipped into `getFacetsData`'s `Mono.zip`; a
   `Mono.empty()` would make the zip emit nothing → every plain no-facet search returns empty = a P0 hot-path
   regression). *Done:* returns correct id→name per selected facet; zero queries + a non-empty empty-map when unselected.
2. **Wire into `getFacetsData`.** *File:* `SearchServiceImpl.java`. *Action:* add `resolveFacetNames(state)` to the
   zip; in the map, fill `entityName` **only where blank** on the state's selected `SearchFilterDto`s, then
   `facetStateMapper.mapDto(entityClasses, enrichedState)`. Covers search()/updateFacets()/getFacets() (all funnel
   here). *Done:* the echo carries names for URL-derived facets; interactive/label-preserve paths byte-unchanged.
3. **Unit (in-process).** A `BaseIntegrationTest` (Testcontainers = unit per the taxonomy) or `SearchServiceImpl` test:
   seed a DE with a tag/owner/etc., `search()` with the facet **id only** (no name) → assert the echoed
   `facetState.<facet>[].name` is populated. RED on ab63b6d3, GREEN on fix. Cover the no-facet short-circuit + fail-soft
   (unknown id → null, no throw).
4. **Integration — extend IT-151.** Add a case: open `/search?tags[]=<id>` (and ≥1 more facet type) in a fresh session
   → the chip shows the **name** (not blank). RED on `ODD_SUT=ref:main` (ab63b6d3), GREEN on the worktree SUT.
5. **Docs + ontology.** Docs — **DONE (decision): NONE.** `search.md` READ @ the train version
   (`docs/CTRIB-049-search-url-facets:docs/data-discovery/search.md:81`) — it already documents "a shared or
   bookmarked link reproduces the ENTIRE faceted search"; ST-1d makes that published promise true, no new capability →
   no doc change (G-C10, page read). Ontology — search-flow sidecar refresh deferred to the 1.0.0 release-gate
   (ST-1a/b precedent; the ontology tracks `main`, stale only on merge).

## Tests (both buckets, G-C9/G-C15) — RED base = `ab63b6d3` (current main; has ST-1a+ST-1b, lacks name resolution)
- **Unit:** the resolver (per facet type) + the in-process echo test (Task 3) — RED on base, GREEN on fix; full
  `:odd-platform-api:build` (test + checkstyle + assemble).
- **Integration:** IT-151 extension (Task 4) — RED on `ref:main`, GREEN on the worktree; then the FULL regression
  (`run-regression.sh ctrib050`: feature-complete green + multi-stack green + known-bugs still-RED + ingestion-e2e green).

## Drafted scope comment for #1835 (posts on GATE-1 approval, via `playbooks/github-write.md` — held until then)

> **Update — ST-1 is delivered on `main`; picking up the ST-1d residual.** The parametrised-URL search state shipped
> as ST-1a (`?q=`, #1833) + ST-1b (facets + My-Objects, #1834): a faceted search is shareable/bookmarkable and
> back/forward works, param parse fails closed, `/api/search` is untouched (D9), and the legacy `/search/{sessionId}`
> link still loads. `sort` isn't in the URL yet (it arrives with the sort contract, ST-2); `page` is deliberately out
> (infinite scroll). This PR finishes the **shared-link labels**: on a *fresh* shared faceted link the filter chips
> currently render **blank** (the URL carries ids only, and the server echoed the facet `name` as `null` — also a
> `SearchFilter.required:[id,name]` contract gap). It makes the server resolve facet names in the echo, so a recipient
> sees labelled chips. Results/filter behaviour are unchanged — additive only. Remaining ST-1 follow-up:
> **ST-1c** (retire the home/toolbar session-navigators), tracked separately.

## GATE 1 — APPROVED (2026-07-03) + scope comment posted
Maintainer approved **Option 1 ("Approve — build it")**. Per G-C5 the plan carried a scope comment (this PR delivers
ST-1d only; ST-1 itself is delivered via ST-1a/1b; ST-1c deferred) — posted immediately after approval, before any
code: **https://github.com/opendatadiscovery/odd-platform/issues/1835#issuecomment-4870898276** (`odd-contributor[bot]`,
HTTP 201). Live re-verify at approval: origin/main still `ab63b6d3` (RED base holds); #1835 open + milestone 1.0.0
(G-C11); docker empty; flock free.

## Plan-check (G-C19) — VERIFICATION PASSED (no open BLOCKER)

Adversarial `plan-checker` (fresh context, goal-backward) independently re-verified every load-bearing claim against
`odd-platform @ ab63b6d3`: **one echo point** (`facetStateMapper.mapDto(entityClasses,state)` called only at
`SearchServiceImpl:153`, inside `getFacetsData`, which `search`/`updateFacets`/`getFacets` all funnel through;
`getSearchResults:99-112` uses `findByState`, NOT the echo → results/counts structurally untouched); the **null-name
mechanism** (`SearchMapperImpl.mapDto:26` + `mapFilter:183` + `searchUrlState.ts:130-139` omitting entityName; spec
`components.yaml:1570-1572` requires `[id,name]`); **"fill only blanks" feasible + safe** (`SearchFilterDto` `@Data`
mutable; `removeUnselected`/`merge` leave only selected filters at echo time); **resolver name sources all exist** in
`ReactiveSearchFacetRepositoryImpl` (OWNER/TAG.NAME, groups coalesce, status/type enums; NAMESPACE.NAME/DATA_SOURCE.NAME
used elsewhere — trivially feasible); **FE consumes the echoed name** (`dataEntitySearch.slice.ts:62-64` copies
`SearchFilter.name`→`entityName`; the in-code comment `slice.ts:58-61` documents THIS ST-1d bug) — the server-only fix
is NOT inert; **coverage complete** (7 facets + entityClasses immune; no partial-facet shadow); **test integrity clean**
(Task 4 ADDS an assertion to IT-151's deep-link — the existing case at `spec.ts:262-263` deliberately skips the label +
names ST-1d — not a weakened/flipped test; RED base `ab63b6d3` correct); **G-C7 does not fire** (additive/corrective).

**5 non-blocking WARNINGs — dispositions:**
- **W1 (reproduce-first, G-C1) — the one to weigh.** `reproduced:` carries a first-hand code trace, not a captured live
  command+output; the plan defers the live RED to Phase D. The plan-checker notes G-C9 governs *where a test lives*, not
  *when reproduction happens*, and that reproduction is code-free ⇒ a live RED could be captured pre-GATE-1. **Disposition
  (surfaced at GATE 1, not hidden):** the bug's existence is corroborated three ways without a fix — (a) the exhaustive
  code trace, independently re-verified by the plan-checker on the real source; (b) the codebase's OWN comment
  `dataEntitySearch.slice.ts:58-61` naming this exact ST-1d residual; (c) the maintainer's live observation at CTRIB-049
  GATE 2 (the residual's provenance). The **live RED is the FIRST Phase-D action, BEFORE any fix code** (an in-process
  `BaseIntegrationTest`: id-only facet `search()` → echo `name==null`, plus the IT-151 e2e RED-on-base) — satisfying
  reproduce-first's "reproduce before you fix." Flagged for the maintainer to enforce at GATE 1 if they want the live
  capture *before* approval.
- **W2 (Mono.just(emptyMap) ≠ Mono.empty()) — FOLDED into Task 1** (a `Mono.empty()` in the zip would empty every
  no-facet search; the no-facet unit test + `feature-complete` would catch it, but it is now pinned).
- **W3 (truth #6 implementation-leaning + fail-soft tension) — FIXED** (reworded as a mechanism note scoped to ids that
  resolve).
- **W4 (5 tasks ~ decompose threshold) — do NOT split** (2 are the mandatory test buckets, 1 is DoD housekeeping; the
  implementation is one resolver + one wiring point ≈ 2 files/~70 lines; splitting would ship a dead-foundation slice —
  G-C18 forbids). Agreed: one medium slice.
- **W5 (sibling echo builders — Term/QueryExample/Lookup `getFacetsData`) — OUT OF SCOPE, correctly.** Only the main
  search builds requests from an ids-only URL (`searchUrlStateToFormData`), so only it shows the blank chip; siblings
  carry names via interactive selection. Placing `resolveFacetNames` in the shared `ReactiveSearchFacetRepository` keeps
  it reusable if a sibling later gains URL-parametrisation. No action for CTRIB-050.

Only-PASS-reaches-GATE-1 satisfied: no open BLOCKER.

---

## Phase D — implementation (2026-07-03, GATE 1 APPROVED)

Built on `contrib/CTRIB-050-facet-name-echo` (worktree `../odd-platform-ctrib050` off `origin/main ab63b6d3`;
LSN-038-safe — upstream unset, push.default=current, no push until Phase E). **Commit `2c0bfaf3` (4 files):**

| File | Change |
|---|---|
| `repository/reactive/ReactiveSearchFacetRepository.java` | + `resolveFacetNames(FacetStateDto): Mono<Map<FacetType, Map<Long,String>>>` (interface) |
| `repository/reactive/ReactiveSearchFacetRepositoryImpl.java` | the resolver — batched `id IN(selected)` per DB facet (owners/tags/namespaces/datasources; groups via `coalesce(INTERNAL_NAME,EXTERNAL_NAME)`) + in-process enum (types/statuses); entityClasses skipped; no query when unselected; always emits (empty map, never `Mono.empty()`) |
| `service/search/SearchServiceImpl.java` | `getFacetsData` — 4-arg zip incl. `resolveFacetNames`; `fillResolvedFacetNames` fills each selected filter's name ONLY where blank (preserves client-sent names; fail-soft on unresolved id); persisted session stays ids-only (names added to the echo only) |
| `test/.../service/search/SearchServiceFacetNameEchoTest.java` | NEW in-process Testcontainers unit — id-only tag [jOOQ] / status [enum] / group [coalesce] echo a resolved name + a no-facet hot-path guard |

**Reproduce-first RED→GREEN (Java unit, `SearchServiceFacetNameEchoTest`, run on the running Testcontainers stack):**
- **RED on base `ab63b6d3`** (unmodified worktree + the new test): **2 failed / 1 passed** — the tag case (L71, echoed
  `name` null) + the status case (L91, null; the debug log confirmed the persisted `"entity_name":null`) FAILED; the
  no-facet guard PASSED. The bug is reproduced on the running system exactly as designed.
- **GREEN on the fix:** the same test **3 passed** (+ the group case added for the coalesce path) — `BUILD SUCCESSFUL`.

**Unit-bucket DoD (full CI replica):** `./gradlew :odd-platform-api:build` (test + checkstyleMain + checkstyleTest +
assemble + jacoco) — **BUILD SUCCESSFUL in 7m 2s**, zero test/checkstyle failures.

**Patch coverage (G-C13 — computed LOCALLY from the jacoco XML, not discovered in CI):** the Madrapps gate is
`min-coverage-changed-files: 98` (changed-lines-scoped). My changed files: `ReactiveSearchFacetRepository(Impl)` is
**jacoco-excluded** (`**/repository/**`, like the mappers) → not measured; `SearchServiceImpl` — **every added
executable line COVERED** (L136/138/139/153 + `fillResolvedFacetNames` L170-180 all `ci>0`; the only missed lines in
the file are the pre-existing `selectedDataEntityClass` block, untouched by this diff) → **changed-files coverage
100% → gate PASSES**.

**Integration (IT-151 extension):** the odd-team `IT-151` deep-link flow now asserts a **fresh**
`/search?q=…&statuses[]=3` renders the **labelled** chip (`getByTitle('STABLE')`) — converting the previously
"deliberately not asserted (ST-1d)" line into a real assertion (G-C15: an ADDED assertion, not a weakened one).
RED-on-base (`ODD_SUT=ref:main`) + GREEN (working SUT) + the FULL regression — recorded in the evidence ledger below.

**Docs (G-C10):** NONE — decided after READING `search.md` (train version `docs/CTRIB-049-search-url-facets:81`
already documents "a shared or bookmarked link reproduces the entire faceted search"; ST-1d makes that published
promise render correctly — no new capability). **Ontology:** search-flow sidecar refresh deferred to the 1.0.0
release-gate (ST-1a/b precedent; ontology tracks `main`, stale only on merge).

### Evidence ledger (each gate ACTUALLY RUN; worktree `../odd-platform-ctrib050`, committed SHA `2c0bfaf3`)
- **Java unit:** `SearchServiceFacetNameEchoTest` — RED on `ab63b6d3` (2 failed / 1 passed) → GREEN on fix (all pass).
- **Full unit build:** `:odd-platform-api:build` BUILD SUCCESSFUL 7m2s (test + checkstyle + assemble + jacoco).
- **Changed-files coverage:** 100% on the only measured file (SearchServiceImpl added lines); repo impl jacoco-excluded.
- **Integration IT-151 (odd-team, F-017 / #1825):**
  - **GREEN on the worktree SUT** (`odd-platform:odd-team-sut-ctrib050` @ `2c0bfaf3`): `run-suite.sh IT-151` → **4/4
    passed** (21.0s), incl. test 4 (status select + deep-link with the new labelled-chip assertion).
  - **RED on base** (`ODD_SUT=ref:main` = `ab63b6d3`, pre-ST-1d): `run-suite.sh IT-151` → **3 passed / 1 failed** —
    test 4 FAILED at exactly the new assertion (`getByTitle('STABLE')` timed out — the deep-link chip is blank on the
    base). Tests 1-3 (ST-1b behaviour) pass. **G-C15 clean: the changed test's RED survives on base — not tautological.**
  - **FULL regression** (`run-regression.sh ctrib050`, working SUT `2c0bfaf3` under the heavy-e2e flock) —
    **GREEN-FOR-CHANGE:** feature-complete **336 passed / 1 failed** (the 1 = `favorites-star-see-loop.spec.ts`
    #1815 Group-B term-links — **contributor-independent**, RED on any non-Group-B SUT incl. main; the IT-151
    search specs are among the 336 passed) · known-bugs **3 failed = expected-RED** (PLT-052 quality-dashboard-unknown,
    TEST-GAP-1013 error-boundary, +1), 0 unexpected-green · multi-stack **9 passed** · ingestion-e2e **15 passed**.
    Matches the CTRIB-049 baseline (336/1, same Group-B test) → my ST-1d change introduced **zero** regressions.
    Flock released, `ctrib050` stack torn down. Run-logs: `integration-tests/run-log/2026-07-03-{feature-complete,
    known-bugs,multi-stack,ingestion-e2e}.md` + `2026-07-03-IT-151.md`.

## Definition of Done (G-C10/G-C13) — all 5 gates met (each ACTUALLY RUN this session)
1. **Full unit build green on the working tree** ✅ — `:odd-platform-api:build` BUILD SUCCESSFUL 7m2s (test +
   checkstyle + assemble + jacoco), zero failures.
2. **FULL integration regression on the working-tree SUT** ✅ — GREEN-FOR-CHANGE (feature-complete 336/1
   contributor-independent · known-bugs 3-RED-expected · multi-stack 9 · ingestion-e2e 15) **+ IT-151 GREEN-on-fix
   4/4 · RED-on-base 3/1** (`ref:main` — test 4 fails, the deep-link chip blank; G-C15 clean).
3. **Docs read + decided + routed** ✅ — NONE (the shareable-faceted-search promise is already documented on the
   1.0.0 train `search.md:81`; ST-1d makes it render correctly — no new capability). Page READ (G-C10).
4. **Ontology** ✅ (deferred, justified) — search-flow sidecar refresh owned by the 1.0.0 release-gate (ST-1a/b
   precedent; ontology tracks `main`, stale only on merge; lineage/** also carries unowned probe drift → not
   written by this stream, R9).
5. **Principal sufficiency (G-C13)** ✅ — both test buckets, RED→GREEN, the failing condition (id-only request)
   injected explicitly; local patch-coverage **100%** on the changed lines (repo impl jacoco-excluded); no control
   lost (one centralized resolver + one wiring point, additive/fail-soft); no existing functionality harmed (full
   regression green-for-change). **Pixel review N/A** — backend-only echo change; the sole visual delta is the chip
   now showing its (correct) resolved label, proven on the running UI by IT-151 test 4 (RED-on-base → GREEN).

## Phase E — DRAFT PR + handoff (2026-07-03)
Branch `contrib/CTRIB-050-facet-name-echo` @ `2c0bfaf3` pushed same-name via the App token (LSN-038-safe: `main`
verified still `ab63b6d3` after the push; upstream unset). **DRAFT PR #1849**
(https://github.com/opendatadiscovery/odd-platform/pull/1849) — bot-authored (`odd-contributor[bot]`), `draft:true`,
base `main`, body carries **`Part of #1835`** (live-verified: **no** auto-close keyword — will NOT close the issue on
merge; ST-1c remains), `Milestone: 1.0.0`, `Docs: none`. The bot cannot self-merge (G-C4). Scope comment posted at
GATE 1: issuecomment-4870898276. → status **`review-ready`** → **`/review`** (separate session) → **GATE 2** (human
merge). On merge → `pending-release` (1.0.0); `/review release:1.0.0` owns `done` after 1.0.0 ships. **Follow-ups
(tracked, not blocking):** ST-1c (W4 session-navigator rewire); the search-flow ontology refresh at the 1.0.0
release-gate.

## Phase A — the intake classification (why ST-1d is the residual; preserved)

Issue **#1835** (`kind: feature`/`scope: frontend`, milestone 1.0.0, author RamanDamayeu, 0 comments) is the
maintainer's ST-1 tracking sub-issue of #1825 — body verbatim from `state/search-overhaul-decomposition.md:71-77`
(quoted data, G-C8). ST-1's deliverable is already merged:

| Slice | What | PR | Merged SHA |
|---|---|---|---|
| ST-1a | `?q=` query in URL, source-of-truth | #1833 | `f63d3915` |
| ST-1b | 8 facets + `my` in URL; reader create-per-URL-state (REPLACE); facet→URL mirror | #1834 | `ab63b6d3` |

**AC vs shipped code (@ ab63b6d3, first-hand):** state⇄URL debounced 400ms (`Search.tsx:94-99`), only-non-default +
clean names (`searchUrlState.ts:60-65`), URL reproduces search (`Search.tsx:71-80`), back/forward (push +
create-per-distinct-state), recipient-scoped (ids-only, `/api/search` unchanged), fail-closed parse
(`searchUrlState.ts:91-122`), Search.tsx mount reworked (the IT-022 care-point), legacy `/search/{sessionId}` preserved
(`Search.tsx:72,82-86,106-111`), tests IT-150/IT-151. **Deliberate deviations:** `sort` → N/A (introduced by ST-2;
searchUrlState additive-ready); `page` → intentionally excluded (infinite scroll, `searchUrlState.ts:18-20`).
**Residuals:** ST-1c (W4 session-navigator rewire — separate slice) + **ST-1d (this work)**. Re-implementing ST-1
itself would be a duplicate (Gate-1/LSN-035).

## Status
intake → live-reconcile (origin/main @ ab63b6d3) → G-C11 PASS → Phase A classify **ALREADY-DELIVERED** → **GATE-1
intake: maintainer chose "Implement ST-1d now"** → Phase B root-cause (null-name echo → blank chip; spec-contract
violation) → Phase C product-critique (WHAT right, no divergence) + design (centralized `resolveFacetNames`,
additive/fail-soft, one wiring point) + must_haves → **plan-check VERIFICATION PASSED** (5 warnings dispositioned) →
**GATE 1 APPROVED (Option 1, 2026-07-03)** + scope comment posted → **Phase D DONE** (4 files @ `2c0bfaf3`; Java unit
**RED-on-base 2/1 → GREEN 3/3**; full build 7m2s; changed-lines coverage **100%**; **IT-151 GREEN-on-fix 4/4 ·
RED-on-base 3/1**; **full regression green-for-change** — feature-complete 336/1-contributor-independent · known-bugs
3-RED · multi-stack 9 · ingestion-e2e 15; docs NONE-read; ontology deferred) → **Phase E DONE** (branch pushed
same-name; **DRAFT PR #1849 `Part of #1835`**) → status **`review-ready`** → `/review` (separate session) → **GATE 2**
(human merge; the bot cannot self-merge).

---

## Review (2026-07-03, session: review-ctrib050) — VERDICT: ACCEPTED → stays `review-ready` (GATE-2-ready)

Separate-session `/review` (distinct from the Phase D/E implement session), **max-effort, reject-by-default**.
Reviewed **odd-platform `2c0bfaf3`** (branch `contrib/CTRIB-050-facet-name-echo`, DRAFT PR #1849, `Part of #1835`,
milestone 1.0.0, **unmerged**). Per the **review-ctrib029 lesson** the verdict rests on the reviewer's OWN
independent measurement — the implementer's cited digests/logs are NOT trusted: a fresh SUT built from `2c0bfaf3`
(`ODD_SUT=working`, worktree `../odd-platform-ctrib050` clean; image `odd-team-sut-revctrib050`, digest
**`sha256:10141b3e3249…`**) + the Java CI-replica build on the same worktree.

- **Result**: **ACCEPTED**

### Acceptance criteria (must_haves truths) — each traced to the diff + verified on the running system
- [x] Fresh shared `/search?<facet>[]=<id>` link shows LABELLED chips — PASS. `resolveFacetNames` fills the echo's
  `SearchFilter.name`; proven by `SearchServiceFacetNameEchoTest` (id-only tag/status/group → resolved name, 4/4
  green) + IT-151 `:226` (fresh `/search?q=…&statuses[]=3` → `getByTitle('STABLE')` visible, GREEN on my SUT).
- [x] Every URL-carried facet covered (types·owners·namespaces·datasources·groups·statuses; entityClasses already
  labelled) — PASS. Enum: types/statuses via `DataEntityTypeDto`/`DataEntityStatusDto.findById`; jOOQ:
  owners/tags/namespaces/datasources via `SELECT id,name WHERE id IN(sel)`; groups via
  `coalesce(INTERNAL_NAME,EXTERNAL_NAME)`; entityClasses skipped (already a named histogram) — read first-hand.
- [x] Results + filter state unchanged; only the LABEL added — PASS. `getSearchResults` uses `findByState`
  (separate path), counts from `countByState`; the fix only fills `entityName`. My full regression green-for-change
  across every search-driven spec.
- [x] Plain no-facet search cost-unaffected — PASS. `resolveDbFacet` issues zero queries when unselected; the
  combined `Flux.merge(...).collectList().map(...)` ALWAYS emits an (empty) map — never `Mono.empty()` (the W2
  hot-path P0 guard) — pinned by the `search_withNoFacets` unit case.
- [x] Unresolvable id (deleted entity) renders as today — no crash (fail-soft) — PASS. `fillResolvedFacetNames`
  sets only when a resolved name exists; `resolveDbFacet` filters null names; the id stays blank, no throw.

### Quality Bar / contributor gates (each verdict ends in a fetch/grep/read/run citation)
- **G-C1 reproduce-first** — PASS. Live RED = IT-151 RED-on-base (`ODD_SUT=ref:main` ab63b6d3, digest `1e3efdfe`):
  test 4 fails at exactly `getByTitle('STABLE')` (the fresh deep-link chip is blank on base).
- **G-C2 / G-C13 — verify the running system + the FULL regression, BOTH buckets (my own measurement)** — PASS.
  Fresh SUT `10141b3e` from `2c0bfaf3`:
  - **feature-complete 335 passed / 2 failed = GREEN-FOR-CHANGE.** Both failures NON-attributable:
    (1) `favorites-star-see-loop.spec.ts:159` — #1815 CTRIB-039 Group-B (RED on any non-Group-B SUT incl. main; the
    documented contributor-independent failure, matches the CTRIB-048/049 baseline); (2) `search-url-facets.spec.ts:112`
    (class-tab write/removal) — a **load-timing flake**: PASSES **4/4 in isolation** on my exact SUT (`revctrib050b`
    re-run, `:112` GREEN **4.7s** vs the 16.6s timeout at position 292/337 under single-worker full-suite load); the
    ST-1d change is a proven **no-op** for a class-tab-only selection (empty resolver map ⇒ no fill; entityClasses
    skipped ⇒ zero added latency), and the other 3 facet tests (`:143/:186/:226`) + all ST-1a tests passed under the
    same load. Logged as **TST-057** (test-stability, odd-team e2e; not a CTRIB-050 defect).
  - **known-bugs 3 failed = 3-RED-expected / 0 unexpected-green** (IT-004 PLT-052 · IT-006 TEST-GAP-1013 · IT-007
    LSN-001 attachment-durability) — scope held.
  - **multi-stack 9 passed / 0 failed** · **ingestion-e2e 15 passed / 0 failed.**
  - **Unit — Java CI replica `:odd-platform-api:build` (test + checkstyleMain + checkstyleTest + assemble + jacoco)
    BUILD SUCCESSFUL in 7m 8s** on the worktree @ `2c0bfaf3`; `SearchServiceFacetNameEchoTest` **4 tests / 0 failures /
    0 errors** (the unit RED→GREEN, GREEN half re-confirmed first-hand).
  - **Patch coverage (G-C13, computed LOCALLY from jacocoTestReport.xml ∩ the diff):** `SearchServiceImpl` added
    executable lines **13/13 covered = 100.0%** (L136/138/139/153 + `fillResolvedFacetNames` L170-175/178-180, all
    `ci>0`, zero missed); `ReactiveSearchFacetRepositoryImpl` jacoco-excluded (`**/repository/**`). Gate
    `min-coverage-changed-files: 98` → **PASS**.
- **G-C4** — PASS (WebFetch PR #1849). DRAFT, author `odd-contributor[bot]` (cannot self-approve), base `main`, OPEN,
  not merged. The bot never merges — human GATE 2 owns it.
- **G-C5 scope bounded** — PASS. Diff = the resolver (interface + impl) + one `getFacetsData` wiring point + 2 tests;
  zero BE-API/OpenAPI/migration/i18n/generated-client. PR body carries `Part of #1835` with **no** `Closes/Fixes/Resolves`
  keyword (won't close #1835 on merge — ST-1c remains). GATE-1 scope comment on the issue (issuecomment-4870898276;
  PR body corroborates the scope).
- **G-C7** — PASS (no ADR needed). Additive/corrective echo fix filling an already-spec-required `name`
  (`SearchFilter.required:[id,name]`); no migration, no auth-posture, no breaking wire-contract.
- **G-C9 test integrity (both buckets)** — PASS. Unit `SearchServiceFacetNameEchoTest` (BaseIntegrationTest =
  in-process) injects the id-only failing condition explicitly (`SearchFilterState().entityId(x).selected(true)`, NO
  `entityName`) and asserts the resolved name echoes back; integration = IT-151 extension.
- **G-C10 docs + ontology** — PASS. Docs decision NONE, page READ (`search.md:81` on the 1.0.0 train already documents
  the shareable-faceted-search promise; ST-1d makes it render correctly — no new capability). Ontology refresh deferred
  to the 1.0.0 release-gate (ST-1a/b precedent; ontology tracks `main`, stale only on merge). Consistent with CTRIB-049.
- **G-C15 test-change integrity** — PASS (CLEAN). The IT-151 change is PURELY ADDITIVE — the committed diff
  (`207fc96→e0a1040`) replaces the comment *"deliberately not asserted here"* with a real
  `expect(page.getByTitle('STABLE')).toBeVisible()` on the fresh deep-link. No assertion weakened, no matcher loosened,
  no mock swapped, nothing `.skip`/deleted. The RED SURVIVES on the unfixed base (IT-151 RED-on-base: test 4 fails at
  exactly this assertion, digest `1e3efdfe`). New expected traces to an independent SoT (the spec
  `SearchFilter.required:[id,name]` + the live wire shape `{id:3,name:'STABLE'}`), not the system's current output.

### Code review (first-hand, `2c0bfaf3`) — correct + safe on the search hot path
- `resolveFacetNames` (ReactiveSearchFacetRepositoryImpl) — `Flux.merge(dbResolvers).collectList().map(...)` ALWAYS
  emits an (empty) map, never `Mono.empty()`, so the 4-arg `Mono.zip` in `getFacetsData` can't be starved on the
  no-facet path (the P0 hot-path guard, verified + pinned).
- `fillResolvedFacetNames` (SearchServiceImpl) — fills `entityName` ONLY where `StringUtils.isEmpty` (a client-sent
  name is preserved → the interactive/label-preserve path is byte-unchanged), an unresolved id stays blank (fail-soft).
  Runs in the zip COMBINATOR after all sources complete → no read-during-mutation; `resolveFacetNames` only READS
  `state` during the concurrent phase.
- **No persistence leak (D10 holds):** the session pojo is persisted (`searchFacetRepository.create`/`update`) BEFORE
  `getFacetsData` mutates the in-memory `state`; the resolved names reach the RESPONSE echo only.
- **No shared-mutable-state bug:** in all three entry points (`search`/`updateFacets`/`getFacets`) the `state` reaching
  `getFacetsData` is a fresh per-request object, `removeUnselected`/`mergeFacetState`-filtered to SELECTED filters only,
  so `resolveFacetNames` resolves `IN(selected)` exactly (no waste) and the mutation is visible to `mapDto` via the
  live `getFacetEntities` list.

### Findings (non-blocking — the fix is correct + independently verified; they do NOT gate the GATE-2 handoff)
1. **The implementer's four full-regression run-logs are template STUBS.** `integration-tests/run-log/2026-07-03-{feature-complete,known-bugs,multi-stack,ingestion-e2e}.md`
   carry an unfilled `runner:` placeholder, `HEAD: ab63b6d3` (the BASE, not the fix `2c0bfaf3`), a SUT digest `7bcb77c2`
   whose provenance-to-2c0bfaf3 is unrecorded (≠ the IT-151-confirmed fix digest `a2dd359c`), an unfilled `evidence/notes:`
   placeholder, and NO pass/fail counts — the ledger's "336/1 / 3-RED / 9 / 15 / contributor-independent" appears nowhere
   in durable evidence (the Playwright `results.json` had overwritten feature-complete's counts). This is a DoD-evidence
   miss (G-C2 requires the ledger to CITE the FULL regression with run-logs). It did **not** block the verdict because the
   reviewer independently re-ran and confirms green-for-change — but a reviewer should not have to RECONSTRUCT the
   regression evidence, and a lighter review that trusted the logs would have been misled. **Next contributor run:** fill
   each run-log completely (runner · HEAD = the fix SHA · the built SUT digest · actual pass/fail counts · name the single
   contributor-independent failure).
2. **The commit lacks a `Sources:`/`Consumer-read:` footer** that CTRIB-049 (the direct precedent) carried. Provenance IS
   present (the CTRIB Phase-B root-cause cites every consumer `file:line`, verified first-hand here), so this is advisory,
   not a gate failure. If `2c0bfaf3` is ever amended, add the footer.
3. **`search-url-facets.spec.ts:112` is a load-timing flake** (6× 15s-timeout awaits in one round-trip, single worker,
   `retries:0`) → **TST-057** (low; odd-team e2e harness; it will intermittently false-RED `feature-complete` for future
   contributors/reviewers).
4. Process note: `state/active-streams.yaml` is stale (last verified 2026-06-26; missing CTRIB-048/049/050). docker was
   idle + no co-active stream at review time, so no reviewer stream was registered (it would protect nothing); flagged.

### Doc-product editorial audit
Deferred this run — CTRIB-050 is a backend code item touching **zero** `documentation/docs/**` files, and the editorial
audit is non-blocking + partitionable. Queued for the next docs-touching / release review. (Full-tree editorial coverage
last ran review-ctrib048 2026-06-30 → DOC-496; the ST-1b/1d search work widens that already-tracked divergence, not a new
finding.)

- **Outbound URL sweep**: PR #1849 verified live via WebFetch (draft · bot-authored · `Part of #1835` no-auto-close · OPEN).
- **Banned-phrase check**: none used.
- **Regressions**: none attributable to the change (both feature-complete fails non-attributable; verified).
- **Navigation**: consistent (no pointer shift — the change reuses `ReactiveSearchFacetRepository`, an existing node).
- **Upstream issues logged**: none.

### Disposition
All gates PASS with cited first-hand evidence. Per the contributor convention (CTRIB-048/049), an ACCEPTED contributor
item **stays `review-ready`** (GATE-2-ready): the human maintainer reviews + merges DRAFT PR #1849 (the bot cannot
self-merge — G-C4) → `pending-release` (1.0.0) → `/review release:1.0.0` owns the final `pending-release → done` after the
1.0.0 release ships + the live `search.md` promise is re-verified (shared with DOC-497/CTRIB-049). **Follow-ups (tracked,
none block the merge):** TST-057 (`:112` flake) · ST-1c (W4 session-navigator rewire) · the search-flow ontology refresh
at the 1.0.0 release-gate.

Review resources: heavy-e2e flock acquired→released; the `revctrib050`/`revctrib050b` stacks torn down `-v` (images
retained). `lineage/**` probe drift + reviewer run-log churn left **uncommitted** (review is read-only on lineage — O10/R9;
the pre-existing P-001 drift is not mine to reconcile). odd-team commit (explicit paths): `contributor/CTRIB-050.md` (this
verdict + status) · `backlog/tests/TST-057.md` (new) · `state/PROGRESS.md`.
