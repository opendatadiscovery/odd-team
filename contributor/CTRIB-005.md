---
id: CTRIB-005
github_issue_number: 1760
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1760
class: bug
milestone: "0.28.0"
status: review-ready
reproduced: "live 2026-06-11 on local odd-minimal, SUT=working tree @ 026fd3fa (= clean main; image odd-platform:odd-team-sut sha256:9802b3e3cf52, rebuilt by run-suite). API: facets/results/facet-TAGS of a missing session all 404 USR002; the issue's literal URL /filters/entityClasses 500 SYS001 (server log: NoResourceFoundException 404 'No static resource…' swallowed by the catch-all); facet/entityClasses 500 SYS001 (ServerWebInputException 400 'Type mismatch' swallowed — the #1761 class). UI (Playwright traces /tmp + run-log/2026-06-11-IT-125.md): /search/{missing} AND /search/{valid} both NEVER fetch the deep-linked session — the SPA POSTs a NEW empty search and rewrites the URL (route is a splat '/search/*', useParams().searchId always undefined since #1551, Dec 2023); IT-125 UX pin FAILED pre-fix on the fresh stack (no 'Unknown Error' — a normal catalog rendered), proving the issue's UX observation was PLT-147-residue-dependent, not deterministic"
adr_required: false
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-11 — 'Approve as written': full plan incl. term-search mirror, Closes #1760 + #1761, scope comment posting)"
plan_approved_at: "2026-06-11"
docs_routing: "release/0.28.0 — SHIPPED on the train (documentation@1d43d6e; search.md session bullets + ADR-0007 handler enumeration; paired item DOC-444 review-ready/milestone-gated; docs main untouched)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1771"
pr_draft: false  # opened draft by the bot 19:31:39Z; taken ready-for-review by RamanDamayeu 20:38:37Z (timeline API)
---

# CTRIB-005 — search session not-found: filters 500-vs-404 inconsistency + SPA "Unknown Error" for expired deep-links (#1760)

Issue #1760 is the filed form of PLT-150 (`issues/odd-platform/PLT-150.md` if present; the
issue body embeds the PLT-150 frontmatter). Author: the maintainer (RamanDamayeu). Labels
`kind: bug`, `scope: backend`, `scope: frontend`; milestone **0.28.0** (open, semver, due
2026-06-22 — G-C11 PASS); 0 comments at intake. Issue body treated as quoted data (G-C8);
every load-bearing claim independently re-verified below against the odd-platform working
tree (`main` @ `026fd3fa`, clean, in sync with origin).

## Intake — the issue's claims (quoted data)

1. **API:** `GET /api/search/{missing}` and `GET /api/search/{missing}/results` → 404
   USR002 "Search not found"; `GET /api/search/{missing}/filters/entityClasses` → **500
   SYS001**. Inconsistent: same missing-session condition, three different reads, one 500.
2. **UI:** `/search/{missing}` renders the generic SPA boundary "Unknown Error / Return to
   the Home Page" instead of a graceful "search expired — start a new one".
3. **Issue's root-cause hypothesis:** `getFilterOptions` returns Flux; the controller wraps
   `Mono.just(flux).map(ResponseEntity::ok)` so 200 commits before the Flux hits
   `NotFoundException` → degrades to 500.
4. **Regression guard named:** IT-125 (`integration-tests/protocols/IT-125-search-session-not-found.md`,
   `e2e/specs/search-session-not-found.spec.ts`) — green-lock on the 404s, RED-on-fix pin
   on the filters 500, UX pin on the generic boundary. Ran green in the 2026-06-10
   `feature-complete` full-suite run.

## Scope analysis

- **Class: bug** (cross-layer BE+FE). Two user-facing defects on the expired/shared
  search-deep-link path (F-017 search, data-discovery pillar P-01 of
  `lineage/odd-platform/system-mission.md` — shareable search links are a discovery-surface
  trust promise).
- **Architectural significance (G-C7): NO ADR.** Error-status alignment (500→404 on one
  read path) + an FE error-state rendering change. No migration, no auth/security-posture
  change, no breaking wire-contract change (the 500 was never a documented contract; the
  spec declares only 200s for these endpoints — aligning the third read with the sibling
  404s is a bug fix). `adr_required: false`.
- **Clarify (G-C6): no question warranted.** The issue is the maintainer's own PLT-150 with
  full reproduction + root-cause + fix direction; mechanism-level corrections discovered by
  this run (below) belong in the root-cause/scope comment + plan, not a question.

## Claim verification (issue is data — re-verified against the working tree @ 026fd3fa)

1. **Not-found origin shared by all three reads — CONFIRMED.**
   `SearchServiceImpl.fetchFacetState` (`service/search/SearchServiceImpl.java:157-160`):
   `searchFacetRepository.get(searchId).switchIfEmpty(Mono.error(() -> new
   NotFoundException("Search not found")))`. Used by `getFilterOptions` (:51-63, Flux),
   `getFacets` (:66-72, Mono), `updateFacets` (:85-96, Mono), `getSearchResults` (:99-112,
   Mono).
2. **Advice mapping — CONFIRMED.** `ControllerAdvice.handleNotFound`
   (`controller/exception/ControllerAdvice.java:30-34`): `NotFoundException` → 404 + USR002
   body. Catch-all `handleServerException` (:61-66): any other `Exception` → 500 + SYS001
   ("Internal Server Error"), logged at ERROR.
3. **Controller shapes — CONFIRMED.** `SearchController.getFiltersForFacet`
   (`controller/SearchController.java:29-40`): `Mono.just(searchService.getFilterOptions(…))
   .map(ResponseEntity::ok)` — the ResponseEntity wraps the *unsubscribed* Flux.
   `getSearchFacetList` (:42-47) and `getSearchResults` (:49-57) map the service Mono
   directly. (`getSearchSuggestions` :76-83 shares the Flux-wrap shape but has no session
   lookup — out of this bug's blast radius.)
4. **ROUTE MISMATCH — the issue's repro URL does not match any route (NEW FINDING).**
   The real filters route is **`/api/search/{search_id}/facet/{facet_type}`**
   (`odd-platform-specification/openapi.yaml:702-733`, operationId `getFiltersForFacet`;
   the generated FE client confirms: `generated-sources/apis/SearchApi.ts:124`). Valid
   `facet_type` values are the `MultipleFacetType` enum: TAGS/OWNERS/TYPES/GROUPS/STATUSES
   (`SearchServiceImpl.getFacetFetchOperation:162-175`); `entityClasses` is not one (the
   entity-class facet rides `SearchFacetsData`, not this endpoint). So
   `GET /api/search/{id}/filters/entityClasses` matches **no route**. Working hypothesis
   for its observed 500 SYS001: WebFlux raises `ResponseStatusException(404 NOT_FOUND)` for
   an unmatched route; Spring 6 routes it through `@ControllerAdvice`; it is not
   `NotFoundException`, so it falls to the catch-all → re-branded **500 SYS001**. That is
   the **PLT-143 family** (issue #1761: `ServerWebInputException` swallowed the same way) —
   but #1761's proposed fix (a `ServerWebInputException` handler) would NOT cover plain
   `ResponseStatusException`. LIVE VERIFICATION REQUIRED (Phase B): both the phantom URL
   and the REAL route `GET /api/search/{missing}/facet/TAGS?page=1&size=30`.
5. **The real-route 500-vs-404 outcome is statically undecidable — LIVE TEST REQUIRED.**
   The issue's "200 commits before the Flux is subscribed" is plausible but not certain:
   Spring 6's Jackson JSON encoding of a Flux body defers writing the JSON array prefix
   until the first signal (onNext vs onError) precisely so a pre-first-element error leaves
   the response uncommitted and error handling can still rewrite the status. Whether the
   ODD stack actually yields 404 or 500 on `facet/TAGS` for a missing session must be
   measured on the running system (LSN-031).
6. **FE error-state class defect — CONFIRMED (explains "Unknown Error" everywhere).**
   The generated client throws `ResponseError` wrapping the Response
   (`generated-sources/runtime.ts:140,260`). `handleResponseAsyncThunk`
   (`redux/lib/handleResponseThunk.ts:34-41`) passes the **ResponseError itself** to
   `getErrorResponse(err as Response)` (`lib/errorHandling.tsx:12-26`), which reads
   `.status/.statusText/.url` off it → **all `undefined`** (they live at `err.response.*`);
   `response.clone()` throws → caught → body `{}` → message `'An error occurred'`. So every
   rejected thunk stores `ErrorState{status: undefined, statusText: undefined}` and
   `AppErrorPage` (`shared/elements/AppErrorPage/AppErrorPage.tsx:24-32`) renders an empty
   status + `statusText ?? t('Unknown Error')` → **"Unknown Error"**, regardless of the
   actual HTTP status. Same bug silences `showServerErrorToast` (`errorHandling.tsx:48-68`:
   `response.json` is not a function → caught; `if (response.status)` → undefined → no
   toast). The FE literally cannot distinguish 404 today.
7. **FE which-surface-renders puzzle — LIVE TRACE REQUIRED.** `/search/{missing}`:
   `Search.tsx:44-48` dispatches `getDataEntitiesSearch` (facets) → rejects. But the
   `AppErrorPage` on the search screen is driven by the RESULTS thunk
   (`Results.tsx:168-172`: `showError={isSearchResultsNotLoaded}` +
   `error={searchResultsError}`, both keyed to `fetchDataEntitySearchResults` —
   `dataentitySearch.selectors.ts:44-58`; `isNotLoaded` ⇔ status `rejected` —
   `loader-selectors.ts:12-22`). Statically the results fetch is gated on redux `searchId`
   (`Results.tsx:76-81`), which is only set by a *fulfilled* facets/search response
   (initial `''` — `dataEntitySearch.slice.ts:22-23`), so it should never fire and the
   boundary should not render — yet IT-125's UX pin PASSED seeing "Unknown Error". The
   live DOM + network trace must resolve which thunk rejects and which selector path
   renders the boundary before the FE fix is designed.

## Reproduction (G-C1) — captured live 2026-06-11

Stack: odd-minimal (`AUTH_TYPE=DISABLED`), image `odd-platform:odd-team-sut` built from the
odd-platform WORKING TREE @ `026fd3fa` (clean = the same bits as `ref:main`, pre-fix).
Curl probes ran against the long-lived stack (image `sha256:9802b3e3cf52`, built 17:01Z from
the same clean tree); the `run-suite.sh IT-125` run then recreated the stack fresh.

### API probes (curl, verbatim)

```
GET /api/search/ffffffff-1125-4125-8125-ffffffffffff
  -> 404 {"code":"USR002","message":"Search not found",...}                       CORRECT
GET /api/search/ffffffff-…/results?page=1&size=30
  -> 404 {"code":"USR002","message":"Search not found",...}                       CORRECT
GET /api/search/ffffffff-…/facet/TAGS?page=1&size=30          (the REAL filters route)
  -> 404 {"code":"USR002","message":"Search not found",...}                       CORRECT
GET /api/search/ffffffff-…/filters/entityClasses              (the issue's URL — no such route)
  -> 500 {"code":"SYS001","message":"Internal Server Error",...}                  BUG
GET /api/search/ffffffff-…/facet/entityClasses?page=1&size=30 (real route, invalid enum)
  -> 500 {"code":"SYS001","message":"Internal Server Error",...}                  BUG (#1761 class)
```

Server log for the two 500s (mechanism proof):

```
ERROR … ControllerAdvice : Internal server error
org.springframework.web.reactive.resource.NoResourceFoundException: 404 NOT_FOUND
  "No static resource api/search/ffffffff-…/filters/entityClasses."
ERROR … ControllerAdvice : Internal server error
org.springframework.web.server.ServerWebInputException: 400 BAD_REQUEST "Type mismatch."
```

Both are `ResponseStatusException` subclasses carrying their correct 4xx status; the
catch-all `@ExceptionHandler(Exception.class)` re-brands them **500 SYS001** + ERROR log.

### UI traces (Playwright, headless chromium)

- `/search/{missing}`: the SPA **never requests the deep-linked id**. Network: boot calls →
  `POST /api/search` (creates a NEW empty session) → `GET /api/search/{NEW-id}/results`.
- `/search/{VALID-id}` (a live session created via curl seconds earlier): **identical** —
  the valid session is never fetched; a new session is created; the URL is rewritten to
  `/search/{NEW-id}`. Deep-link/bookmark/share/F5 restore is **dead at the routing layer**.
- The issue's "Unknown Error" observation: on the long-lived stack the NEW session's
  results read 500'd via the **PLT-147 NPE** (`DataEntityMapperImpl.mapPojo:99`,
  `getDataTransformerDetailsDto()` null — poisoned row `20682 it068xfmpin_transformer`
  seeded by IT-068, empty `specific_attributes`) → results thunk rejected →
  `Results.tsx:168` AppErrorPage → "Unknown Error". **Residue-dependent, not
  deterministic.**

### Pinned reproduction — `run-suite.sh IT-125` (fresh stack, pre-fix)

```
2 passed:  facets+results 404 green-lock ✓;  phantom /filters/ URL 500 pin ✓
1 FAILED:  UX pin — getByText(/Unknown Error/i) NOT found; the page rendered a NORMAL
           catalog (Filters/tabs/results shell)        → run-log/2026-06-11-IT-125.md (e2e:FAIL)
```

The UX pin's failure on the unfixed system is itself evidence: "Unknown Error" only ever
appeared when stack residue poisoned the *replacement* search; on a fresh stack the SPA
silently swallows the deep-link and shows a fresh catalog — the user's link state is lost
with **no signal at all** (arguably worse than an error page).

## Root cause (verified on the running system + source)

Three distinct defects produce the issue's two observations:

1. **[BE] The ControllerAdvice catch-all swallows framework `ResponseStatusException`s.**
   `ControllerAdvice.java:61-66` (`@ExceptionHandler(Exception.class)` → 500 SYS001 +
   ERROR log) has no `ResponseStatusException` pass-through, so every framework-raised
   4xx — unmatched route (`NoResourceFoundException` 404), invalid path/query binding
   (`ServerWebInputException` 400, = #1761), method-not-allowed (405), unsupported media
   (415) — is re-branded **500 SYS001** platform-wide. The issue's "filters 500" is the
   unmatched-route instance (its URL `/filters/entityClasses` matches no route; the real
   route `facet/{facetType}` already 404s correctly via the Mono-path NotFoundException —
   the issue's Flux-commit theory is falsified by the live 404 on `facet/TAGS`).
2. **[FE] The search deep-link param was never wired after the router refactoring.**
   `App.tsx:61` mounts `<Route path='/search/*'>` (splat) while `useSearchRouteParams()`
   reads `params.searchId` (`searchRoutes.ts:18-19`) — always `undefined` under a splat →
   `Search.tsx:37-42` effect 1 (`!routerSearchId`) silently creates a new empty search for
   EVERY cold navigation to `/search/{id}`. Introduced by `4572bba1` ("chore: fe router
   refactoring (#1551)", 2023-12-06). Same class on the sibling surface: `/termsearch/*` +
   `useTermsRouteParams().termSearchId` (`App.tsx:63`, `termsRoutes.ts:54-62`,
   `TermSearch.tsx:26,34-43`).
3. **[FE] The error state never carries the HTTP status** (why everything says "Unknown
   Error"): the generated client throws `ResponseError` wrapping the Response
   (`generated-sources/runtime.ts:140,260`); `handleResponseAsyncThunk.ts:34-41` passes the
   wrapper to `getErrorResponse(err as Response)` (`lib/errorHandling.tsx:12-26`) → `status/
   statusText/url` undefined, message `'An error occurred'`; `showServerErrorToast` (:48-68)
   is silenced the same way (`response.json` not a function; `if (response.status)` falsy).
   The SPA cannot distinguish a 404 from anything — pre-condition for the issue's asked-for
   graceful expired state.

Adjacent (tracked, NOT in scope): **PLT-147 / #1755** — the mapper NPE that turned the
silently-created replacement search into "Unknown Error" on the long-lived stack (live
confirmation this run: stack trace + poisoned row 20682). **PLT-138/PLT-127** — session
lifecycle semantics, untouched per the issue's own "keep separate loci".

## Comments (issue thread)

- Clarify comment: **none warranted** (G-C6) — the issue is fully specified; the
  mechanism corrections are findings, not questions.
- **Root-cause + scope comment: REQUIRED, ONE comment** (G-C5 + github-write rate-limit:
  fold both). The plan reframes the issue's mechanism (Flux-commit theory falsified; real
  causes: advice catch-all + splat route + error-unwrap) and widens-by-class on the route
  fix (term-search sibling) while excluding PLT-147/#1755 — the public thread must carry
  that. Drafted below; **GATE 1 approval = approval to post it**, immediately after
  approval, before any code.
- **POSTED 2026-06-11 (post-GATE-1, pre-code):**
  https://github.com/opendatadiscovery/odd-platform/issues/1760#issuecomment-4683383984
  (author `odd-contributor[bot]`, status 201; ASCII-verified).
- A short cross-link comment on **#1761** (closed by the same advice fix) — posts with the
  draft PR (Phase E), not at GATE 1.
- **POSTED 2026-06-11 (with the draft PR):**
  https://github.com/opendatadiscovery/odd-platform/issues/1761#issuecomment-4684224104
  (author `odd-contributor[bot]`; names the unit pin + the e2e sibling surfaces).

## Branch / PR

- Branch `contrib/CTRIB-005-search-session-not-found` pushed to
  `opendatadiscovery/odd-platform` (commit `074c9927`, authored + committed
  `odd-contributor[bot]`; 18 files, +305/−17 — BE advice + test pins, FE routes/expired
  state/error unwrap, 6 locale files, exactly the approved plan).
- Draft PR: **#1771** — https://github.com/opendatadiscovery/odd-platform/pull/1771
  (`draft: true`, `Closes #1760` + `Closes #1761`, `Milestone: 0.28.0` line, docs note
  `documentation@release/0.28.0 (1d43d6e) — publishes with the 0.28.0 release`; review
  requested from `RamanDamayeu`; the bot cannot merge — GATE 2 is the human's). Both
  issues' milestones re-verified `0.28.0` open at PR time (G-C11).
- Scope/root-cause comment on #1760 (GATE-1-approved, posted pre-code):
  https://github.com/opendatadiscovery/odd-platform/issues/1760#issuecomment-4683383984
- Docs train: documentation@`release/0.28.0` commit `1d43d6e` (pushed same-name); paired
  item `backlog/docs/DOC-444.md`.
- Workspace batch: odd-team commit `93c5412`.

## Plan

**Branch:** `contrib/CTRIB-005-search-session-not-found` on `opendatadiscovery/odd-platform`.

### Change A — backend (1 file + 1 test-pin extension)

**`controller/exception/ControllerAdvice.java`** — add ONE handler (ADR-0007's prescribed
extension mechanism: "adding a new exception type means adding one handler there"):

```java
@ExceptionHandler(ResponseStatusException.class)
public ResponseEntity<ErrorResponse> handleResponseStatus(final ResponseStatusException e)
```
- passes the embedded status through: `ResponseEntity.status(e.getStatusCode())`;
- body: 404 → `ErrorCode.NOT_FOUND` (USR002), other 4xx → `ErrorCode.BAD_REQUEST` (USR001),
  5xx → `ErrorCode.SERVER_EXCEPTION` (SYS001); message = `e.getReason()` when present;
- logs 4xx at WARN (no stack trace), 5xx at ERROR — ends the false "Internal server error"
  ERROR-log noise for routine client mistakes.
- More-specific handlers still win (Spring picks the closest type): the existing
  `WebExchangeBindException` field-error mapping is untouched; ODD's own exceptions
  (`NotFoundException` etc.) don't extend RSE and keep their handlers.
- Blast radius: grep-verified NO platform code throws `ResponseStatusException` — only
  framework-raised statuses change, every one of them from a wrong 500 to its correct 4xx.
  Fixes #1760's observed 500 (unmatched route → 404) AND #1761 (missing/mistyped
  param → 400 USR001 with the framework's reason text).

**`config/AdrControllerAdviceMappingScanTest.java`** — extend the ADR-0007 pin: the
handler-count floor 6→7 and `.contains("@ExceptionHandler(ResponseStatusException.class)")`.

### Change B — frontend (the issue's UI half)

1. **Route params restored** (the splat bug, #1551 regression) — `components/App.tsx`:
   ```tsx
   <Route path={searchPath()}>
     <Route index element={<Search />} />
     <Route path=':searchId' element={<Search />} />
   </Route>
   <Route path={termsSearchPath()}>
     <Route index element={<TermSearch />} />
     <Route path=':termSearchId' element={<TermSearch />} />
   </Route>
   ```
   (No deeper sub-paths exist under either — grep-verified; `ToolbarTabs` highlight uses
   `matchPath('/search/*')` on the pathname and is unaffected.) Restores: shared/bookmarked
   links, F5 state retention, expired-link detection — for both search surfaces.
2. **Error state carries the real status** — `lib/errorHandling.tsx`: `getErrorResponse` +
   `showServerErrorToast` unwrap `ResponseError` (`err.response` when `err` is not a
   `Response`). Every thunk's stored `ErrorState` gains the real `status/statusText/
   message`; `AppErrorPage` switches `statusText ?? t('Unknown Error')` → `||` (HTTP/2
   reason phrases are empty strings). Global, strictly-improving (today: always undefined).
3. **Graceful expired state** (the issue's ask) — `Search.tsx`: when the facets fetch
   (`getDataEntitiesSearch`) is rejected with `status === 404` and no session is loaded,
   render an expired-search state in place of Filters+Results: "This search link has
   expired or doesn't exist" + a **Start new search** button (reuses `useCreateSearch`,
   which creates an empty session and navigates; also resets the rejected loader status via
   `resetLoaderByAction`). Non-404 rejections render `AppErrorPage` (now with a real
   status). Mirror on `TermSearch.tsx` (same state, `createTermSearch`). New selector
   `getSearchError` (createErrorSelector on the facets action) + term twin; new i18n keys
   (EN per the #1749 pattern). Implementation detail left to /implement: a small shared
   element vs two inline blocks — whichever reads cleaner, no new abstractions beyond one
   shared component at most.

### Tests (G-C9, both buckets)

- **Unit → odd-platform CI** (failing-first on main, green on the fix):
  - `ControllerAdviceTest` (new, `@WebFluxTest`-class slice or plain handler unit): RSE(404
    no-handler) → 404+USR002; `ServerWebInputException` → 400+USR001 (the #1761 surface,
    exactly PLT-143's suggested guard: OAR list without `status` param);
    `WebExchangeBindException` still field-error 400 (more-specific precedence);
    `NotFoundException` still 404 USR002.
  - `AdrControllerAdviceMappingScanTest` extension (above).
  - FE unit: N/A-with-reason — vitest has no CI executor (CTRIB-002/003/004 precedent);
    FE behaviour is gated e2e + tsc/eslint/webpack via the SUT build.
- **Integration → odd-team, IT-125 RE-GROUNDED** (LSN-029: pins flip, never deleted;
  additionally the old UX pin was residue-dependent — it FAILED pre-fix on a fresh stack —
  so the re-ground also REMOVES a hidden inter-spec dependency on PLT-147 residue):
  1. facets+results missing-session 404 USR002 — green-lock, unchanged;
  2. real filters route `facet/TAGS` missing-session → 404 USR002 — NEW green-lock;
  3. the phantom URL `/filters/entityClasses` → **404** (was the 500 pin — flips);
  4. `facet/entityClasses` (invalid enum) → **400 USR001** (was 500 — the #1761 e2e
     surface);
  5. UI `/search/{missing}` → expired state visible; **Start new search** → URL changes to
     `/search/{new-id}` and the expired state clears (deliberately NOT asserting the
     results list — isolates from PLT-147 residue);
  6. UI `/search/{valid}` cold deep-link → `GET /api/search/{id}` IS requested and the
     session's query text is restored in the search box (the splat-fix guard;
     seed-independent — a query string needs no entities);
  7. UI `/termsearch/{valid}` cold deep-link restore — same guard for the term surface
     (extends IT-019's spec if cleaner; protocol cross-ref updated either way).
  - **RED proof:** the re-grounded spec runs against `ODD_SUT=ref:main` → must FAIL (3,4:
    still 500; 5: no expired state; 6,7: session never fetched), then GREEN on the
    working-tree SUT. Recorded in the test ledger.
  - **Full regression (the gate, 2026-06-11 directive):** `run-suite.sh feature-complete`
    green + `multi-stack` green + `known-bugs` still-RED, all on the working-tree SUT, one
    suite at a time. Note: feature-complete currently carries the IT-125 UX-pin failure on
    fresh stacks (today's run proves it) — the re-ground REMOVES that flake, so the
    post-fix feature-complete is expected strictly greener than today's baseline.
  - IT-125 protocol doc rewritten to the fixed contract (it also still cites the falsified
    "getFacets has no switchIfEmpty" theory — corrected with this change).

### Docs decision (G-C10 + G-C11) — routing: `release/0.28.0` train (to confirm at read)

To READ before authoring (Phase D): `docs/data-discovery/search.md` (does it promise
shareable/bookmarkable search URLs? the deep-link restore + expired-state behaviour is
0.28.0-new), and `docs/developer-guides/architecture-decision-log/ADR-0007-…pipeline.md`
(its handler enumeration gains the `ResponseStatusException` pass-through — released-truth
of the enumerated list changes at 0.28.0 → train). Expected outcome: small search.md
addition (share/expiry behaviour as of 0.28.0) + ADR-0007 page handler-list touch-up, both
on `release/0.28.0` with a paired `pending-release` DOC item; docs `main` untouched. If the
read shows no page claims any of the changed behaviour, record "no doc change + why" with
the page citations instead.

### Ontology refresh (G-C10)

`/enrich --touched` + re-embed, committed: `ControllerAdvice`, `SearchController` (its
sidecar likely carries the falsified Flux-commit theory — must be corrected),
`SearchServiceImpl`, FE `App.tsx`/`Search.tsx`/`TermSearch.tsx`/`errorHandling` nodes as
present in the substrate; `F-017` feature flow (use_cases: deep-link restore + graceful
expiry; the drift facet re-grounded); IT-125 protocol + suites lane check (flip-on-fix
checklist, `pillars/tests/pillar.md`); PLT-150 (= #1760) and PLT-143 (= #1761) issue-draft
status notes; the run-log narrative fields.

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **PLT-147 / #1755 (mapper NPE)** — separate filed issue (high, 0.28.0); the e2e asserts
  here are deliberately residue-isolated. No mapper change in this PR.
- **Search-session lifecycle/TTL semantics** (PLT-138/PLT-127) — the expired state makes
  eviction VISIBLE, nothing about eviction itself changes.
- **No OpenAPI spec edits** — error responses are undeclared today (200s only);
  declaring 4xx families spec-wide is its own item if wanted (would regenerate clients).
- **No FE behaviour changes beyond the three named** — other `getErrorResponse` consumers
  improve passively (real status instead of undefined) with zero per-surface rework.
- **No redux session-switching rework** — the pre-existing "in-SPA navigation to a
  different /search/{id2} shows the old session" edge (effect 2 gates on empty redux
  searchId) predates the splat and stays; noted for a follow-up only if the maintainer
  wants it.
- **No new-issue filing by the bot** (#1755/#1761 already exist; nothing new to file).

### Scope/root-cause comment (posts to #1760 immediately after GATE 1 approval — ASCII)

> Root-cause correction + scope note for the upcoming fix PR, from re-verifying this on a
> live stack (working tree = current main).
>
> **What reproduces exactly as reported:** facets + results of a missing session are clean
> 404 USR002; `GET /api/search/{id}/filters/entityClasses` is 500 SYS001; an expired
> search deep-link gives a user no usable signal.
>
> **Three corrections to the mechanism, all verified live:**
>
> 1. The real filters route is `GET /api/search/{search_id}/facet/{facet_type}` (enum:
>    TAGS/OWNERS/TYPES/GROUPS/STATUSES) -- and for a missing session it ALREADY returns
>    404 USR002 (verified: `facet/TAGS` -> 404). The reproduced 500 is on
>    `/filters/entityClasses`, which matches NO route: WebFlux raises
>    `NoResourceFoundException` (a `ResponseStatusException`, 404), and the
>    `ControllerAdvice` catch-all `@ExceptionHandler(Exception.class)` re-brands every
>    framework `ResponseStatusException` as 500 SYS001 + an ERROR-level log. The same
>    swallow turns `facet/entityClasses` (invalid enum -> `ServerWebInputException`,
>    400 "Type mismatch") into 500 -- i.e. the exact class already reported in #1761.
>    So the backend fix is ONE pass-through handler for `ResponseStatusException`
>    (4xx kept, USR-coded body, WARN logging), which resolves this issue's 500 AND #1761.
> 2. The SPA never even requests the deep-linked session: the router mounts
>    `/search/*` (a splat) while the component reads `params.searchId` -- undefined since
>    the #1551 router refactoring (Dec 2023). Any cold `/search/{id}` (valid OR expired)
>    silently creates a brand-new empty search and rewrites the URL. Verified live with a
>    VALID session id: it is never fetched. Bookmarked/shared search links and F5 state
>    restore have been broken for ~2.5 years; term search (`/termsearch/{id}`) has the
>    identical defect.
> 3. The "Unknown Error" screen is not deterministic: it appeared because the silently
>    created replacement search 500s on stacks carrying a transformer row with null
>    details (that is #1755, separate). On a clean stack the user just silently gets a
>    fresh empty catalog -- the link state is lost with no signal at all. (The error
>    page also says "Unknown Error" for every failure because the error handler reads
>    status off the wrong object -- also fixed here so a 404 is distinguishable.)
>
> **The PR for this issue will therefore contain:** (a) the `ResponseStatusException`
> pass-through in `ControllerAdvice` (closes the 500s here and in #1761); (b) the route
> param fix for `/search/:searchId` and `/termsearch/:termSearchId` so deep links load
> the session again; (c) the graceful "this search has expired -- start a new search"
> state on a session 404, for both search surfaces. Out of scope, tracked separately:
> the transformer-mapper NPE (#1755) and search-session TTL semantics.

### PR mechanics

Draft PR: `Closes #1760`, `Closes #1761` (same class, both 0.28.0 — G-C11 re-verified for
both), `Milestone: 0.28.0` line, root-cause + change + exclusions + both-bucket evidence +
docs-publication note. Short cross-link comment on #1761 pointing at the PR. Review
requested from the maintainer; `draft: true` until the four-gate DoD is checked.

## Test ledger (implement run, 2026-06-11)

Branch commit: `074c9927` (`contrib/CTRIB-005-search-session-not-found`, author
`odd-contributor[bot]`; 18 files, +305/−17 — matches the approved plan exactly).

- **Unit — failing-first:** `FrameworkErrorStatusMappingTest` (new;
  `BaseIntegrationTest`+WebTestClient, the in-process idiom = unit bucket): on unfixed main
  **3 FAILED** (unmatched route 500≠404; invalid enum 500≠400; missing required param
  500≠400) / 2 controls passed (real facet route 404; bind field-errors). Post-fix:
  **5/5 GREEN**. `AdrControllerAdviceMappingScanTest` extended (≥7 handlers +
  `ResponseStatusException` named) — GREEN.
- **Unit — full CI replica:** `scripts/run-platform-tests.sh` (no-arg
  `:odd-platform-api:build` = test + checkstyle + assemble) — **BUILD SUCCESSFUL in 5m 25s**
  on the working tree (= 074c9927 content).
- **FE compile gates:** `tsc --noEmit` clean (caught + fixed one real excess-property issue:
  `SearchFormData` has no `pageSize` — dropped from the new literals); `eslint` on all 8
  changed TS files clean; the SUT webpack build succeeded on every `run-suite.sh` run.
- **Integration — IT-125 re-grounded (LSN-029):** working-tree SUT **5/5 GREEN**
  (uniform 404; pass-through 404/400; expired state + recovery; /search restore with
  no-replacement-POST guard; /termsearch restore + expired). RED proof
  `ODD_SUT=ref:main`: **4/5 FAILED** (exactly the four fix pins; the uniform-404 green-lock
  passes on main as expected). Run-log `2026-06-11-IT-125.md` (three entries: pre-fix
  legacy-pin run e2e:FAIL — the old UX pin failed on a fresh pre-fix stack, proving its
  residue-dependence; the GREEN fix run; the RED ref:main run).
- **FULL integration regression (the gate — 2026-06-11 directive):**
  - `feature-complete`: first run 267 passed / **6 failed — ALL SIX were
    characterization pins of the same advice-swallow class on other surfaces** flipped by
    the class fix (IT-065 actuator env+prometheus ×2; IT-059 unmappable status filter;
    IT-056 missing required param = the #1761 surface; IT-063 missing page+size; IT-045
    empty/null stats body). Zero unexplained regressions. All six re-grounded per LSN-029
    (specs + protocols; IT-056/IT-063 flips were pre-authored in their own comments) →
    re-run: **273 passed / 0 failed** (`run-log/2026-06-11-feature-complete.md`,
    api:PASS e2e:PASS).
  - `multi-stack`: **9/9 GREEN** (`run-log/2026-06-11-multi-stack.md`).
  - `known-bugs`: **6/6 still RED** — no unexpected GREEN (notably the tsquery-poisoning
    REDs prove the pass-through did NOT mask the PLT-090/PLT-127 jOOQ-500 class)
    (`run-log/2026-06-11-known-bugs.md`).
- **Actuator discovery en route — CORRECTED same day (maintainer-caught, see the
  Post-shipping correction section below):** the IT-065 flip exposed env+prometheus
  returning 404 on the e2e stack. The first interpretation ("no route on source-built
  images / dead config") was WRONG — the 404 came from the harness's own
  `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info` compose override. The shipped
  default serves both (demo.oddp.io @ 0.27.13: env 200 with 203/203 values masked,
  prometheus 200). Override removed from all probe stacks; IT-065 re-grounded to the
  SHIPPED posture (env 200-anon + all-masked, prometheus 200-anon); PLT-078 carries the
  corrected live evidence (its masking claim is now demo-confirmed), PLT-198's premise
  re-confirmed.

## Definition of Done (LSN-032 four gates)

1. **Unit (full build, working tree = branch content):** ✅ BUILD SUCCESSFUL 5m25s +
   failing-first RED→GREEN above.
2. **Integration (FULL regression on the working-tree SUT):** ✅ feature-complete 273/0 +
   multi-stack 9/9 + known-bugs still-RED; impacted IT-125 5/5 GREEN with ref:main RED
   proof (LSN-033 honoured — SUT built from the tree each run).
3. **Docs:** ✅ READ (search.md end-to-end + ADR-0007 page) + CHANGED + ROUTED to the
   `release/0.28.0` train (documentation@`1d43d6e`, pushed same-name; main untouched);
   paired item `backlog/docs/DOC-444.md` (milestone 0.28.0, post-merge URLs recorded).
   Routing decision recorded: the pre-fix UI defect made main's "sharing hands them a
   cursor" claim wrong for ≤0.27.x, but the train wording version-anchors the repair
   ("as of 0.28.0; earlier releases silently discarded the pasted id"), which corrects the
   historical record at publish; an interim main hotfix for an 11-day window was judged
   churn (release gate 2026-06-22).
4. **Ontology:** ✅ committed: 4 sidecars re-enriched/created by file-analyser at 074c9927
   (Search, TermSearch, App [NEW], AppErrorPage widget — all validated; agents emitted
   probes P-244/P-245/P-246/P-247); F-017 use_cases +UC-14 (verified, IT-125) + UC-09
   pre-fix-unreachability note + coverage 2/13→3/14; route-search sidecar Maintainer note;
   TEST-GAP-1007 + REFACTOR-676 convergence notes; suites.yaml lane comments flipped;
   IT-125/IT-045/IT-056/IT-059/IT-063/IT-065 protocols re-grounded; enrichment.log +
   manifest sidecar count; graph re-embedded (nodes=7083, vectors=8014,
   BAAI/bge-small-en-v1.5; retrieval spot-check: the new App sidecar is a top-2 hit).

## Post-shipping corrections (2026-06-11, maintainer-caught — same day as the PR)

**1. The actuator "dead config" claim was FALSE.** The maintainer pointed at
`https://demo.oddp.io/actuator/env` — HTTP 200 on release 0.27.13 (and `/actuator/prometheus`
200 with real metrics; env values masked `******` 203/203 sampled, finally live-confirming
PLT-078's masking analysis). The 404 I observed (and generalized from) was the e2e harness's
OWN compose override `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health,info`
(`lineage/_extractor/probe-stacks/*.yml`, authored as wait-for-ready boilerplate under the
false belief health needed it) — one `docker inspect` away the whole time.
- **Why I missed it:** the `feedback_verify_absence_by_reading_config` class, repeated at the
  config-LAYERING level — I read `application.yml` but never inspected the running container's
  environment overrides before claiming platform-level absence; I even wrote "confirm on the
  published image before filing" into PLT-078 and still shipped the claim as "dead config" in
  five artefacts. No excuse; the memory file is updated with the layering instance.
- **Fixed (same day):** override removed from ALL probe stacks (the shipped compose files set
  none — the harness now mirrors the shipped posture); IT-065 spec + protocol re-grounded to
  the SHIPPED truth (env 200-anon + every value masked — RED on any unmasked value;
  prometheus 200-anon + real metrics; correction history recorded in both); PLT-078 note
  rewritten (retraction + the demo evidence; `user_facing_verified` flippable true);
  PLT-198 premise re-confirmed; this record corrected; stack recreated + IT-065 + full
  feature-complete re-run green (see below).

**2. PR coverage drop (CI report: ControllerAdvice.java 82.16% −4.32%, overall −0.02%).**
Root cause: the new `handleResponseStatus` has branches NO HTTP-level test can naturally
reach — a framework-raised **5xx** `ResponseStatusException` (nothing in the running app
emits one) and the **reason-less** fallback (`status.toString()` message path) — so the new
method shipped partially covered, diluting the file. Fixed: `ControllerAdviceResponseStatusTest`
(plain direct-call unit, the GATE-1 plan's "plain handler unit" option) covers the 5xx→SYS001
branch, the empty-reason fallback, and the 404/other-4xx code split; pushed to the PR branch.

**3. Second-order correction surfaced by the re-ground itself (IT-096 / PLT-198):** with the
harness override gone, IT-096's UC-8 pin ("R2DBC pool utilisation is NOT observable from
/actuator") failed — and my first re-write asserted "scrape serves but carries NO r2dbc series"
straight from PLT-198's claim, which the next run promptly falsified: the live scrape body
CARRIES the full pool series for both pools (`r2dbc_pool_acquired_connections{name=
"connectionFactory"|"customConnectionPool"}` + siblings) via Spring Boot's
`ConnectionPoolMetricsAutoConfiguration` — the original "no Micrometer binder" claim was a
static read that missed autoconfigured binders, and the harness override had been masking the
disproof all along. Fixed: IT-096 UC-8 re-grounded as a GREEN-LOCK of the fulfilled
observability promise (RED if the series vanish); protocol updated; **PLT-198 rejected** with
the live evidence (its ask is already shipped behaviour). Lesson applied on the spot: the
second rewrite was authored from the LIVE body, not from a workspace artifact.

## Review (2026-06-11, session: separate from the implementing session — post-af7963f)

- **Result**: ACCEPTED — `pr-draft` → `review-ready`. GATE 2 (human review + merge of
  PR #1771) is the remaining step — the maintainer already took the PR ready-for-review
  himself (timeline: `ready_for_review` by RamanDamayeu 2026-06-11T20:38:37Z; the bot had
  opened it `draft: true` at 19:31:39Z — G-C4 signal honoured, the human owns the flip).
  Paired DOC-444 flipped `review-ready` → `pending-release` (Gate 8 PENDING-RELEASE 0.28.0).
- **Re-verification protocol**: every load-bearing claim re-derived from branch source /
  live GitHub API / the train ref / the reviewer's own fresh full-regression runs — not from
  this record.

### Definition of Done (LSN-032 four gates) — re-verified

1. **Unit (full build, on the branch)** — PASS. Reviewer's own `scripts/run-platform-tests.sh`
   (no-arg = `:odd-platform-api:build`: test + checkstyle + jacoco + assemble) on the clean
   working tree at the PR tip `5cbf60a3` → **BUILD SUCCESSFUL in 5m 40s**. Independently: PR
   #1771 CI ran 6/6 checks green on the exact head (Test Results: **414 tests / 0 failures**
   = 406 pre-PR + the 8 new; run_tests + Playwright test/lint/format-check) — VERIFIED via
   check-runs API fetch on `5cbf60a3`.
2. **Integration (FULL regression, reviewer's own runs on the PR-tip SUT)** — PASS.
   One suite at a time, SUT built from the clean working tree @ `5cbf60a3` each run:
   `feature-complete` **273 passed / 0 failed** (3.9m; IT-125's five tests green in-suite;
   the six flipped advice-class pins green); `multi-stack` **9/9 GREEN** (4.2m; MinIO,
   LOGIN_FORM ×2, LDAP ×2, WAL ×2, session cookie); `known-bugs` **6/6 still RED** — every
   failure its documented pin, zero unexpected GREENs (the tsquery ×2 REDs prove the
   pass-through did NOT mask the jOOQ-500 class). Run-log entries appended with reviewer
   attribution + filled narrative fields. RED half re-verified from the run-log:
   `2026-06-11-IT-125.md` carries the full chain — pre-fix legacy-pin FAIL on a fresh stack
   (residue-dependence proof), fix run 5/5 GREEN, an honest SUT-BUILD-FAILED interlude
   (GC thrash, retried), and the `ref:main` RED proof **4/5 FAILED exactly as pre-authored**
   (LSN-033 honoured — SUT always a run parameter).
3. **Docs** — PASS. Train `release/0.28.0` tip = exactly `1d43d6e` (ls-remote), atop DOC-443's
   `a0199ae`, atop `origin/main` = `5d92250`; `1d43d6e` NOT reachable from main (verified).
   Diff read end-to-end at the train ref: search.md session bullets 1+4 version-anchored
   ("as of 0.28.0; earlier releases silently discarded the pasted id"), eviction bullet now
   describes the expired-state + Start-new-search recovery, "still unreliable" tempering
   preserved; ADR-0007 Decision + Evidence enumerations gain the `ResponseStatusException`
   pass-through, version-anchored. Commit carries a full `Sources:` footer. Gate-8
   sub-checks green: PyYAML parses both pages; descriptions 129/179 chars (≤200); the one
   in-page link is tree-relative and pre-existing. Live no-leak verified: canonical
   `features/data-discovery/search` still serves the 0.27.x eviction wording ("After
   eviction the URL returns no results"); live ADR-0007 page has no `ResponseStatusException`
   — release-gating intact. (The bare `/data-discovery/search` URL 301s to the canonical
   `features/...` slug — DOC-444's recorded URL normalised at its flip, below.)
4. **Ontology** — PASS with one recorded over-claim. On disk and committed: 4 sidecars
   (Search, TermSearch, App [NEW], AppErrorPage) re-enriched 2026-06-11 19:05Z per
   enrichment.log; probes P-244..P-247 exist; F-017 UC-14 verified + coverage 3/14 + UC-09
   pre-fix-unreachability note (F-017.yaml:1017,1032); route-search sidecar Maintainer note
   (:343); TEST-GAP-1007 (:136) + REFACTOR-676 (:94) convergence notes; suites.yaml lane
   comments re-grounded (feature-complete lane lists IT-125; I7 batch comment fixed-contract
   wording); graph build-info `built_at: 2026-06-11`, nodes=7083, vector_count=8014,
   BAAI/bge-small-en-v1.5 — all exactly as recorded. **Over-claim**: DoD-4 lists "PLT-150 …
   and PLT-143 … issue-draft status notes" — NO such notes exist in either file (grep for
   1771/CTRIB-005/in-flight: zero hits); filed in TST-044 item E. The flip-on-fix residue
   on sibling artefacts (below) is the larger part of the same finding.

### Contributor gates

- **G-C1 reproduce-first** — PASS. Live reproduction captured pre-fix (curl probes verbatim,
  server-log mechanism proof — `NoResourceFoundException`/`ServerWebInputException` swallowed
  by the catch-all; Playwright traces; the pre-fix IT-125 run on a fresh stack falsifying the
  issue's UX determinism); `reproduced:` frontmatter carries the evidence path — VERIFIED via
  run-log + record read. The reproduction CORRECTED the issue's mechanism (the literal repro
  URL matches no route; the real facet route already 404'd; the Flux-commit theory falsified
  live) — re-derived this review against `openapi.yaml:702-733` (route + `MultipleFacetType`
  enum + only-200 responses declared) and the live 404 on `facet/TAGS` (my feature-complete
  run, IT-125 test 238).
- **G-C2 running system, not the diff** — PASS via the reviewer's own full unit build + full
  three-suite integration regression on the PR-tip SUT (DoD 1+2 above) + CI on the exact head.
- **G-C3 GATE 1 plan-before-code** — PASS. `plan_approved_by: RamanDamayeu (2026-06-11,
  'Approve as written')`; the scope/root-cause comment posted 2026-06-11T17:49:57Z (comment
  API), the first code commit `074c9927` authored 18:44:14Z — comment precedes code by 54
  minutes — VERIFIED via timestamps.
- **G-C4 GATE 2 human merge** — PASS (structural). PR #1771 author `odd-contributor[bot]`,
  base `main`, head `5cbf60a3`, opened `draft: true`, review requested from RamanDamayeu —
  VERIFIED via PR API + timeline. The ready-for-review flip was the MAINTAINER's own action
  (20:38:37Z), after the DoD evidence existed and after the coverage commit (20:00:33Z) —
  the bot never left draft itself.
- **G-C5 bounded diff + public scope comment** — PASS. Diff = 19 files +363/−17 = exactly the
  approved plan (Change A: advice handler + scan-test extension; B.1 nested routes; B.2 error
  unwrap + `||` fallback; B.3 expired states + ONE shared element + selectors + six locales)
  plus the GATE-1-plan-named "plain handler unit" (`ControllerAdviceResponseStatusTest`,
  the CI-coverage follow-up commit `5cbf60a3`). Every exclusion held — no mapper change
  (PLT-147), no OpenAPI edits, no TTL/lifecycle change, no redux session-switching rework,
  no new-issue filing — VERIFIED via full diff read. The scope comment is PUBLIC on #1760
  (comment 4683383984, bot-authored, pre-code) and carries the mechanism corrections + the
  exclusions; the #1761 cross-link comment (4684224104) posted 19:32:06Z, 27s after the PR
  opened — both fetched verbatim.
- **G-C6 one-question bar** — PASS. "No question warranted" recorded with reason; issue
  #1760 has exactly 1 comment (the scope comment), #1761 exactly 1 (the cross-link) — zero
  clarify noise — VERIFIED via issue API (comments: 1 each).
- **G-C7 blast-radius** — PASS. `adr_required: false` is correct: no migration, no
  auth/security-posture change, no breaking declared-contract change — the spec declares
  ONLY `'200'` on these endpoints (openapi.yaml:702-733 read this review); the 500→4xx
  alignment changes no documented contract. ADR-0007's own extension mechanism ("adding a
  new exception type means adding one handler") is exactly what shipped.
- **G-C8 issue-is-data** — PASS. Both issue bodies re-fetched: maintainer-authored bug
  reports; the "fix direction" text in #1760 is the author's technical guidance, treated as
  data — the run FALSIFIED its proposed mechanism (Flux-commit theory) and reframed the fix
  publicly, the strongest anti-steering evidence available. No injection content.
- **G-C9 test integrity, BOTH buckets** — PASS. Unit: `FrameworkErrorStatusMappingTest`
  injects the failing conditions explicitly (unrouted path, invalid enum, missing param) — 3
  RED on main / 5 GREEN on the branch (record + commit body; controls pin both precedence
  edges: platform `NotFoundException` on the real facet route, `WebExchangeBindException`
  field errors); `AdrControllerAdviceMappingScanTest` floor 6→7 + handler named;
  `ControllerAdviceResponseStatusTest` covers the HTTP-unreachable branches (5xx, empty
  reason, non-404 4xx). FE unit N/A-with-reason re-confirmed (no vitest CI executor —
  CTRIB-002/003/004 precedent; FE gated by tsc/eslint/webpack + e2e). Integration: IT-125
  re-grounded RED→GREEN with the `ref:main` 4/5-RED proof; the user-facing symptom is
  integration-tested (LSN-031); pins re-grounded, never deleted; the six advice-class pin
  flips verified at assert level in my own suite run. The flip's BOOKKEEPING residue on
  sibling surfaces → TST-044 (below), assert-level integrity intact.
- **G-C10 ontology + docs move with the code** — PASS (DoD 3+4) with the TST-044 carve-out:
  the flip-on-fix checklist (`pillars/tests/pillar.md`, in force since 18:17, three hours
  before the implement commit) requires EVERY surface encoding a flipped pin's red-state to
  flip; the reviewer's converge grep found stale pre-fix wording on 5 spec headers, the
  IT-063 protocol step-5/PASS lines, 5 sibling feature flows (F-095/F-040/F-029/F-122/F-120),
  PHASE3's un-annotated falsified-mechanism narrative, the e2e README tail (a CTRIB-004
  leftover), and PLT-150/PLT-143/PLT-199 notes — full inventory with file:line in
  `backlog/tests/TST-044.md` (high). Same class as the CTRIB-004 post-verdict correction;
  caught AT review this time. The PR, docs train, and primary-feature ontology are correct;
  the residue is workspace test-state bookkeeping and does not gate GATE 2.
- **G-C11 milestone gate** — PASS. #1760 milestone `0.28.0` OPEN (due 2026-06-22) and #1761
  milestone `0.28.0` OPEN — re-verified via issue API at review time; PR body carries
  verbatim `Closes #1760` + `Closes #1761` + `Milestone: 0.28.0` + the docs-train note —
  fetched verbatim via PR API. Docs routed to the train; paired DOC-444 milestone-gated.

### Universal Quality Bar gates

- **Gate 1 (no duplicates)** — PASS. IT-125 re-grounded in place (not re-authored); the two
  new unit test classes are complementary tiers (HTTP-level vs direct-call), cross-referenced
  in their javadoc; `SearchSessionExpired` is the plan's one-allowed shared element (distinct
  semantics from `AppErrorPage` — action-recovery vs error-display); DOC-444/DOC-445 deduped
  against DOC-178/199/230/233/177/392/393 (all `done`/different scope); TST-044 vs
  TST-041/042/043 — extends the class, cross-referenced — via grep + read.
- **Gate 2 (aliases)** — N/A (no new doc concept/alias; "search session" vocabulary
  pre-exists on both pages).
- **Gate 3 (caveats)** — PASS. The eviction caveat stays in the session bullets with the
  recovery behaviour version-anchored; "still unreliable" tempering + the tsquery warning
  hint preserved; no caveat demoted — via train-ref read.
- **Gate 4 (consumer-read)** — PASS. Workspace commit `93c5412` carries the 23-file
  `Consumer-read:` footer spanning both repos; key consumers re-walked this review:
  `ControllerAdvice` (handler semantics + closest-type precedence), `ErrorCode` (USR001/
  USR002/SYS001 values), `App.tsx` routes vs `searchRoutes.ts:18-19`/`termsRoutes.ts:54-62`
  param names, `Search.tsx`/`TermSearch.tsx` effect-2 session fetch, `errorHandling.tsx`
  unwrap, pre-existing `getSearchFetchStatuses`/`getTermSearchFetchStatuses`, `ToolbarTabs`
  pathname-based `matchPath` (route-shape independent), `openapi.yaml` facet route. NOTE:
  the odd-platform branch commits carry the evidence in-body but no `Consumer-read:` footer
  (CTRIB-004's platform commit had one) — the work item's commit satisfies the gate; the
  upstream-commit footer convention should be settled one way (it is arguably a Gate-11
  workspace-jargon leak when present — flagged for the maintainer, not blocking).
- **Gate 5 (unset-parameter)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — PASS with finding filed. Behaviour changes → docs:
  deep-link restore + expired state + pass-through all documented (train). Code path →
  doc sweep found the TERM-search surface's doc page missed: `business-glossary.md`'s
  session-shared claim (false ≤0.27.x, true as of 0.28.0) lacks the version anchor + the
  expired-state note → **DOC-445** filed (milestone 0.28.0, rides the same train; the gate
  requires the finding filed-not-narrated — done).
- **Gate 7 (layout/completeness)** — PASS. No SUMMARY change needed (no page added/moved);
  bullets edited in place; anchors intact (`#housekeeping-settings-configuration` link
  unchanged); ADR page section structure intact — via read. Suites-lane registration
  verified (the CTRIB-004 Gate-7 miss class): IT-125 in `feature-complete` + `I7` theme
  lane, comments re-grounded, NOT in known-bugs.
- **Gate 8 (publishing/live)** — PASS for the pillar's public surfaces (PR, both issues,
  both comments, check-runs, branch — all fetched live this review). Docs half:
  **PENDING-RELEASE (0.28.0)** by design — branch-verifiable sub-checks run NOW and green
  (DoD 3); post-merge URLs + phrases recorded in DOC-444 (canonical slugs).
- **Gate 9 (claim provenance)** — PASS with one over-claim recorded. Every load-bearing
  record claim re-derived (the 7-point verification table re-walked against branch source +
  spec; comments/PR/issues/milestones/check-runs via API; train via ls-remote + show + grep;
  ontology via disk; regression via the reviewer's own runs). The DoD-4 "PLT-150 + PLT-143
  status notes" claim is NOT supported on disk → recorded here + TST-044 item E. Banned-
  phrase grep over this review: zero. Outbound URL sweep: 8 live fetches (PR API, issue
  ×2, comment ×2, check-runs, live search page, live ADR-0007 page), 0 broken; 1 mismatch
  caught (DOC-444's recorded search URL was the non-canonical redirecting slug — normalised
  at its flip).
- **Gate 10 (content-type homing)** — PASS. Work record in `contributor/`, run evidence in
  `run-log/`, probe artefacts in `probes/`+`probe-runs/`, doc edits on the train, follow-ups
  in `backlog/docs/` + `backlog/tests/` — per canonical-homes.
- **Gate 11 (audience isolation)** — PASS. Banned-term grep over both touched train pages:
  zero hits. The PR body + issue comments are contributor/operator language (IT-125 and
  `contributor/CTRIB-005.md` references are repo-public traceability, CTRIB-004 precedent).

### Verdict bookkeeping

- **Regressions**: none — measured, not inferred: full unit build GREEN (5m40s) + CI 6/6 on
  the exact head + feature-complete 273/0 + multi-stack 9/9 + known-bugs 6/6-RED-as-designed,
  all reviewer-run on the PR-tip SUT.
- **Navigation**: consistent — `navigation/` pointers for SearchController/ControllerAdvice
  unchanged and correct; no new bean factories/SDK builders introduced.
- **Upstream issues logged**: none new this review (PLT-150/PLT-143 already filed as
  #1760/#1761; both close via the PR).
- **Doc-product editorial findings** (audit per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused pass per CTRIB-004 precedent (full-tree sweep was
    2026-06-08): search.md end-to-end at the train ref; ADR-0007 page end-to-end at the
    train ref; cross-page coherence greps over the train tree (search-session / expired /
    Unknown-Error mentions: business-glossary.md, ADR-0071, ADR-0075 checked).
  - **Findings**:
    - DOC-445 (medium, parallel-surfaces-with-drift) — `business-glossary.md` § "The
      Dictionary tab": the `/termsearch/{uuid}` session-shared claim was false ≤0.27.x
      (splat bug) and becomes true in 0.28.0; needs the version anchor + the expired-state
      note, mirroring DOC-444's search.md bullets. Source: train ref `business-glossary.md:38`.
    - (Positive finding, no action: search.md's pre-existing tsquery-hint claim "the
      recipient sees the 500 too" — false ≤0.27.x because the splat bug shielded recipients —
      becomes TRUE in 0.28.0 via this fix; the train needs no edit there.)
- **Follow-ups filed this review**: `backlog/tests/TST-044.md` (high — the complete
  flip-on-fix residue inventory: 5 spec headers, IT-063 protocol step-5/PASS lines, 5
  sibling flows, PHASE3 bracket-annotation, README tail CTRIB-004 leftover, PLT-150/143/199
  notes, one unattributed unfilled run-log entry; graph re-embed after);
  `backlog/docs/DOC-445.md` (medium, milestone 0.28.0).
- **Banned-phrase check**: none used in record or review.
- **Reviewer-committed artefacts**: my three suite-run entries appended to the 2026-06-11
  run-logs (narrative fields filled, reviewer-attributed); P-001 probe-run + feature-flows
  probe-verification + two controller sidecars re-stamped by the harness to the committed
  tip `5cbf60a3` — stronger provenance than the implementer's working-tree runs (CTRIB-004
  precedent), committed with this review.
