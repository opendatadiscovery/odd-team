---
id: CTRIB-065
title: "#1878 — saved searches hold every URL-only search dimension (asset_kinds + favorites): one canonical spec, two surfaces"
github_issue: 1878
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1878
target_repo: odd-platform
milestone: "1.0.0"
status: planned            # GATE 1 pending — no code, no branch, no push until a human approves §7
classification: bug        # a contract gap (the persisted representation cannot hold two shipped dimensions); the correct behaviour has ONE right answer, the fix has two defensible shapes (§7 D1)
parent: "CTRIB-061 (ST-7 / #1841 / PR #1875) — the slice that ADDED the second instance of this class and deferred it; retrospectives/LSN-042 — this record is the class-extension clause applied (G-C5)"
stream_id: ctrib065
base_sha: 96d77668         # origin/main = the #1875 squash; every line cited below was read at this SHA
branch: ""                 # contrib/CTRIB-065-saved-search-holds-every-dimension — created AFTER GATE 1 (same-name-tracked, never origin/main-tracked; O6/LSN-038)
head_sha: ""
pr: ""
reproduced: "2026-09-03 22:08 +02:00 — POST /api/saved_searches on main@96d77668 (isolated stack ctrib061 @ :18100, image odd-platform:odd-team-sut-ctrib061, digest sha256:46d9ae04…): spec sent with favorites=true + asset_kinds=[TERM] + sort=name + my_data=[MY_OBJECTS] -> 201 whose stored spec carries sort + my_data and NEITHER favorites NOR asset_kinds (the keys are absent, not null); GET list identical; probe row deleted (204). Full capture §3."
adr_required: false        # conforms to adrs/drafts/unified-asset-search.md D10/D11 — REALISES D11's invariant ("one canonical spec, two surfaces") which ST-4 + ST-7 had broken; no new decision (§6b)
plan_approved_by: ""
plan_approved_at: ""
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

### GATE-1 decision (plain language)

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

## 9. Ontology nodes to refresh (Phase D)

`SavedSearchServiceImpl`, `searchUrlState` (lib), `SavedSearchForm`, `SavedSearches`, and `AssetSearchFormData`'s
sidecar (it is now also the persisted spec). **There is no saved-search feature-flow node** (ST-3 never added one;
`lineage/odd-platform/feature-flows/detail/` resolves only `F-017-UC-08`, the pre-ST-3 `/search/{uuid}` drift
promise, and `test-gates.yaml` resolves neither a saved-search id nor IT-148's `validates: [F-Favorites]`) — so
Phase D **creates** the saved-search feature node + its `use_cases` (the promise "a saved search reproduces the
saved search" verified by T1-T5), re-points IT-155's and IT-148's `validates:` at ids the ledger resolves, and
re-embeds. Run
`/enrich --touched` only when `lineage/**` is clean and unclaimed; re-embed; commit.

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

## 11. Test ledger

_(Phase D — every row RUN, none "deferred to review")_

## 12. Comments (issue-thread URLs)

- none yet (see §7 "Docs, ontology, comments").
