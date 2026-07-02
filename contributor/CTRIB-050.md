---
id: CTRIB-050
title: "#1835 ST-1d — server-side facet-name echo (a fresh shared faceted link shows LABELLED chips; honours SearchFilter.required:[id,name])"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1835 (Part of #1825; PR will be Part of #1835 — ST-1c remains, so #1835 does not close on this merge)"
parent_epic: 1825
class: "bug/enhancement — residual of ST-1 (ST-1d); server-side echo fix"
status: gate-1-pending          # Phase B root-cause + Phase C design/must_haves/plan-check complete → GATE 1 (human approves the ST-1d plan before any code, G-C3).
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
plan_approved_by: "PENDING — GATE 1"
plan_approved_at: ""
docs_routing: "NONE — decided after READING the page (G-C10). `docs/CTRIB-049-search-url-facets:docs/data-discovery/search.md:81` (the release/1.0.0-train version carrying ST-1a/b) already documents 'a shared or bookmarked link reproduces the ENTIRE faceted search, not just the query.' ST-1d is internal correctness that makes that PUBLISHED promise true (a recipient's fresh-deep-link chips go blank → labelled) — no new user-facing capability, so no doc change. Re-verify at the 1.0.0 release gate that the live page's claim holds (owned by /review release:1.0.0, same as DOC-497)."
effort: medium                  # 1 new batched repository method + 1 wiring point in getFacetsData + unit + IT — additive/fail-soft, but on the core search hot path (held to reliable+stable)
pr_url: ""                      # opens as a DRAFT PR in Phase E (Part of #1835)
pr_draft: true
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
intake → live-reconcile (origin/main @ ab63b6d3; no co-active stream; flock free; docker empty) → G-C11 PASS → Phase A
classify **ALREADY-DELIVERED** → **GATE-1 intake decision: maintainer chose "Implement ST-1d now"** → Phase B
root-cause (first-hand @ ab63b6d3: null-name echo → blank chip; spec-contract violation) → Phase C product-critique
(WHAT right, no divergence) + design (centralized `resolveFacetNames`, additive/fail-soft, hot-path but bounded) +
must_haves (G-C19) → **adversarial plan-check (running)** → **GATE 1 (the ST-1d plan; PENDING)**. No code, no GitHub
write, no worktree/SUT/stack/flock yet (G-C3). Live RED reproduction + implementation are Phase D (post-GATE-1).
