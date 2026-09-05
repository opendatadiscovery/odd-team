---
id: CTRIB-065
title: "#1878 — saved searches hold every URL-only search dimension (asset_kinds + favorites): one canonical spec, two surfaces"
github_issue: 1878
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1878
target_repo: odd-platform
milestone: "1.0.0"
status: review-ready       # 2026-09-04 ~21:40 +02:00 — **/review ACCEPTED (session review-ctrib065)**: all six spec requirements PASS, all five must_haves proven, gates 1/3/4/6/9/10 PASS and 2/5/7/8/11 N/A with reasons. Reviewer ran its OWN four-suite regression on its OWN SUT built from ORIGIN's branch (feature-complete 331/16 — twelve tracked-baseline reds set-equal by spec:line, four off-baseline 60s timeouts DISJOINT from both prior runs; known-bugs 3-RED-expected/0-unexpected-GREEN; ingestion-e2e 15/15; multi-stack 16/3 adjudicated to a host network event + the documented C0 flake + a demo-stand readiness failure), plus IT-155 4/4 (the item's own gate, which no regression lane runs), plus a live API A/B on the running fix, plus tsc + vitest lib/search 48/48. Item STAYS review-ready: the human GATE-2 merge owns pending-release, /review release:1.0.0 owns done.
classification: bug        # a contract gap (the persisted representation cannot hold two shipped dimensions); the correct behaviour has ONE right answer, the fix has two defensible shapes (§7 D1)
parent: "CTRIB-061 (ST-7 / #1841 / PR #1875) — the slice that ADDED the second instance of this class and deferred it; retrospectives/LSN-042 — this record is the class-extension clause applied (G-C5)"
stream_id: ctrib065
base_sha: 96d77668         # origin/main = the #1875 squash; every line cited below was read at this SHA
branch: contrib/CTRIB-065-saved-search-holds-every-dimension   # created at GATE 1 from 96d77668 in the reused ../odd-platform-ctrib061 worktree (a SHA start-point: no upstream; push.default=current; O6/LSN-038)
head_sha: 510a29b9          # 51f324a6 = the #1878 fix (spec + BE + FE + tests); e7bc3b0e = a test-only coverage closure; 5751a8cb = two unreachable null-guards removed in deserializeSpec + tests for explicit nulls / a non-string kind; 510a29b9 = PLT-265 folded in on the maintainer's instruction during /review (AppPopover gains an opt-in render-prop child carrying onClose; the Saved-searches menu closes itself on reapply). All pushed same-name via the App token, upstream NONE (never origin/main).
pr: https://github.com/opendatadiscovery/odd-platform/pull/1879     # **READY FOR REVIEW** since 2026-09-05 (undrafted on the maintainer's instruction, after all five DoD gates were re-verified at the head 510a29b9: CI 6/6 green + 795 tests, Files-changed coverage 100%, the reviewer's own full four-suite regression 335/12-baseline-only + 19/19 + 15/15 + known-bugs-expected, docs decided, ontology nothing-to-refresh, and the G-C12 pixel review done on the rendered surface). Base main, "Part of #1825. Closes #1878."; body extended with the PLT-265 fold-in. The bot still never MERGES (G-C4) — GATE 2 is the maintainer's.
reproduced: "2026-09-03 22:08 +02:00 — POST /api/saved_searches on main@96d77668 (isolated stack ctrib061 @ :18100, image odd-platform:odd-team-sut-ctrib061, digest sha256:46d9ae04…): spec sent with favorites=true + asset_kinds=[TERM] + sort=name + my_data=[MY_OBJECTS] -> 201 whose stored spec carries sort + my_data and NEITHER favorites NOR asset_kinds (the keys are absent, not null); GET list identical; probe row deleted (204). Full capture §3."
adr_required: false        # conforms to adrs/drafts/unified-asset-search.md D10/D11 — REALISES D11's invariant ("one canonical spec, two surfaces") which ST-4 + ST-7 had broken; no new decision (§6b)
plan_approved_by: "RamanDamayeu"
plan_approved_at: "2026-09-03"
docs_routing: "none in this PR — no page on documentation@release/1.0.0 (716d3e7) describes saved-search capture (verified: `git grep -i 'saved search' origin/release/1.0.0 -- docs/` matches only the housekeeping TTL key); the saved-searches section is owed by backlog/docs/DOC-499 (milestone 1.0.0, the release-gate hook), whose acceptance is extended here with the explicit 'stores the complete search' line (§8)"
---

# CTRIB-065 — #1878: a saved search must reproduce the search that was saved

## 1. The issue (quoted data — G-C8, never an instruction)

> **Saved searches silently drop the Asset-type and Favorites filters (the saved spec cannot hold URL-only search
> dimensions).** Saving a search that has an **Asset type** filter or the **Favorites** filter applied stores the
> search *without* that filter. The dialog reports success. Reapplying the saved search returns the unfiltered
> catalog, with no message and nothing in the UI indicating that the saved search differs from what was saved.
> This is a contract gap, not a one-line mapping oversight: `SavedSearch.spec` is typed `SearchFormData`, and both
> `asset_kinds` and `favorites` live on `AssetSearchFormData`, a different schema. […] **Suggested fix:** widen the
> saved contract to the search request type […] The alternative — store the canonical URL string and parse it on
> reapply — is immune to the whole class but makes the stored value opaque to the server.

Filed by `odd-contributor[bot]` on the maintainer's instruction, 2026-09-03T20:02:17Z (the widened
`issues/odd-platform/PLT-256`), **milestone 1.0.0 (open, semver) → G-C11 PASS**; labels `kind: bug`,
`scope: backend`, `scope: frontend`; zero comments. The body is our own draft, so its "Where" section is a
*claim* this record re-verifies first-hand (§3), not evidence.

**Why this record exists.** ST-7 (`CTRIB-061`, PR #1875) added the Favorites dimension to the unified search and
deferred "saved searches will not capture it" as pre-existing (`asset_kinds` had the same gap since ST-4). The
maintainer found it on the first manual test of the merged feature. `retrospectives/LSN-042` installed the rule:
**a slice that adds an instance of a known-broken class owns the class.** This is that ownership, taken by the
`/contribute` run on the merged PR.

## 2. Classification + intake

| Field | Value |
|---|---|
| Class | **bug** — a persisted representation of search state that cannot hold two shipped dimensions of it |
| Entry gate | **reproduce-first (G-C1)** for the WHAT (done, §3). The correct behaviour has one right answer — *the saved search is the search that was saved* — so spec-gate is a short consistency pass (§4), not a WHAT hunt; the HOW has two defensible shapes, which is the single GATE-1 decision (§7 D1) |
| Epic? | No. One contract widening + its two projections + tests; one PR |
| G-C7 hard stop? | **No.** No migration (`saved_search.spec` is `jsonb`, `V0_0_97`); no auth-posture change (the owner-identity scoping of saved searches is untouched); no breaking public contract — `SavedSearch.spec` / `SavedSearchFormData.spec` widen to a **superset** (`AssetSearchFormData = SearchFormData + asset_kinds + favorites`, both optional), so every existing client payload and every stored row stays valid |
| Mission relevance | `lineage/odd-platform/system-mission.md` — Data Discovery. A saved search is the catalog's "this exact search, again later" promise; the #1825 thesis is one query language, one result list, one spec in two surfaces (ADR D11) |
| Streams | `state/active-streams.yaml` → `ctrib065` (Phase A/C read-only; reads `../odd-platform-ctrib061` detached @ `96d77668`). Peer session `odd-team-53` filed #1878 and confirmed by message it will not plan or implement this fix |

## 3. Reproduction (G-C1) + root cause — on the running system, then the source

**Captured 2026-09-03 22:08:55Z on `main@96d77668`** (my isolated stack `ctrib061`, port 18100, SUT image
`odd-platform:odd-team-sut-ctrib061` = the working tree at `96d77668`, no `+uncommitted`; `AUTH_TYPE=DISABLED`):

```
POST /api/saved_searches
{"name":"ctrib065-probe","spec":{"query":"","filters":{},"favorites":true,"asset_kinds":["TERM"],"sort":"name","my_data":["MY_OBJECTS"]}}
-> 201
{"id":1,"name":"ctrib065-probe",
 "spec":{"query":"","my_objects":null,"my_data":["MY_OBJECTS"],"upstream_depth":null,"downstream_depth":null,"sort":"name",
         "filters":{"types":null,"entity_classes":null,"tags":null,"namespaces":null,"owners":null,"datasources":null,"groups":null,"statuses":null}},
 "created_at":"2026-09-03T20:08:55.409027Z","updated_at":"2026-09-03T20:08:55.409027Z"}
GET /api/saved_searches?page=1&size=10 -> 200   items[0].spec keys: downstream_depth, filters, my_data, my_objects, query, sort, upstream_depth
DELETE /api/saved_searches/1 -> 204
```

`sort` and `my_data` (both on `SearchFormData`) survive; `favorites` and `asset_kinds` (both only on
`AssetSearchFormData`) are **absent from the stored spec** — not `null`, absent — and the client is told `201`.
This is the wire shape every assertion in §7 is written from (never from an assumed shape).

The UI half is the maintainer's own observation on merged `main` (#1878 "User-facing impact"): Favorites toggle
on → **Save current search** → reapply → the URL has no `favorites=yes`, the toggle is off, the whole catalog lists.

**Root cause, read first-hand at `96d77668`** (the issue's "Where" claims, each checked):

| Site | What it does | Verdict |
|---|---|---|
| `odd-platform-specification/components.yaml:2574-2587` `SavedSearch.spec` and `:2614-2623` `SavedSearchFormData.spec` | both `$ref: SearchFormData` | **confirmed** — the contract cannot express the two dimensions |
| `components.yaml:466-491` `AssetSearchFormData` | `allOf [SearchFormData, {asset_kinds, favorites}]` | confirmed — the request object already IS the superset the saved spec needs |
| generated Java (`odd-platform-api-contract/build/generated/.../model/AssetSearchFormData.java:27-47`) | a **flattened** class with all 9 fields (`query, myObjects, myData, upstreamDepth, downstreamDepth, sort, filters, assetKinds, favorites`); **no inheritance** from `SearchFormData` (`openApiGenerate` = `spring`, `interfaceOnly`, no `supportsInheritance`) | matters for the design: the service's three `SearchFormData` call sites become `AssetSearchFormData` call sites, nothing else changes shape |
| the HTTP layer | the request body is deserialised into the generated `SavedSearchFormData` whose `spec` is `SearchFormData` → the two unknown keys are discarded **before** `SavedSearchServiceImpl` ever sees them (the 201 above proves the drop; `serializeSpec(formData.getSpec())` at `SavedSearchServiceImpl.java:39,:71` only ever receives a `SearchFormData`) | confirmed — the drop is at the contract, not in the service logic |
| `SavedSearchServiceImpl.java:94-95 serializeSpec(SearchFormData)` / `:103-108 deserializeSpec → SearchFormData.class` | typed on the narrower class; fail-closed on unreadable jsonb (`:110-113`) | confirmed; the fail-closed contract must survive the widening |
| FE capture `SavedSearchForm.tsx:70` | `searchUrlStateToFormData(paramsToSearchState(location.search))` → `SearchFormData` (`searchUrlState.ts:366-389` returns no `assetKinds`/`favorites`) | confirmed. The superset projection **already exists** one function below: `searchUrlStateToAssetSearchFormData` (`:397-407`) — the reuse target |
| FE reapply `SavedSearches.tsx:43` and share link `:57` | `searchStateToParams(searchFormDataToUrlState(item.spec))`; `searchFormDataToUrlState` (`:422-460`) rebuilds `{query, facets, myData, depths, sort}` only | confirmed — no inverse exists for the two dimensions |
| FE rename `SavedSearchForm.tsx:61` | passes `savedSearch.spec` through untouched | type flows; no logic change |
| the 8 facet dimensions incl. `entityClasses` (`searchUrlState.ts:94-108 SEARCH_FACET_PARAMS`) | captured into `filters` and restored from it | **verified round-trip today** — the class has exactly the two instances the issue names, not a third |

## 4. `## Spec` — the falsifiable WHAT (G-C17, with the Consistency-keeper lens LSN-042 added)

Grounded in: the capture above; `adrs/drafts/unified-asset-search.md` D10/D11 ("one canonical spec, two
surfaces"); the source at `96d77668`; `lineage/odd-platform/sme-consultations/2026-08-30-favorites-tab-to-filter-ia.md`
Q4.4 ("the favorites scope must be saveable"); the maintainer's #1878 observation.

**Every representation of search state, and whether each dimension flows through it (the lens):**

| Dimension | URL (D10) | request object `AssetSearchFormData` | **saved spec** (D11) | reapply navigation | share link of a saved search | legacy `/api/search` session (D9) |
|---|---|---|---|---|---|---|
| query, 8 facets, my_data + depths, sort | yes | yes | yes (captured, §3) | yes | yes | yes / by design partial |
| `asset_kinds` (ST-4) | yes | yes | **NO → R1** | **NO → R2** | **NO → R2** | no — **by design** (D9, out of scope) |
| `favorites` (ST-7) | yes | yes | **NO → R1** | **NO → R2** | **NO → R2** | no — **by design** (D9, out of scope) |

| # | Requirement | Current (`96d77668`) | Target | Acceptance (falsifiable) |
|---|---|---|---|---|
| **R1** | The saved spec holds every dimension the request object holds | `SavedSearch.spec` / `SavedSearchFormData.spec` are `SearchFormData`; `favorites` + `asset_kinds` are dropped at the contract | both refs point at `AssetSearchFormData`; the server serialises / deserialises that type | `POST /api/saved_searches` with `favorites:true` + `asset_kinds:["TERM"]` returns `201` whose `spec` carries both; `GET /api/saved_searches` lists them; `favorites:false` is stored as `false` (a real filter); an **unset** `favorites` reads back as `null` or absent — the server emits explicit nulls, the §3 capture shows `"my_objects":null` — and **never** as `false` |
| **R2** | Reapply and share-link rebuild the complete URL | the URL is rebuilt from `{query, facets, myData, depths, sort}` only | `assetKinds` → `?asset_kinds[]=…`, `favorites` `true/false` → `?favorites=yes/no`, absent → no param | reapplying a saved search made with Favorites on lands on `/search?favorites=yes…` with the toggle on and a known un-starred asset absent; with Asset type = Terms lands on `?asset_kinds[]=TERM` listing only Terms; the copied share link carries the same params |
| **R3** | Capture stores the complete current search | the form captures the narrower projection | the form captures `searchUrlStateToAssetSearchFormData(paramsToSearchState(location.search))` | saving from `/search?favorites=yes&asset_kinds[]=TERM&sort=name` stores all three (the captured 201 body is the oracle) |
| **R4** | The invariant is **enforced**, so the NEXT dimension cannot repeat this (LSN-036 / LSN-042 rule) | nothing asserts "every URL-state key round-trips through a saved spec" | a compile-time-complete fixture (`Required<SearchUrlState>`) driven through capture → wire → reapply and compared deep-equal | adding a key to `SearchUrlState` without extending the projections fails the FE suite (type error on the fixture or a deep-equality miss); the BE round-trip test carries every field of the generated `AssetSearchFormData` |
| **R5** | Compatibility: rows saved before the change reapply unchanged | n/a | a stored spec without the new keys deserialises with both `null` / `undefined` and rebuilds the same URL as today | a row inserted with `{"query":"orders","filters":{}}` reapplies to `/search?q=orders` — no `favorites`, no `asset_kinds` param; the fail-closed contract (`:110-113`; `searchFormDataToUrlState` "never throws") survives |
| **R6-FE** | The FE inverse fails closed on garbage in a stored spec (the D10 posture, IT-006 white-screen class) | facet ids / sort / my_data are allow-listed on reapply | `assetKinds` tokens outside `AssetKind` are dropped; a non-boolean `favorites` → no narrowing | given a spec object with `assetKinds:["BOGUS","TERM"]` the inverse yields `?asset_kinds[]=TERM`; `favorites:"yes"` (a string) yields no favorites param; neither throws (FE unit — the only place a field-level drop is reachable) |
| **R6-BE** | The server reads a stored spec **leniently per token**, the way it already treats `sort` and `my_data` | `deserializeSpec` is all-or-nothing: `JSONSerDeUtils` sets no `READ_UNKNOWN_ENUM_VALUES_AS_NULL`, the generated `AssetKind.fromValue` throws on an unknown token, and `:110-113` then degrades the **whole** spec to empty — unreachable for kinds today only because kinds were never stored | a dedicated lenient reader for the stored spec (`READ_UNKNOWN_ENUM_VALUES_AS_NULL`, nulls filtered out of `asset_kinds`; a non-boolean `favorites` → null) so an unknown token is **dropped**, and only a structurally unreadable jsonb degrades to the empty spec | a jsonb `{"query":"q","asset_kinds":["BOGUS","TERM"]}` reads back as `query=q`, `asset_kinds=[TERM]` (the rest of the search survives); an unreadable jsonb still degrades to the empty spec, never a 500 (BE unit, extending `list_unreadableStoredSpec_failsClosedToEmptySpec_neverThrows`) |

**In scope:** the two `$ref`s; `SavedSearchServiceImpl`'s three call sites; the FE capture + the new inverse
projection + the reapply/share-link call sites; the regenerated BE/FE clients; the tests in §7; `DOC-499`'s
acceptance line (§8); the ontology refresh (§9).

**Out of scope (G-C5 — none of these is a class this change extends):** the legacy `/api/search` session and
`SearchFormData` itself (D9 keeps it non-breaking; the two dimensions are unified-path-only by design — the
existing test `searchUrlState.test.ts:320` pins that); DOC-499's saved-searches section authoring and DOC-503's
share-link bullet (both on the 1.0.0 train with release-gate hooks); ST-7b ordering (`PLT-257`); any change to
the saved-search dialog / menu UI; the `my_objects` deprecation mapping (unchanged, still round-trips).

**Ambiguity score: 0.05** — every dimension × representation cell is measured or read; the only open choice is
the fix's SHAPE (§7 D1), which is a maintainer decision by construction, not an unknown.

## 5. Product-critique of the request (G-C16)

The request — *a saved search must reproduce the search that was saved* — is the feature's definition, stated by
the maintainer from the running product and already written into ADR D11 in 2026-06 ("one canonical spec, two
surfaces"). There is nothing to reshape or rescope; "won't implement" would mean shipping 1.0.0 with a save
button that reports success and stores a different search. No SME re-consult: the 2026-08-30 SME note (Q4.4)
already required saveability of the Favorites scope, and #1878 was not a proposal but an observation.

Two product notes, recorded so they are decided rather than implied: **(a)** a saved `favorites:false` reapplies
to `?favorites=no`, which ST-7 renders as the *indeterminate* toggle (the state has no on-screen control; it is
API/URL-expressible by design) — consistent with the live URL behaviour, no new UX; **(b)** under
`auth.type=DISABLED` a saved favorites search is the instance-shared bucket, exactly like the live filter; the
saved-search row itself is keyed on the same shared identity (ST-3), so nothing new is exposed.

## 6. `## Design` — the HOW (G-C12)

**(a) Reuse-scan.** The capture side reuses `searchUrlStateToAssetSearchFormData` (ST-4, `searchUrlState.ts:397`)
verbatim. The inverse gets a sibling `assetSearchFormDataToUrlState(spec: AssetSearchFormData): SearchUrlState`
= `searchFormDataToUrlState(spec)` + the two dimensions with the same fail-closed discipline the forward parse
uses (`VALID_ASSET_KINDS` allow-list at `:91`; `favorites` boolean → `'yes' | 'no'`, else `undefined`) — mirroring the
existing forward pair (`searchUrlStateToFormData` / `searchUrlStateToAssetSearchFormData`), not a parallel
component. Backend: **no new class** — the generated `AssetSearchFormData` (a flattened superset) replaces
`SearchFormData` at `SavedSearchServiceImpl.java:39, :71, :89, :94-95, :103-113`. `git grep` at `96d77668`: no other
consumer of `SavedSearch.getSpec()` / `SavedSearchFormData.getSpec()` in `src/main`.

**(b) ADR-check.** `adrs/drafts/unified-asset-search.md`: **D10** (state lives in the URL as params) — unchanged;
**D11** ("the saved row holds the same param spec D10 encodes — one canonical spec, two surfaces"; "the spec extends
additively when the core lands") — this change **restores** the invariant at system level, which ST-4 and ST-7
had left broken; **D9** (the legacy `/api/search` session keeps `SearchFormData`, non-breaking) — untouched by
construction, since only the two saved-search `$ref`s move. No new ADR; nothing to reverse-engineer.

**(c) Impact checklist.**

| Dimension | Handled |
|---|---|
| Spec | `components.yaml` — 2 `$ref`s (`SavedSearch.spec`, `SavedSearchFormData.spec`) → `AssetSearchFormData`; the description text of `SavedSearch` updated (it currently says "the same SearchFormData the URL encodes") |
| Generated BE client | automatic — `odd-platform-api-contract` `compileJava.dependsOn openApiGenerate` (`build.gradle:44`); no hand-edited generated code |
| Generated FE client | `odd-platform-ui/generate.sh` (docker `openapitools/openapi-generator-cli:v7.2.0`); `generated-sources/` is gitignored, so **no committed regen** — but the FE code below only type-checks against the regenerated model, so the regen runs locally before `tsc` / vitest / eslint, and the PR body says so (CI does not run the FE suite — `run-pr-tests.yaml:58 -PbundleUI=false`; we run it ourselves, as ST-7 did) |
| Consumers of the changed signature | BE: `SavedSearchServiceImpl` ×3 sites; `SavedSearchServiceImplTest.form()` `:194` + assertions `:67,:114,:131` (type only); `SavedSearchControllerTest.form()` `:99`. FE: `SavedSearchForm.tsx:70` (capture), `SavedSearches.tsx:43` (reapply), `:57` (share link); `:61` rename passes the spec through. Redux slice / selectors / thunks are typed via the generated model and need no change (verified by grep — the only `.spec` reads are the three above) |
| Migration | none — `saved_search.spec jsonb`; old rows deserialise with the new fields `null` |
| Comments the widening falsifies | rewritten in the same commit: `searchUrlState.ts:411-412` ("a saved search stores exactly a SearchFormData"), `SavedSearchForm.tsx:29-30`, `SavedSearches.tsx:18,24`, `redux/thunks/savedSearch.thunks.ts:15`, `SavedSearchServiceImpl.java:98-101`, `__tests__/searchFormDataToUrlState.test.ts:17`. **Not** `V0_0_97__create_saved_search.sql:3-4` (the same sentence lives in a migration — Flyway checksums forbid editing it; the PR body says so) |
| i18n | none — no new visible string (verified: the change adds no `t()` call) |
| Docs | §8 — none in this PR; `DOC-499` acceptance extended |
| Ontology | §9 |
| Security posture | unchanged — identity scoping of saved searches and of the favorites predicate both stay server-side; a saved `favorites` narrowing re-evaluates under the *requester's* identity on reapply (D11's principle 4) — the stored spec carries a boolean, never an identity |

**(d) Product-Owner / SRE lens.** A saved search is the catalog's "view" (the ADR's DataHub-Views analogue); a
view that silently loses two of its filters is worse than no view, because the user trusts it. The SRE half is
the fail-closed contract: the reapply path runs inside a React render with **no error boundary** (IT-006), so the
new inverse must never throw on a legacy or hand-edited stored spec — R5/R6 are requirements, not niceties.

## 7. `## Plan` (the GATE-1 artifact)

### The exact change

1. **Contract** — `odd-platform-specification/components.yaml`: `SavedSearch.spec` (`:2587`) and
   `SavedSearchFormData.spec` (`:2623`) → `$ref: '#/components/schemas/AssetSearchFormData'`; refresh the two
   descriptions ("the same spec the URL encodes — `AssetSearchFormData`: query + filters + sort + My-data + Asset
   type + Favorites").
2. **Backend** — `SavedSearchServiceImpl.java`: `serializeSpec(AssetSearchFormData)`, `deserializeSpec` →
   `AssetSearchFormData.class` through a **lenient reader** (a copy of the shared mapper with
   `READ_UNKNOWN_ENUM_VALUES_AS_NULL`, nulls filtered from `assetKinds` — R6-BE), the fail-closed branch returning
   `new AssetSearchFormData()`; `toModel` unchanged in shape; the Javadoc at `:98-101` ("We only ever write a
   valid SearchFormData") rewritten. The `SavedSearchService` interface is untouched (its parameter types are the generated payload
   classes). Test helpers `form()` in the two existing tests move to `new AssetSearchFormData()`.
3. **Front end** — `lib/search/searchUrlState.ts`: add `assetSearchFormDataToUrlState`; `SavedSearchForm.tsx:70`
   → `searchUrlStateToAssetSearchFormData(...)`; `SavedSearches.tsx:43,:57` → `assetSearchFormDataToUrlState(item.spec)`.
   Regenerate the FE client (`generate.sh`), then `tsc --noEmit`, eslint on the changed paths, vitest.

### Tests — both buckets (G-C9), RED-first on `main`

| Bucket | Test | RED on `main` because | GREEN on the fix |
|---|---|---|---|
| unit FE — in **`__tests__/searchFormDataToUrlState.test.ts`**, the inverse's existing home (ST-3/ST-8: the representative round-trip `:30-38`, the legacy specs `:41-46`, never-throws `:91-97` — reuse those fixtures; its header JSDoc `:17` becomes false and is rewritten), new describe *"saved-search round-trip — one canonical spec, two surfaces (D11 / #1878)"* | **the invariant lock (R4), closed on both sides:** `const full: Required<SearchUrlState>` (every key: query, all 8 facets, all 3 My-data scopes + both depths, sort, assetKinds, favorites) → `searchUrlStateToAssetSearchFormData` → **the generated wire mapper** (`AssetSearchFormDataToJSON` then `AssetSearchFormDataFromJSON`) → `assetSearchFormDataToUrlState` → `toEqual(full)`; **and** `Object.keys(AssetSearchFormDataToJSON(searchUrlStateToAssetSearchFormData(full)))` set-equals the nine known wire keys — so a key regenerated onto `AssetSearchFormData` that `SearchUrlState` never carries fails too, not only a URL-side extension; the `favorites:'no'` variant; R5 fed the shape a legacy row actually returns post-fix (`favorites: null, assetKinds: null`) → today's URL, no params; R6-FE (garbage kind / string favorites → dropped, never throws); R3 capture from a literal `location.search` | `assetSearchFormDataToUrlState` does not exist / the projection drops both keys | the type error is the compile-time guard for the *next* dimension; the deep-equality is the runtime one |
| unit BE (`SavedSearchServiceImplTest`) | round-trip: `create` with `favorites=true` + `assetKinds=[TERM]` → the serialised jsonb (captured via the repository mock) contains both; `toModel` of that jsonb returns both; `favorites=false` stays `false`; a legacy jsonb `{"query":"orders","filters":{}}` deserialises to `null` kinds / `null` favorites (R5); `{"query":"q","asset_kinds":["BOGUS","TERM"]}` reads back with `query=q` and `[TERM]` (R6-BE — RED on `main` where the whole spec would degrade to empty, and RED on a naive widening); an unreadable jsonb still degrades to the empty spec | the payload type cannot carry the fields (the test does not compile against `main`'s generated model — the honest RED for a contract widening, as ST-7's ledger recorded for the same situation); the behaviour RED is the web test below | |
| unit BE, web layer (**new** `SavedSearchControllerWebTest extends BaseIntegrationTest`, `WebTestClient`, mirrors `AssetSearchControllerWebTest`) | `POST /api/saved_searches` with the §3 payload → `201` whose `spec.favorites == true` and `spec.asset_kinds == ["TERM"]`; `GET` lists them; a payload WITHOUT `favorites` comes back with `$.spec.favorites` **null-or-absent and never `false`** (`jsonPath(...).value(nullValue())`, not `doesNotExist()` — the server emits explicit nulls, §3); the RED-on-main proof is exactly the capture in §3 (201 with both keys absent) | on `main` the response body lacks both keys → assertion fails | this is the R1 gate and the CI-visible one (jacoco changed-lines ≥ 98 %, measured locally before CI) |
| integration (**new** `integration-tests/protocols/IT-155-saved-search-round-trip.md` + `e2e/specs/saved-search-round-trip.spec.ts`, stack `odd-minimal`, `validates: [F-017]` — the only saved-search promise the ledger resolves today is `F-017-UC-08`; re-pointed in the Phase-D ontology step once the saved-search feature node exists (§9) — `regresses: [PLT-256]`) | reuse IT-148's seed helpers (a starred subject, an un-starred foil, a Term). **Case 1** Favorites on + `q=` token → *Save current search* → reload → *Saved searches* → reapply → URL carries `favorites=yes`, the toggle is on, the **foil is absent** (the narrowing oracle, never presence). **Case 2** Asset type = Terms → save → reapply → `asset_kinds[]=TERM` and the seeded data entity is absent. **Case 3** the *Copy link* action yields a URL carrying the same params — there is no anchor to read (`CopyButton.tsx:41-42` calls `navigator.clipboard.writeText`), so the spec installs an `addInitScript` stub of `writeText` that captures the string, and asserts on it (deterministic, no browser permission dance). **Case 4 (R5)** a row created through the API with a legacy spec reapplies to `?q=…` with neither param. Every assertion on a response body reads the §3 captured shape (snake_case `asset_kinds`, `favorites`) | on `ref:main` cases 1-3 land on an unfiltered URL: the foil is present, the toggle off | lane: **`pending-merge` until #1878's PR merges**, then graduated at the GATE-2 close-out (the rule this session wrote into `pillars/tests/pillar.md`) |
| regression | the FULL four-suite `run-regression.sh ctrib065` on the working tree + the full unit build (`scripts/run-platform-tests.sh`) + the local patch-coverage gate — all RUN before the PR leaves draft (DoD) | | |

### `must_haves` (G-C19 plan contract)

```yaml
truths:
  - id: T1  # R1+R2+R3
    user_observable: "A search saved with the Favorites toggle on reapplies with the toggle on, the URL carrying favorites=yes, and an un-starred asset absent from the list."
    spec: R1, R2, R3
  - id: T2
    user_observable: "A search saved with Asset type = Terms reapplies listing only Terms, the URL carrying asset_kinds[]=TERM."
    spec: R1, R2, R3
  - id: T3
    user_observable: "The share link copied from a saved search carries the same favorites / asset_kinds params as the reapply URL."
    spec: R2
  - id: T4
    user_observable: "A saved search made before this change still reapplies exactly as it did (no new params, no error)."
    spec: R5, R6
  - id: T5
    user_observable: "An API client that POSTs a spec with favorites + asset_kinds gets both back on create and on list."
    spec: R1
artifacts:
  - path: odd-platform-specification/components.yaml            ; provides: the widened refs   ; anchor: "SavedSearch:" … "$ref: '#/components/schemas/AssetSearchFormData'"
  - path: odd-platform-api/.../service/SavedSearchServiceImpl.java ; provides: AssetSearchFormData (de)serialisation ; anchor: "AssetSearchFormData.class"
  - path: odd-platform-ui/src/lib/search/searchUrlState.ts        ; provides: assetSearchFormDataToUrlState ; anchor: "export function assetSearchFormDataToUrlState"
  - path: odd-platform-ui/src/components/Search/Results/SavedSearches/SavedSearchForm.tsx ; provides: superset capture ; anchor: "searchUrlStateToAssetSearchFormData("
  - path: odd-platform-ui/src/components/Search/Results/SavedSearches/SavedSearches.tsx   ; provides: superset reapply + share link ; anchor: "assetSearchFormDataToUrlState(item.spec)"
  - path: odd-platform-ui/src/lib/search/__tests__/searchFormDataToUrlState.test.ts ; provides: the invariant lock (R4 — a guard, not a user truth) ; anchor: "Required<SearchUrlState>"
  - path: odd-platform-api/src/test/.../api/SavedSearchControllerWebTest.java ; provides: T5 RED-on-main ; anchor: "spec.favorites"
  - path: odd-platform-api/src/test/.../service/SavedSearchServiceImplTest.java ; provides: BE round-trip + legacy ; anchor: "assetKinds"
  - path: integration-tests/protocols/IT-155-saved-search-round-trip.md + e2e/specs/saved-search-round-trip.spec.ts ; provides: T1-T4 through the real UI ; anchor: "favorites=yes"
key_links:
  - from: SavedSearchForm.tsx (Save)           -> to: POST /api/saved_searches spec     ; via: searchUrlStateToAssetSearchFormData(paramsToSearchState(location.search))
  - from: POST body                             -> to: saved_search.spec jsonb           ; via: generated SavedSearchFormData.spec: AssetSearchFormData -> serializeSpec
  - from: saved_search.spec jsonb               -> to: SavedSearch.spec on GET           ; via: deserializeSpec -> AssetSearchFormData.class (fail-closed)
  - from: SavedSearches.tsx (reapply / Copy link) -> to: /search?…favorites=yes&asset_kinds[]=… ; via: searchStateToParams(assetSearchFormDataToUrlState(item.spec))
  - from: the Search page                       -> to: the narrowed result list          ; via: the existing ST-4/ST-7 URL readers (unchanged; IT-148 already pins them)
scope_reduction_language: none   # no v1 / placeholder / "later"; the whole class ships in this slice
```

### Docs, ontology, comments

- **Docs (G-C10/G-C11):** §8 — none in this PR, `DOC-499` extended.
- **Ontology (G-C10):** §9 — `/enrich --touched` on the changed nodes + re-embed, committed in Phase D.
- **Issue thread:** no root-cause comment — the issue body (ours) already carries the root cause and impact verbatim,
  and the running-system capture confirms it rather than changes it; a restating comment would be noise (G-C6).
  **No scope comment** — the plan covers the issue's full scope; nothing is narrowed or deferred (G-C5). The
  draft-PR announcement on #1878 follows at Phase E.

### GATE-1 decision (plain language) — **APPROVED 2026-09-03: D1-A** (`RamanDamayeu`, via the pause-and-ask question; the plan-check verdict + the nine folded warnings were on disk and committed as `257c2dc8` before the ask)

| | **D1-A — widen the saved type to the request type (recommended)** | D1-B — store the canonical URL string |
|---|---|---|
| What it is | `SavedSearch.spec` becomes `AssetSearchFormData`, the exact object the search request already sends | the row stores `"?q=…&favorites=yes"` and the client parses it on reapply |
| Next dimension | one field on one schema; the FE lock test (T6) flags a missed projection | immune by construction (the URL carries whatever the URL carries) |
| Server can read the spec | yes — typed, validatable, greppable (`sort`, `my_data` already used this way) | no — opaque text; the server cannot validate, migrate or query specs |
| Migration / compatibility | none; old rows read back with the new fields empty | a data migration of every existing row from jsonb → string, or a dual-read path |
| ADR fit | realises D11 as written ("the same spec, two surfaces") | changes D11's storage shape (a new decision + ADR revision) |
| Cost | ~2 refs + 3 BE sites + 1 FE function + 3 FE sites + tests | a migration, a parser on the server, an ADR change |

**Recommendation: D1-A.** Approving this plan approves D1-A; choosing D1-B re-opens the design (§6b) and needs
an ADR revision before code.

**Note, not a decision (from the plan-check):** once kinds are stored, a future rename or removal of an
`AssetKind` token would touch every saved search carrying it. The plan adopts the posture the platform already
chose for `sort` and `my_data` (an unknown token degrades gracefully — dropped — rather than failing): R6-BE's
lenient read means such a rename costs a saved search one kind, not the whole search.

## 8. Docs — read, decided, routed (G-C10 / G-C11)

Read `documentation@release/1.0.0` (`716d3e7`) end-to-end for the saved-search surface: **no page describes it**
(`git grep -i "saved search" origin/release/1.0.0 -- docs/` → only `configuration-and-deployment/odd-platform.md:852`,
the housekeeping TTL key, which is the *search-session* facet table, not saved searches). `search.md`'s section
list (Query syntax / Faceted search / Scoping / My data / Favorites / Per-result transparency / Technical details /
Known limitations) has no saved-searches entry; the share-link bullet at `:182` lists what a URL carries and is
already owned by `DOC-503`. **`backlog/docs/DOC-499`** (`pending`, `milestone: "1.0.0"`, the release-gate hook)
owns authoring the saved-searches section for 1.0.0; this record extends its acceptance with one explicit line —
*"states that a saved search stores the complete search: query, facets, Asset type, Favorites, My data + depths
and ordering (no dimension is dropped), and that `favorites=no` is saved as-is"* — so the 1.0.0 gate cannot
publish the section without that truth. Therefore **`docs_routing: none` in this PR**, and this is not a deferral
of a class the change extends: the PR removes a behaviour gap; the doc gap is ST-3's, pre-existing, tracked with
the hook that forces it before publication.

## 9. Ontology (Phase D) — what was refreshed, and what could not be

**Done:** `lineage/odd-platform/feature-flows/detail/F-017.yaml` gains **`F-017-UC-15`** — the promise *"a saved
search reproduces the COMPLETE search that was saved … a search saved before #1878 reapplies exactly as it
did"*, `coverage: verified` by IT-155 + `SavedSearchControllerWebTest` + `SavedSearchServiceImplTest` + the
`searchFormDataToUrlState.test.ts` lock; `use_case_coverage` 3/14 → 4/15; `related_retrospectives` gains
`LSN-042`. IT-155's `validates: [F-017]` therefore resolves to a real node with a real promise.

**Checked, not assumed — no sidecar existed for any touched source file.** `ls lineage/odd-platform/understanding/`
has no entry for `SavedSearchServiceImpl`, `searchUrlState`, `SavedSearches` or `SavedSearchForm`, and
`nodes.jsonl` (3,725 nodes) carries only `JSONSerDeUtils.java` as an unenriched file-level node: the substrate
scan predates ST-3 (saved searches were never scanned in), so `/enrich --touched` has nothing of this slice's
to refresh, and the plan's "create the saved-search feature node" resolves into the UC-15 promise on the search
feature (F-017 is where the existing saved-search promise `F-017-UC-08` already lives) rather than a hand-built
F-node the reducers would not own. The substrate rescan that would give ST-3's files nodes is a corpus-wide
task (the manifest's `last_scan_commit`), not this slice's; it is noted for the tests pillar's next `/scan`,
not silently skipped. IT-148's unresolved `validates: [F-Favorites]` (pre-existing, plan-check W7) is left as
found — re-pointing another slice's gate is not this PR's scope; recorded here so the next favorites touch
fixes it.

## 10. Plan-check record (G-C19)

**Round 1 — `plan-checker`, fresh context, 2026-09-03 ~23:00 +02:00: `VERIFICATION PASSED`** — 6/6 requirements
traced to tasks + tests; 5 key-links wired (each new function has a named caller); the representation census
found no missed surface (no client-side storage of search state; history = the URL; no export; rename passes
the spec through); D11 holds at system level after the plan; D9/D10 untouched; the widening is additive for API
clients; `adr_required: false` confirmed; no class-extension deferral phrase; §8's docs routing judged a
legitimate out-of-scope with a forcing function (DOC-499's milestone + the acceptance line on disk); both
buckets present with the RED honestly stated; IT-155 is the next free id and no saved-search e2e exists.

**Nine warnings, all folded into §4/§6/§7/§9 before GATE 1:** (1) R6 over-claimed at system level — the server's
all-or-nothing read would have wiped a whole saved search on an unknown kind token → split into R6-FE / R6-BE
with a lenient per-token reader (the `sort`/`my_data` posture) + a GATE-1 note; (2) an unset `favorites` returns
`null`, not absent → the web test asserts null-or-absent-never-false, the FE R5 case is fed the real post-fix
shape; (3) the inverse already has a test home (`searchFormDataToUrlState.test.ts`) → the lock lives there and
its false header JSDoc is rewritten; (4) the lock only caught URL-side extensions → the wire-key set-equality
closes the other side; (5) six comments the widening falsifies added to the impact list, the migration excluded
(Flyway checksum); (6) IT-155 case 3's clipboard mechanism named (an `addInitScript` stub of `writeText`);
(7) `F-SavedSearch` does not exist → Phase D creates the node and re-points `validates:`; (8) T6 moved out of
`truths` (a guard, not a user truth); (9) the registry's stale "UNFILED" wording corrected (#1878 is filed).
No second round needed: no BLOCKER was raised, and every warning was closed by a plan edit, not deferred.

## 11. Test ledger — every row RUN here, none "deferred to review"

| Gate | Status |
|---|---|
| FE `tsc --noEmit` / eslint (changed paths) / vitest `lib/search` | **GREEN** — 0 type errors; 0 lint problems after `--fix` (prettier reflow only); **48/48** (`searchFormDataToUrlState.test.ts` 14 incl. the 6 new: the lock, wire-key set-equality, `favorites=no`, the pre-#1878 shape, per-field fail-closed incl. an undefined spec, capture from a literal `location.search`; `searchUrlState.test.ts` 34) |
| FE full unit suite (`vitest run`) | **190/192** — the two reds (`DataSourceItem.test.tsx` REJECTED-delete dialog, `DataEntitiesUsageInfoView.test.tsx` render) re-run **green in isolation** (4.3 s and 2.0 s against a 5 s vitest bound — they timed out while the ref:main jib build ran concurrently) and are **change-independent by import graph** (neither file imports anything this change touched) |
| i18n key-parity guard (the repo's existing test, CI does not run it) | **17/17** — no new visible string; all 7 catalogs at parity |
| FE client regeneration | `generate.sh` (docker openapi-generator 7.2.0) — `SavedSearch.spec` + `SavedSearchFormData.spec` now `AssetSearchFormData` in the generated TS (verified by grep); gitignored, so nothing generated is committed |
| BE codegen staleness (the known gotcha) | the first SUT build **failed at `compileJava`**: `openApiGenerate` tracks only `openapi.yaml`, so the Java `SavedSearchFormData.spec` was still `SearchFormData` → `odd-platform-api-contract/build/generated` deleted, codegen re-ran, `private AssetSearchFormData spec;` verified in the regenerated model |
| BE targeted build — `run-platform-tests.sh --tests "*SavedSearch*"` (checkstyleMain + checkstyleTest + the filtered tests) | **BUILD SUCCESSFUL 5m18s** after one checkstyle fix (a `CustomImportOrder` violation on the new `JsonNode` import — caught by the gate, not by review). `SavedSearchServiceImplTest` **13/13** (the 10 existing + round-trip, pre-widening row, per-token lenient read), `SavedSearchControllerTest` **4/4**, `SavedSearchControllerWebTest` **2/2** on a real Postgres — the 201 body + list keep both keys; an unset `favorites` is `null`, never `false` |
| RED-on-main for the unit bucket | the service + controller tests **cannot compile against `main`'s generated model** (`AssetSearchFormData` has no place in `SavedSearchFormData.spec` there) — the honest RED for a contract widening, same as ST-7's ledger; the **behaviour RED** is §3's captured `201` without the keys, which the web test asserts against |
| IT-155 on the fix (working-tree SUT) — **five runs, and the reds MOVE** | **Every case has passed on the fix in at least three of the five runs; no single run was clean, and the failing case differs every time.** Per-case durations from the Playwright reports make the cause measurable rather than assumed: case 2 costs **15.6-16.3 s** and case 4 **8.9-9.5 s** in *every* run, while case 3 costs **8.3 s quiet and 19.9 s / 50.2 s under load** — same code, a 6x spread, and every loss is *the SPA not painting*, never an assertion. Two real spec defects were found and fixed on the way (run 1: the reapply popover is a MUI Modal that stays open and hides the page from role queries → dismiss with `Escape`; the toolbar renders only on a search page → case 4 now starts from a narrowed search, which also makes the reapply a real transition). Then, sized against that measurement and matching the idiom **12 specs in this suite already use**: a one-time warm-up `beforeAll`, a boot wait of 60 s inside `test.setTimeout(150_000)` per case — **every assertion keeps its own bound**. That changes what the test *waits for*, never what it *proves*: on `ref:main` cases 1-3 fail on **values** (the stored spec carries no `favorites` / `asset_kinds`; the share link carries neither), which no timeout can turn green. The final spec is re-run on **both** SUTs (a changed test must still go RED on base — G-C15); results recorded below |
| IT-155 on `ref:main @ 96d77668` (`ctrib065red`) | **RED by construction, twice**: run 1 4/4 red — `spec.favorites` undefined, `spec.asset_kinds` undefined, the share link `/search?q=it155` only; run 2 3/4 red with the same three reasons (case 2 at the boot wait) and **case 4 GREEN on main** — the compatibility guard, as designed |
| **IT-155 FINAL pair — the same (final) spec on both SUTs, back to back** | **The complementary pattern the whole slice rests on.** On the fix: cases **1, 2, 3 PASS** — the Favorites scope survives save → reapply with the foil excluded, the Asset-type narrowing survives, and the copied share link carries both. On `ref:main`: those same three **FAIL ON VALUES, not on time** — `spec.favorites` is `undefined`, `spec.asset_kinds` is `undefined`, and the share link is `http://…/search?q=it155` with no `favorites` param. Case 4, the pre-#1878 compatibility guard, is **GREEN on `main` by design** and its only loss on the fix was a boot timeout. So the widened per-test budget provably cannot be what turns the test green: **`main` fails on assertions, which no timeout can satisfy** (G-C15 discharged). Across the final pair plus the earlier runs, **every one of the four cases has passed on the fix** |
| **The one red that reproduced — `entity-metadata-display:30` (IT-017) — chased to the end** | It failed in regression #1, regression #2, an isolated retry, and my first A/B attempt, while passing on `main` — four reds on the branch against two greens on main, which is a regression claim, not a flake, until disproved. So the ORDER confound was controlled (every one of those four was the first cold run after a teardown) and the endpoint itself was probed: **MAIN-first 2/2 pass, probe `GET /api/dataentities/2001` → HTTP 200 in 0.25 s; FIX-second 2/2 pass, 200 in 0.18 s; FIX-third 2/2 pass, 200 in 0.13 s**, with **zero platform ERROR/WARN lines** in every window. The spec passes twice on the fix image once it is not the first cold run, and the request it waits on is answered in a fifth of a second. **Not this change.** Same TST-057 class, recorded there with the two isolation-method artifacts it exposed |
| The product finding IT-155 surfaced | the Saved-searches menu stays open after picking an entry and hides the reapplied page from assistive tech — **`PLT-265`** (low), not this PR's (§13) |
| Upstream CI at `51f324a6` (draft PR #1879) | **all six check-runs green** — `run_tests` (794 tests, 0 failed), Playwright lint / format-check / test, Test Results, `update_release_draft`. **Backend Coverage bot: Files changed 94.85% ✗** (< 98) — `SavedSearchServiceImpl.java` 97.91%, `JSONSerDeUtils.java` 70.91% (file-level, the file's old untested methods) → the local changed-lines gate below closes it |
| Local changed-lines coverage (98 % gate) | **MEASURED at `51f324a6`: 30/31 lines = 96.77 %** (a jacoco report generated from the FULL run's exec data — the two earlier 84.62 % readings were a STALE 2026-09-02 report; the failed `test` task never reached `jacocoTestReport`) — the single missed line was the stored-spec-is-not-a-JSON-object branch → covered by **`e7bc3b0e`** (test-only). CI's bot then read **97.79 %** at `e7bc3b0e` with every line covered, i.e. it weighs **untaken branches**: two were unreachable guards (`readTree` never returns null; `treeToValue` on an object node never does) and two were real (explicit JSON nulls; a non-string kind element) → **`5751a8cb`** removes the dead guards (3 production lines, behaviour unchanged) and tests the real ones. **CONFIRMED LOCALLY at the head `5751a8cb`: 30/30 changed executable lines = 100.00 %, gate 98 % → PASS** (`patch-coverage.py` against a jacoco report from the targeted service tests). **CI agrees: Files changed 100 % ✓** (`SavedSearchServiceImpl.java` 99.52 %, `JSONSerDeUtils.java` 70.91 % file-level — the file's old untested methods; its two new lines are covered) — **the 98 % gate is MET at the head**, with all six check-runs green (`run_tests` 794 tests, 0 failed). The local re-measurement at the head (a jacoco report from the targeted service tests) is queued behind IT-155 run 5 as confirmation |
| FULL unit build (`run-platform-tests.sh`, no-arg = `:odd-platform-api:build`) | **824 / 825, BUILD FAILED on one test — `OpenApiDocsContractTest.platformApiGroupDocumentLoads()`, `TimeoutException` at `:44`** (its 60 s bound) while the box carried this build + the demo collector loop at load ~10. That test is **TST-057's recorded instance** (4th/5th/7th: "PASS by 307 ms on clean main"; RED under load) and touches nothing this change touches. **CI ran the identical build at the same SHA `51f324a6` and passed it — 794 tests, 0 failed — which the pillar accepts as the same measurement** (memory `reference_odd_platform_coverage_gate_mechanics`). Checkstyle main + test clean. 34m04s |
| FULL four-suite regression #1 (`run-regression.sh ctrib065`, flock, isolated) — SUT `WORKING TREE @ 51f324a6+uncommitted` (image `sha256:9fd77c3b…`; the only uncommitted file was a test, which jib excludes, so the image content == `51f324a6`) | **`feature-complete` 331 / 16 of 347 (39.3m)** — vs **328 / 19 on `main@96d77668`** the evening before, on this same box. **Twelve** = the tracked baseline by exact spec:line (TST-059's eleven + TST-057's `swagger-openapi-discovery:63`). **Four outside it, all the TST-057 contention class and none driving saved searches:** `entity-activity-tab:170` (the IT-089 case whose red has now moved between :130 and :170 on five samples), `owner-association-history:129` (TST-057's *second* instance, 2026-07-03), `favorites-star-see-loop:93` (IT-148 case 1 — the same first-paint case as yesterday's main run; **IT-148 ran 6/7 here, from its new `feature-complete` slot**), and `entity-metadata-display:30` (new to the list; a 1.0m `waitForResponse` timeout). Every one of the four is a 60 s / first-paint timeout with the maintainer's demo collector restart-looping at ~100 % CPU throughout; an isolated fresh-stack retry of the four (IT-016 / IT-089 / IT-109 / IT-148) is queued behind regression #2 and recorded below. `known-bugs` **3 red = IT-004 / IT-006 / IT-007, the expected quarantine; no unexpected GREEN** (no fix landed un-flipped). `multi-stack` **18 / 1 of 19 (17.7m)** — **IT-154 (the demo stand) 5/5 GREEN**, LOGIN_FORM / LDAP / MinIO / WAL all green; the 1 = `my-data-scope-narrows:413` (IT-153, its "search settled" 30 s wait on the results header) — the spec CTRIB-062 recorded as its C0 flaky case (yesterday it was `:434`, green on retry): the red moves between its cases, n=6 across sessions. Own-stack LOGIN_FORM spec, no saved-search surface; in the isolated retry set. `ingestion-e2e` **14 / 1 of 15 (11.4m)** — the whole dataset-pipeline stand green through the real collector; the 1 = `relationships-ingestion-pipeline:195` (the GRAPH overview's `Source:` label not visible in 20 s on a page reached after a full neo4j ingestion) — a first-paint timeout of the same class, on a stand that touches no saved-search code. **Regression #2 at the final head `5751a8cb` re-measures all four suites** (this run's image content was `51f324a6`; the head adds 3 production lines), and the off-baseline reds get an isolated fresh-stack retry — both recorded below when they land |
| FULL four-suite regression **#2** at the final head `5751a8cb` (`run-regression.sh ctrib065`, flock, isolated) | **`feature-complete` 329 / 18 of 347 (42.2m)** — and read against run #1 (331/16) it settles the adjudication. **The same twelve tracked-baseline reds in both** (TST-059's eleven + TST-057's `swagger-openapi-discovery:63`). **The off-baseline set is almost completely DIFFERENT between the two runs of the same code:** #1 had `entity-activity-tab:170`, `owner-association-history:129`, `favorites-star-see-loop:93`, `entity-metadata-display:30`; #2 has `activity-feed:117`, `entity-business-name-display:37`, `entity-terms-display:33`, `recently-viewed-record-see-loop:67`, `schema-revision-compare:152`, `entity-metadata-display:30` — **one spec in common out of nine**, and all three of #1's are GREEN in #2. Every one is a 1.0m timeout, **not one is an assertion failure**, and `recently-viewed-record-see-loop:67` is TST-057's own recorded ~40 %-flaky case. A real regression does not move between specs on re-run; contention does. **IT-148 ran 7/7 GREEN** here (6/7 in #1) from the slot it graduated into, and **IT-155 correctly did not run** — it is parked in `pending-merge` until this PR merges, which is the lane rule working as designed. **`known-bugs` 3 red = the expected quarantine, no unexpected GREEN.** **`multi-stack` 19 / 19 — a CLEAN SWEEP**, the first across the last three runs of that lane (main yesterday 18/1, regression #1 18/1): IT-153's `:413` red from run #1 passes here, which retires it as flaky rather than broken and matches CTRIB-062's own C0 record. IT-154's demo stand 5/5 again. **`ingestion-e2e` 15 / 15 — also a CLEAN SWEEP** (run #1 was 14/1): `relationships-ingestion-pipeline:195`, run #1's red, passes here too. **Both green-target lanes that carried a single red in run #1 are fully green at the final head**, which completes the contention signature: nothing that failed in run #1 outside the tracked baseline reproduces in run #2, and the reds that appear instead are a different, equally arbitrary set of 1.0m timeouts |
| Docs | none in this PR — §8 (read, decided, `DOC-499` extended) |
| Ontology | §9 — `F-017-UC-15` added, `LSN-042` linked, graph re-embedded (`graph-build`: 9,909 nodes / 10,855 vectors); no sidecar existed for any touched file |
| Rendered surface reviewed as a user (G-C12 step 5) | IT-155 case 1 writes `test-results/it155-reapplied-favorites.png` after reapply (the toggle on, the URL carrying the scope, the list narrowed) — captured on the clean run 5 |

## 13. Follow-ups logged on disk (`playbooks/follow-up-on-disk.md`)

| Item | What | Why it is not fixed here |
|---|---|---|
| `issues/odd-platform/PLT-265` (new, low) | The **Saved searches** menu stays open after picking an entry (its modal backdrop marks the reapplied page `aria-hidden` until dismissed) — found while driving IT-155: a role-based check on the reapplied page could not see the sidebar | Pre-existing ST-3 (#1855) menu behaviour; not a representation of search state, so not a class this change extends (G-C5 class-extension clause checked, not just cited). One-line fix in `handleReapply` (close the popover), paste-ready for the maintainer |
| `backlog/docs/DOC-499` (extended) | The saved-searches section owed for 1.0.0 must state that a saved search stores the complete search and that `favorites=no` is saved as-is | The doc gate's obligation (§8) — the fix removes the behaviour gap; the section's absence is ST-3's tracked doc debt with the release-gate hook |
| substrate rescan (noted for the tests pillar's next `/scan`, no new item) | ST-3's files have no substrate nodes / sidecars, so `/enrich --touched` could refresh nothing of this slice (§9) | A corpus-wide `lineage-extractor scan` against current `main`, not a per-slice action |

## 12. Comments (issue-thread URLs)

- none yet (see §7 "Docs, ontology, comments").

## Review (2026-09-04, session: review-ctrib065)

- **Result**: **ACCEPTED — GATE-2-ready.**
- **Reviewed**: odd-platform `contrib/CTRIB-065-saved-search-holds-every-dimension` @ `5751a8cb` (verified live
  as origin's branch head; base `origin/main` still `96d77668`, no drift) / draft PR #1879. No documentation
  branch by design (`docs_routing: none` — Gate 8 below).
- **Separate-session gate**: HOLDS. All three commits carry
  `Claude-Session: …/session_01Mq9hpLKSPNXp7c5GH3NDhu`; this review is a different session.
- **No 2-minute bounce — checked, not assumed.** §11 declares all five DoD gates RUN at the head *and* the
  artefacts exist: four 2026-09-04 run-log entries citing SUT digest `sha256:5fcba4ea…`, an image created
  09:58:23Z — 49 minutes **after** the head commit (09:09:48Z).
- **`Sources:` footer**: absent from all three commits, and correctly so — checked against precedent rather
  than applied mechanically. Of the last 60 commits on odd-platform `origin/main` exactly one (`9d3de146`,
  CTRIB-028) carries one, while every ST-3…ST-8 slice a prior `/review` accepted (`96d77668`, `b5d9f150`,
  `969a5d5b`, `ab457f0d`, `f714d8fa`) does not; the convention is the documentation pillar's (11 of the last 30
  `documentation` commits). The provenance it exists to force is met in substance: §3 cites every root-cause
  site by `file:line`, each re-read at `96d77668`.

### Acceptance criteria — the §4 requirements, each re-derived

- **R1 — the saved spec holds every dimension the request object holds** — PASS. `components.yaml:2590` and
  `:2629` both `$ref: AssetSearchFormData`; `SavedSearchServiceImpl.java:107` serialises it, `:128-144`
  deserialises it. `AssetSearchFormData` = `allOf[SearchFormData, {asset_kinds, favorites}]`
  (`components.yaml:466-491`), and `SearchFormData`'s only `required` is `filters` (`:2571`), unchanged — a
  strict superset, so no existing payload or stored row is invalidated. Proven on a running system: see
  **live API verification** below.
- **R2 — reapply and the share link rebuild the complete URL** — PASS. `SavedSearches.tsx:48` (reapply) and
  `:62` (Copy link) both route through the new `assetSearchFormDataToUrlState` (`searchUrlState.ts:479-496`);
  IT-155 cases 1-3 green on my own SUT.
- **R3 — capture stores the complete current search** — PASS. `SavedSearchForm.tsx:77`; the FE case
  "captures the FULL current search from a literal location.search" passed in **my** run.
- **R4 — the invariant is enforced so the NEXT dimension cannot repeat this** — PASS, and the lock is real,
  not decorative. `Required<SearchUrlState>` over the 8-key interface (`searchUrlState.ts:171-191`) makes a
  ninth URL key a **compile** error in the fixture; the `Object.keys(AssetSearchFormDataToJSON(…))`
  set-equality against the nine wire keys makes a tenth regenerated wire key a **runtime** failure. The two
  sides are genuinely independent, so neither can be satisfied by editing the other.
- **R5 — rows saved before the change reapply unchanged** — PASS. BE `list_rowSavedBeforeTheWidening…`; the FE
  case asserts the legacy shape maps to BOTH today's URL state and `searchFormDataToUrlState(legacy)` — the
  strongest form of "nothing changed"; IT-155 case 4 is GREEN on `main` by design, which is what makes it a
  compatibility guard rather than a fix-proof. Re-proved live on real stored jsonb (below).
- **R6-FE — the FE inverse fails closed per field and never throws** — PASS (stale kind dropped, string
  `favorites` ignored, `{}` and `undefined` non-throwing; ran here).
- **R6-BE — the server reads the stored spec leniently PER TOKEN** — PASS, and the design is *necessary*, not
  ornamental: I read the shared mapper (`JSONSerDeUtils.java:15-21`) — it disables
  `FAIL_ON_UNKNOWN_PROPERTIES` but sets **no** `READ_UNKNOWN_ENUM_VALUES_AS_NULL`, so binding an unknown
  `AssetKind` really would throw and, via the whole-document fallback, cost the user the entire saved search.
  `sanitiseSpecTree` (`:147-170`) removes exactly that failure mode at field grain — verified on real stored
  jsonb below, which is the only place this case is reachable.

### must_haves (T1-T5) — every user-observable truth proven by me

T1 (Favorites survives save → reapply, foil excluded), T2 (Asset-type narrowing survives), T3 (the share link
carries the same params), T4 (a pre-change row reapplies unchanged): **IT-155 4/4 PASS** on my own SUT.
T5 (an API client gets both keys back on create and on list): **verified live** — see below.

### Quality Bar

- **Gate 1 — no duplicates** — PASS. Capture REUSES `searchUrlStateToAssetSearchFormData`
  (`searchUrlState.ts:406`, shipped by ST-4); the new inverse is the missing sibling of an existing pair and
  delegates to `searchFormDataToUrlState` (`:433`) rather than re-implementing it. No new BE class. VERIFIED
  via `grep -rn` over `odd-platform-ui/src` — no parallel projection introduced.
- **Gate 2 — aliases** — N/A (none introduced or used).
- **Gate 3 — caveats captured** — PASS in the only homes that exist: the "`favorites:false` is a REAL filter,
  never default it" rule and the unset-reads-back-`null` contract are on both spec schemas and asserted by
  tests rather than merely stated.
- **Gate 4 — consumer-read** — PASS, re-derived rather than taken from the record. BE:
  `SavedSearchServiceImpl.java:52`, `:84`, `:102` — and `git grep` finds **no** other `getSpec()` consumer in
  `src/main`. FE: `SavedSearches.tsx:48`/`:62`, `SavedSearchForm.tsx:66` (rename passes the stored spec
  through) and `:77`. `Search.tsx:79` still uses the narrower `searchUrlStateToFormData` — correct: that is
  the legacy `/api/search` session (ADR D9), deliberately untouched. `odd-platform/tests/**` has zero
  saved-search references.
- **Gate 5 — unset-parameter audit** — N/A (no SDK builder). The analogous audit here — every field of the
  widened payload classified — is R4's wire-key set-equality, which is stronger than a one-off enumeration.
- **Gate 6 — bidirectional code ↔ doc** — PASS, with the gap tracked rather than narrated. Code → doc: the
  touched user-visible path has **no** doc coverage anywhere (`git grep -in "savedsearch\|/api/saved\|save
  current search\|SearchFormData" origin/release/1.0.0 -- docs/` → zero saved-search hits), so the change
  falsifies nothing published; the obligation sits on `DOC-499` (pending, `milestone: "1.0.0"`, acceptance
  extended by this slice with the explicit complete-search line) — a real forcing function, since the release
  gate derives its manifest by grepping that milestone. Doc → code: every claim added to the spec descriptions
  traces to code I read. The **developer-audience** half of the same gap was untracked → filed as **DOC-526**.
- **Gate 7 — layout** — N/A (no doc pages / SUMMARY). The workspace-side layout that *is* owed is complete:
  IT-155 protocol + spec + a `suites.yaml` lane entry with a named graduation OWNER, run-log entries per suite,
  `F-017-UC-15`, `PLT-265`, `TST-057` extended.
- **Gate 8 — publishing standards** — N/A-with-obligation, deliberately **not** PENDING-RELEASE: this slice
  authors no doc. Checked against the `review-ctrib040` case-law (a release-gated doc parked in a backlog item
  with no train commit is a FAIL) — it does **not** apply. There, content was owed by the slice and drafted
  instead of authored. Here the entire saved-search surface is undocumented (ST-3's pre-existing debt), no
  published sentence is falsified, and writing one truth-line into a section that does not exist would mean
  doing DOC-499's whole scope. **Owed at the 1.0.0 release gate**: live-verify DOC-499's complete-search line.
- **Gate 9 — factual claim provenance** — PASS. Re-derived at the head: the two `$ref`s; the flattened
  generated model; the mapper's missing `READ_UNKNOWN_ENUM_VALUES_AS_NULL` (the premise R6-BE rests on); the
  "no other consumer" grep; the "no page describes saved searches" grep; the "no sidecar exists for any touched
  file" claim (`lineage/odd-platform/understanding/` has none; `nodes.jsonl` carries only `JSONSerDeUtils`);
  the issue live (open, milestone 1.0.0 open, semver → G-C11); and CI at `5751a8cb` — **6/6 check-runs green,
  795 tests / 0 failed / 183 suites**, coverage bot **Files changed 100%** with links pinned to that SHA. No
  banned phrase used.
- **Gate 10 — content-type homing** — PASS. The descriptive text added to `components.yaml` is schema
  documentation living on the schema — its canonical home; no API-reference content was embedded in a feature
  page. The missing canonical home for that content type is what DOC-526 files.
- **Gate 11 — audience isolation** — N/A (no `documentation/docs/**` file touched). Noted, not charged: three
  odd-platform TEST comments name `CTRIB-065` / `LSN-042` / `contributor/CTRIB-065.md §3`. Gate 11 governs
  published doc pages, and the surrounding code already cites odd-team protocol ids (`IT-006` in
  `searchUrlState.ts` on `main`) — the repo's established convention, not a leak.

### G-C15 — the changed-test danger zone

CLEAN, checked line by line. The diff CHANGES exactly three test lines, all type-only and forced by the
widening: `SavedSearchControllerTest.java:99`, `SavedSearchServiceImplTest.java:313`
(`new SearchFormData()` → `new AssetSearchFormData()`) plus the two import swaps. Everything else is an
APPEND. No matcher weakened, no real boundary swapped for a mock, nothing `.skip`/`@Disabled`/deleted. The one
rewritten prose block is the `searchFormDataToUrlState.test.ts` header JSDoc, whose old text ("a saved search
stores exactly a `SearchFormData`") the change makes FALSE — rewriting it is required, not cosmetic.

The sibling trap for a NEW test — "did a widened timeout turn it green?" — is answered on **values**: on
`ref:main` IT-155 cases 1-3 fail because `spec.favorites` and `spec.asset_kinds` are `undefined` and the share
link carries neither. No timeout satisfies a failed equality. I anchored that independently: the contract at
`96d77668` cannot express either field, and the §3 capture on a running `main` is a real `201` with neither key.

### Regressions — my own runs, on my own SUT built from ORIGIN's branch

SUT `odd-platform:odd-team-sut-revctrib065`, built with `ODD_SUT=ref:contrib/CTRIB-065-…` — i.e. from origin's
copy of the branch, never from a stream's worktree, so the tested bits are the pushed ones.

- **`feature-complete` 331 passed / 16 failed of 347 (40.7m)** — and this settles the adjudication the
  implementer opened.
  - **Twelve = the tracked baseline, SET-EQUAL by exact `spec:line`**: `catalog-search` 48/62 ·
    `entity-class-type-badge-list` 59/77 · `recently-viewed-record-see-loop` 117/213 ·
    `popular-entities-ranking` 62 · `search-url-state` 38 · `search-result-stale-signal` 62 ·
    `search-result-row-click` 45 · `search-class-tab-filter` 149 (TST-059's eleven) +
    `swagger-openapi-discovery` 63 (TST-057).
  - **Four off-baseline, every one `page.waitForResponse: Test timeout of 60000ms exceeded` — not one an
    assertion failure**: `activity-user-filter:211` · `directory-hierarchy-browse:100` ·
    `entity-owners-display:20` · `microservices-lineage:88`.
  - **My off-baseline set is DISJOINT from BOTH of the implementer's** (#1: `entity-activity-tab:170`,
    `owner-association-history:129`, `favorites-star-see-loop:93`, `entity-metadata-display:30`; #2:
    `activity-feed:117`, `entity-business-name-display:37`, `entity-terms-display:33`,
    `recently-viewed-record-see-loop:67`, `schema-revision-compare:152`, `entity-metadata-display:30`).
    Three runs of the same code produce three arbitrary, mutually-disjoint sets of 60-second first-paint
    timeouts while the twelve tracked reds are identical every time. **`entity-metadata-display:30` — the one
    red that reproduced twice for the implementer and that they chased with an order-controlled A/B/B — is
    GREEN in my run**, independently confirming their "not this change" verdict.
  - `search-url-facets` executed and passed **4/4** (`:130 :163 :206 :246`), independently re-confirming
    TST-059's "really is repaired" note rather than taking it on trust.
- **`known-bugs` 3 red = IT-004 / IT-006 / IT-007** — the expected quarantine, **no unexpected GREEN** (which
  would mean a fix landed without its flip-on-fix).
- **`ingestion-e2e` 15 / 15 — clean sweep.**
- **`multi-stack` 16 passed / 3 failed (19.4m)** — worse than the implementer's 19/19, so adjudicated rather
  than waved through, and the cause is external and **measured**:
  - `my-data-scope-narrows:413` died on **`page.goto: net::ERR_NETWORK_CHANGED`** — a host network-interface
    event inside Chromium, not an application assertion at all. `journalctl` shows Cisco AnyConnect
    (`acvpnagent`) actively probing and reconfiguring the network on this box during the window
    (`NETENVIRONMENT_ERROR_PROBE_INCOMPLETE`, `SOCKETTRANSPORT_ERROR_CONNECT_TIMEOUT`). No code change can
    produce that error.
  - `my-data-scope-narrows:388` — `getByTestId('search-results-count')` not found in 30s: the documented C0
    flake of this exact spec (CTRIB-062: one red in seven whole-suite samples, and the red MOVES between its
    cases — `:259`, `:413`, `:434`, now `:388`).
  - `demo-stand-first-run:203` (IT-154) — **not a flake, and now root-caused rather than attributed.** It
    REPRODUCED on my confirmation re-run, so I chased it: `demo-stand.ts:28` resolves
    `PLATFORM_DIR = process.env.ODD_PLATFORM_DIR ?? '../odd-platform'` and composes
    `<that>/docker/demo.yaml`. `run-regression.sh` always sets that variable (to a clean per-stream worktree);
    `run-suite.sh` does not, so my lane re-run composed the **shared** checkout — in which the maintainer has
    an **uncommitted** `docker/demo.yaml` adding `AUTH_TYPE=LOGIN_FORM` + `AUTH_LOGIN_FORM_CREDENTIALS`. Under
    LOGIN_FORM the injector loud-refuses (odd-platform#1877 / CTRIB-064), so the enricher exits 1 and the
    catalog read is auth-gated — exactly the observed failure. The harness read someone's WIP; the code under
    review is not involved. Logged by **extending `TST-066`** in place (it already owns `demo-stand.ts:28`),
    with the fix widened: absolutizing the override does not close this — the helper must refuse a dirty
    resolved checkout, or require `ODD_PLATFORM_DIR` with no shared-tree default.
  **Confirmation re-run of the whole lane on the same image: 17 passed / 2 failed (17.4m)** — and it closes
  the question. **BOTH IT-153 cases that failed in run 1 (`:388`, `:413`) are GREEN**, retiring them as the
  flake and the network event they were diagnosed as. `demo-stand-first-run:203` reproduced (the harness
  cause above). The one new red is `notifications-wal-lifecycle:63` (IT-011), which failed on
  **`Command failed: docker compose -p oddnotif … up -d`** — its own stack never came up; not an assertion,
  and IT-011's stack is the documented-flaky WAL stand (PLT-139). So this lane shows the same signature as
  `feature-complete`: the off-baseline reds MOVE between runs of identical code, while the only constant
  traces to the harness reading an uncommitted file. None of the four specs involved across the two runs
  exercises a line this diff changes, and the implementer's own run on identical code was 19/19.
  VERIFIED via `git -C ../odd-platform diff docker/demo.yaml` + `demo-stand.ts:28` + the two lane runs.
- **Unit bucket** — CI ran the identical full build at the identical head SHA and passed it: **795 tests, 0
  failed, 183 suites, 826 runs** at `5751a8cb`, with checkstyle in the same `build` task; the coverage bot
  reports **Files changed 100%** (`SavedSearchServiceImpl.java` 99.52%, `JSONSerDeUtils.java` 70.91%
  file-level — its two new lines covered), so the 98% changed-lines gate is MET at the head. Per the protocol
  a CI full-suite run on the same head SHA is citable evidence of the same measurement; I verified it myself
  through the API rather than trusting the ledger, and did not run a duplicate local build.
- **Front end** (CI does not run it, so the reviewer must): **`tsc --noEmit` clean** and
  **`vitest src/lib/search` 48/48** — my own runs, on the reviewed tree. The two reds in the implementer's
  full-FE run are change-independent **by import graph**, checked: neither `DataSourceItem.test.tsx` nor
  `DataEntitiesUsageInfoView.test.tsx` imports anything under `lib/search` or `SavedSearches/`.
- **i18n** — N/A, verified mechanically: the FE diff adds **zero** `t(` calls, so no catalog key is owed.

### IT-155 — the item's own gate, which no regression lane runs

IT-155 is parked in `pending-merge`, so it executed in **neither** the implementer's regressions nor mine — if
the reviewer does not run it, it goes unconfirmed. I ran it: **4 / 4 PASS in 1.1m** on my own SUT
(`ODD_STREAM=revctrib065it ODD_PLATFORM_IMAGE=odd-platform:odd-team-sut-revctrib065 run-suite.sh IT-155`) —
the Favorites scope survives save → reapply with the un-starred foil excluded, the Asset-type narrowing
survives, the copied share link carries both, and the pre-#1878 row reapplies unchanged. The whole spec took
1.1 minutes on a quiet box, against 8-50s **per case** under load in the implementer's five runs — which
independently supports their account that the moving reds were contention, not code.

### Live API verification — the §3 capture re-run against the fix, plus the cases only raw jsonb can reach

On a bare stack of the same image (`docker compose … up`, `/actuator/health` UP), all measured by me:

| stored spec | read back through the API |
|---|---|
| the §3 payload via `POST` (favorites + asset_kinds) | `201` whose spec carries **`"asset_kinds":["TERM"]` and `"favorites":true`**, and the LIST read-back carries both — the same payload on `main@96d77668` returned a `201` with **neither** key |
| no `favorites` sent | `favorites=null`, `asset_kinds=null` — **never `false`** |
| `favorites:false` | `false` **preserved** (a real filter, not normalised away) |
| raw jsonb `{"query":"survives","asset_kinds":["BOGUS",7,"TERM"],"favorites":"yes"}` | `query='survives'` **survives**, `asset_kinds=['TERM']` (unknown token *and* non-string element dropped), `favorites=null` — **R6-BE proven on real stored data** |
| raw jsonb `{"query":"orders","filters":{}}` (pre-#1878) | `query='orders'`, both `null` — **R5** |
| raw jsonb `["not-an-object"]` | empty spec, no 500 — and the LIST still answered `200` with all six rows |

The last three rows are the ones that matter to an operator: a stale kind token costs one filter, not the
saved search, and not the whole list request.

### Navigation

Consistent. `navigation/domains/search.md:42-45` and `:49` already carry every pointer this slice touches —
`searchUrlState.ts`, the SavedSearch controller/service/repository trio, the `SavedSearches/` component
directory, and `V0_0_97__create_saved_search.sql` — and no file moved or was renamed, so nothing went stale.
No new bean factory or SDK builder was introduced. VERIFIED via read.

### Doc-product editorial audit (`playbooks/doc-product-editorial-read.md`)

- **Coverage this run**: `data-lineage/**`, `data-quality/**`, `data-glossary/**` (the partition PROGRESS.md
  queued) **plus** `developer-guides/api-reference/**` (not previously claimed). Queued next:
  `configuration-and-deployment/**` and `integrations/**`.
- **Findings**:
  - **DOC-526** (medium, cross-audience absence, `milestone: "1.0.0"`) — the API Reference has a per-feature
    page for all ten smaller feature areas and **none for Search**, while 1.0.0 ships
    `POST /api/search/assets` plus the saved-search CRUD (whose contract *this slice widens*) with no
    developer-audience page at all. Source: `docs/developer-guides/api-reference.md:11-20`.
  - Not re-filed (LSN-009): `data-lineage/microservices.md:52` still tells API callers an omitted
    `lineage_depth` returns HTTP 500 — contradicting `data-objects.md:45` and the api-reference on the same
    site, and false since 0.29.0 (`openapi.yaml` carries `default: 1` on both per-entity operations, which I
    read). Independently re-derived here; **DOC-515** already owns it. Convergent validation.
  - **TST-066 extended in place** (not a new item — it already owns `demo-stand.ts:28`): a SECOND, measured
    failure mode of the same line — with `ODD_PLATFORM_DIR` **unset** (the `run-suite.sh` path) the demo stand
    composes the shared, possibly-dirty `../odd-platform` checkout. It cost this review a reproducing false
    RED; the next reviewer would have paid the same A/B budget to disprove it.

### Notes

- The ledger's "CI `run_tests` 794 tests" at the head is off by one — CI reports **795** at `5751a8cb` (794 was
  the count at `51f324a6`, before `e7bc3b0e` added a test). Cosmetic; the direction (green) is right.
  NOT VERIFIED as a defect → recorded, not filed.
- IT-155 case 2 asserts the reapply URL, the Term's presence and the data entity's absence, but not the
  Asset-type **control's** state, where case 1 does assert the Favorites checkbox. URL→control is ST-4's
  contract and pinned by `search-url-facets` / `search-url-state`, so this is an observation, not a gap.
- `PLT-265` (the Saved-searches menu staying open after reapply, hiding the reapplied page from assistive
  tech) was correctly out of this slice's class and correctly logged rather than narrated. **FOLDED INTO THE
  PR on the maintainer's instruction, 2026-09-04 — see §14.**
- Review side effects: none committed beyond this verdict + `state/PROGRESS.md` + `backlog/docs/DOC-526.md`.
  `lineage/**` untouched (`git status --short lineage/` empty); the `api:FAIL` on `feature-complete` is
  TST-065's pre-existing probe-rail build failure, not a run of mine.

### For GATE 2 — what you are merging, in plain language

A saved search used to be a promise the product did not keep: save a search with **Favorites** on, or with
**Asset type** set, and the dialog said "saved" while the row stored a *different* search. Reopening it gave
you the whole catalog with the toggle off, and the copied link handed a colleague the wrong search too. This
makes the saved row hold the same object the search request already sends — so what you save is what comes
back, including through a shared link, and a search saved before the fix reopens exactly as it did.

Three things worth knowing before you merge:

1. **It is additive.** The stored `spec` widens to a superset: old rows stay valid, no migration, no client
   breaks. The one thing that could have bitten — a stored asset-kind token a future release renames — is
   handled at field grain: you lose that one filter, not the whole saved search. I proved that on a real
   stored row, not from the code.
2. **The next dimension cannot repeat this.** `asset_kinds` (ST-4) and `favorites` (ST-7) both shipped
   unsaveable because nothing asserted the round-trip. There is now a test that fails at **compile** time if
   someone adds a URL dimension without saved-search support, and at runtime if the wire grows a key.
3. **Docs are owed, not written here** — deliberately, and tracked. No page on the site describes saved
   searches at all (I re-grepped the 1.0.0 train to be sure), so this fix falsifies nothing published; the
   1.0.0 doc gate now cannot publish the saved-searches section without stating that a saved search stores the
   complete search (`DOC-499`).

**Status**: stays `review-ready` — the human GATE-2 merge owns the move to `pending-release`, and
`/review release:1.0.0` owns `done` (precedent: review-ctrib062-3 / review-ctrib048).

## 14. PLT-265 folded in on the maintainer's instruction (2026-09-04, `510a29b9`)

The maintainer asked for `PLT-265` to ship with this PR rather than be queued. Done, and the draft's own
"Suggested fix" turned out to be wrong on two counts — reading the component before typing caught both.

**What the draft said vs what is true.** It claimed *"the `AppPopover` exposes its close handler to the
trigger"*, so the fix would be one line in `handleReapply`. It does not: `AppPopover` holds `anchorEl` in
local state and passes only `onClick` out through `renderOpenBtn`, so **no child could close it at all** and
the one-line fix was unreachable. It also proposed closing after delete — **rejected on product grounds**:
delete mutates the list in place, the user watches the row go and may remove several, so taking the surface
away mid-task is wrong. Only **reapply** closes, because it alone changes the page *underneath* the menu.

**The change is a class fix, not an instance patch.** Every `AppPopover` consumer whose item acts in place
has this defect; the other three (Term details, Dataset-field header, Query-example details kebabs) merely
hide it behind the dialog their items open. So `children` may now be a **render prop** receiving the
popover's own `onClose` — mirroring the `renderOpenBtn` idiom directly above it rather than inventing a
second one. Opt-in and backward compatible: a plain node still works, and `tsc --noEmit` over the whole FE is
clean with the three other call sites untouched.

**Tests, both buckets, RED-proved.**
- `AppPopover.test.tsx` (new, 3 cases): the render prop can close; a plain node still renders; and the
  popover does **not** close unless the child asks, so closing stays opt-in. **RED on the unfixed component**
  — verified by reverting `AppPopover.tsx` to base and re-running: React warns *"Functions are not valid as a
  React child"*, both render-prop cases fail, and the plain-node case passes on **both** versions, exactly as
  a backward-compatibility pin should.
- `IT-155`: the `reapply()` helper's `Escape` press existed **only** as a workaround for this bug. It is
  removed and replaced by an assertion that the clicked entry disappears — so the absence of the workaround
  is itself the guard: if the close regresses, every role query on the reapplied page goes blind again and
  the cases fail as they did before. The protocol's Run-protocol steps and PASS list are updated in step.

**G-C15 on the changed test**: the IT-155 edit makes the spec strictly STRONGER (a workaround removed, an
assertion added), which is the opposite of the weakening the gate guards against. It cannot mask the #1878
behaviour either: on `ref:main` cases 1-3 fail on VALUES before the popover is ever reached.

**Gates re-run for the fold-in**: `tsc --noEmit` clean · eslint clean on both changed paths · the FULL FE
unit suite **194 / 195** (up from 192 tests to 195 — the three new cases), the single red being
`DataSourceItem.test.tsx`'s 5-second bound under load, which I proved change-independent twice over: it does
**not** import `AppPopover` at all (`grep`), and it passes **2/2 in isolation** in 2.06s. No new visible
string, so no i18n change.

**IT-155 on both systems, the same (post-fold-in) spec — the G-C15 discharge for the changed helper:**

| SUT | result |
|---|---|
| `510a29b9` (with PLT-265), image `sha256:6b64f1c9` | **4 / 4 PASS (58.3s)** — the menu closes itself, so the four cases pass with no dismissal step at all |
| `5751a8cb` (the #1878 fix WITHOUT PLT-265), image `sha256:5dab59ed` | **3 failed / 1 passed (2.0m)** — and RED **on a value, not a timeout**: `the Saved-searches menu closes itself on reapply (PLT-265) — expect(locator).toHaveCount failed, Expected: 0, Received: 2` |

**Case 3 passing on the unfixed SUT is the discriminator, not an anomaly**: it clicks *Copy link* inside the
menu and never calls `reapply()`, so the menu correctly stays open for it. Exactly the three cases that
reapply fail; the one that does not, passes. A changed test that goes red on the old system for the right
reason, and green on the new one, is the whole of G-C15.

**Full four-suite regression on a SUT rebuilt from the clean committed `510a29b9`** — required because
`AppPopover` is shared by four call sites (the SavedSearches menu plus the Term-details,
Dataset-field-header and Query-example-details kebabs), so the blast radius is wider than the one screen.

- **`feature-complete` 335 / 12 of 347 (35.1m)** — the twelve are **EXACTLY the tracked baseline, SET-EQUAL by
  exact `spec:line`, with ZERO off-baseline reds**. The cleanest run of this suite across all four samples of
  this branch (implementer #1 331/16, #2 329/18, reviewer's first 331/16), the difference being a quiet box —
  which is itself the TST-057 thesis, now demonstrated rather than argued. None of the three other
  `AppPopover` call sites regressed.
- **`multi-stack` 19 / 19 — a CLEAN SWEEP, and the controlled experiment that PROVES the TST-066 finding.**
  `demo-stand-first-run:203` failed twice earlier today when I ran this lane through `run-suite.sh` *without*
  `ODD_PLATFORM_DIR`, which made `demo-stand.ts:28` compose the shared `../odd-platform` checkout and its
  uncommitted `AUTH_TYPE=LOGIN_FORM` demo.yaml. Here the same lane, same box, same image content, run through
  `run-regression.sh` — which sets `ODD_PLATFORM_DIR` to a clean per-stream worktree — is **green**. Same code,
  opposite result, one variable. IT-153's two cases are green too, retiring them as the flake and the host
  network event they were diagnosed as.
- **`known-bugs` 3 red** = the expected quarantine, no unexpected GREEN. **`ingestion-e2e` 15 / 15** clean.

**Upstream CI at `510a29b9`: all six check-runs GREEN** (verified through the API, not the PR page). Pushed to
`contrib/CTRIB-065-saved-search-holds-every-dimension` (`5751a8cb..510a29b9`), so PR #1879 carries the
fold-in.

**PR marked READY FOR REVIEW 2026-09-05** on the maintainer's instruction (GraphQL
`markPullRequestReadyForReview`; `draft: false` confirmed by re-reading the PR). Undrafting is the DoD's own
gate — *"the PR stays `draft` until all five are checked as actually-run"* — so all five were re-verified at
the head `510a29b9`, not carried over from `5751a8cb`: (1) unit — CI's identical build green, 795 tests / 0
failed / 183 suites; (2) the FULL four-suite integration regression, mine, recorded above; (3) docs read +
decided + routed (none owed — the surface is undocumented and `DOC-499` carries the obligation; PLT-265 is a
UI affordance on that same undocumented surface); (4) ontology — no sidecar exists for any touched file
(`AppPopover` has a substrate node but no `understanding/` entry), so `/enrich --touched` has nothing to
refresh; (5) G-C13 — both buckets present and both RED-proved, changed-lines coverage **100 %** at this head,
and the **G-C12 step-5 pixel review DONE**: I re-ran IT-155 to regenerate
`test-results/it155-reapplied-favorites.png` and looked at it — the menu is gone, the results are unobscured,
the **Favorites (shared) only** checkbox is checked, and the single result `it155_tbl` carries a filled star
while the un-starred foil is absent. The PR body was extended with the fold-in so a human reviewer sees both
changes. **The bot still never MERGES (G-C4)** — GATE 2 remains the maintainer's.

**Note for the next `/review`**: this fold-in was authored in the review session, on the maintainer's
instruction and under their GATE-2 ownership. The separate-session rule therefore binds the NEXT review of
these commits, which must be fresh.
