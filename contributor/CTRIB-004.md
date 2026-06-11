---
id: CTRIB-004
github_issue_number: 1764
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1764
class: bug
milestone: "0.28.0"
status: review-ready
reproduced: "live 2026-06-11 on local odd-minimal, SUT=working tree @ 8c142e15 (= unfixed main; image odd-platform:odd-team-sut, digest sha256:275f56ffd3da…): run-suite.sh IT-002 seeded entity 2001 at view_count=0, drove ONE real-browser open of /dataentities/2001/overview; assert view_count==1 FAILED — Expected: 1, Received: 2 (run-log/2026-06-11-IT-002.md, outcome e2e:FAIL; Playwright screenshot+trace in e2e/test-results/). Same stack: GET /api/resource/DATA_ENTITY/2001/permissions → [] (DISABLED grants no permissions — status control hidden, claim 7 runtime-confirmed)"
adr_required: false
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-11 — approved as written INCLUDING posting the scope comment; Closes #1764 + PLT-217 follow-up draft chosen)"
plan_approved_at: "2026-06-11"
docs_routing: "release/0.28.0 — SHIPPED on the train (documentation@a0199ae; 3 pages: entity-detail-page, catalog-overview, search; paired item DOC-443 review-ready/milestone-gated; docs main untouched)"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1770"
pr_draft: true
---

# CTRIB-004 — view_count integrity: fix the LSN-017 +2-per-open double-fetch (#1764)

Issue #1764 is the filed form of PLT-104 (`issues/odd-platform/PLT-104.md`). Author: the
maintainer (RamanDamayeu). Labels `kind: bug`, `scope: backend`, `scope: frontend`;
milestone **0.28.0** (open, semver, due 2026-06-22 — G-C11 PASS); 0 comments at intake.
Issue body treated as quoted data (G-C8); every load-bearing claim independently re-verified
below against the odd-platform working tree (`main` @ `8c142e15`, clean — post-#1749).

## Scope analysis

- **Class: bug** (cross-layer; the verified user-facing defect is the FE double-fetch).
  The issue bundles three concerns of different classes:
  1. **The LSN-017 double-fetch — +2 view_count per detail-page open.** Runtime-pinned
     (probe P-004: `xhr_count == 2`, delta == 2 per open), code-settled, bounded FE fix.
     **This is the bug this CTRIB fixes.**
  2. **No rate-limit / idempotency / auth on the increment** (scripted anonymous inflation).
     A real exposure, but closing it is an anti-abuse DESIGN decision (what identifies a
     "session" under `AUTH_TYPE=DISABLED`? cookie/IP heuristics are attacker-controlled and
     would be security theater) and touching the auth posture of the endpoint is the G-C7
     class → requires an ADR. **Scope-excluded; follow-up.**
  3. **Ranking hardening** (secondary signal, `view_count` index). Product/architectural
     change to a public surface + a migration; adjacent to PLT-026 (`listMostPopular`
     paginate-before-COUNT). **Scope-excluded; follow-up.**
- **Features:** F-001 (P-01:F-001 — Popular Entities ranking / view tracking, data-discovery
  pillar). The Popular strip is a primary discovery surface; its sole input today is a
  counter that routine browsing inflates 2× (issue "Why it matters" — our own verified text).
- **Mission relevance:** data-discovery is pillar P-01 of `lineage/odd-platform/system-mission.md`;
  trustworthy discovery signals are the pillar's core promise.
- **Architectural significance (G-C7): NO ADR for the in-scope fix** — a FE `useEffect`
  dependency correction + an explicit refetch dispatch; no migration, no auth/security-posture
  change, no public-contract change. (Concern 2 above IS G-C7-class — which is exactly why it
  is excluded and routed to an ADR-shaped follow-up rather than half-fixed here.)
- **Clarify (G-C6): no question warranted.** The issue is our own PLT-104 with full
  root-cause, probe evidence, and fix direction; the author is the maintainer. The one open
  decision — does the bounded fix close #1764, or does the issue stay open for the
  anti-abuse facets — is a GATE 1 plan decision, not an implementation-changing ambiguity
  (CTRIB-003 precedent: no comment that restates the issue to its author).
- **Coordination note resolved:** the issue's "coordinate with PLT-091 (b1) write-source
  debounce" predates PLT-091's 2026-06-10 correction: the search row dispatches NO view_count
  write (`ResultItem.tsx:72-76` is navigation-only); the +2 is written by the destination
  detail page. Fixing the detail-page double-fetch closes EVERY navigation entry point
  (search click, Popular strip, lineage node, bookmark). No search-side change belongs here.

## Claim verification (issue is data — re-verified against the working tree @ 8c142e15)

1. **FE double-fetch driver — CONFIRMED.** `DataEntityDetails.tsx:56-64`: the details-fetch
   `useEffect` lists `details.status?.status` (line 63) in its dependency array; the selector
   returns `emptyObj` pre-fetch (`dataentity.selectors.ts:93-97`), so on first visit the dep
   transitions `undefined → <status>` when fetch #1 fulfils, re-firing the effect → fetch #2.
   The dep is not read inside the effect body (trigger-only).
2. **Backend increment — CONFIRMED.** `ReactiveDataEntityRepositoryImpl.java:173-180`
   (`incrementViewCount`: bare `VIEW_COUNT.plus(1)` UPDATE, line 175-176); reached from every
   details read via `DataEntityServiceImpl.getDetails` (:197-209, `.flatMap(this::incrementViewCount)`
   at :207; private impl :488-495). No dedup/throttle/idempotency on the path.
3. **Sole ranking signal — CONFIRMED.** Repo `listPopular` (:630-649): CTE ordered by
   `DATA_ENTITY.VIEW_COUNT.sort(DESC)` (:633), no secondary signal (tiebreak = ID desc via
   `getOrderFields`); service `listPopular` :226-230; controller `getPopular` :307-313.
   Controller `getDataEntityDetails` (:139-147) carries no `@PreAuthorize` → increment is
   anonymous under shipped `AUTH_TYPE=DISABLED`.
4. **WHY the dep exists — established (beyond the issue).** Added by `002f415a`
   ("Data deprecation & metadata stale", #1399, 2023-08) together with the status feature.
   It is the page's refetch-after-status-change mechanism: `StatusSettingsForm.onSubmit`
   (the ONLY status-change path — sole consumer of `useUpdateDataEntityStatus`, reached only
   from the details header's selectable `EntityStatus`) awaits the mutation, dispatches
   `updateEntityStatus` (slice :73-84) which writes the new status into the store → the dep
   changes → the page refetches. **The refetch is load-bearing:** the backend status change
   has side effects beyond the status field — `DataEntityInternalStateServiceImpl
   .changeStatusForDataEntities` (:74-98) soft-deletes/restores lineage relations AND
   group relations (`softDeleteDataEntities` :107-130, `restore` :133+) — so after
   DELETED/restore the page's group chips and relations genuinely change server-side.
   A naive dep removal would silently break that. The fix must remove the mount double-fire
   AND keep one explicit refetch at the status-change point.
5. **Status-change side increment — noted.** Today every status change ALSO bumps
   view_count +1 (the dep-triggered refetch reads details). The fix preserves exactly that
   (one refetch per status change) — no behaviour delta on the status path.
6. **Existing test rails — CONFIRMED.**
   - `IT-002` (`protocols/IT-002-view-count-ui-overview.md` + `e2e/specs/view-count-overview.spec.ts`,
     `regresses: [PLT-104]`, `expected_result: "RED until PLT-104 fixed"`) asserts one
     page-open == +1. It is the pre-existing failing test for this exact bug — the RED half
     of the proof exists; it flips GREEN on the fix.
   - `IT-001` (`protocols/IT-001-view-count-backend-delta.md`, probe P-001) pins the backend
     +1-per-GET contract — must STAY green (the fix moves nothing server-side).
7. **Permissions under the IT stack (DISABLED auth) — RUNTIME-CONFIRMED 2026-06-11.**
   Static trace: no SecurityContext → `AuthIdentityProviderImpl.getCurrentUser()` empty → no
   roles (`RoleServiceImpl:95-101`) → no policies → no `DATA_ENTITY_STATUS_UPDATE` → the
   header renders the non-selectable status (`DataEntityDetailsHeader.tsx:113-122` gates
   `selectable` on `WithPermissions`). Runtime: on the live stack,
   `GET /api/resource/DATA_ENTITY/2001/permissions` → `[]` (HTTP 200). The status-change
   dialog is therefore NOT driveable e2e under the default stack; the preserved-refetch
   behaviour is verified by code-read + compile + IT-suite no-regression, not by a new e2e
   (an LDAP-stack status-flow IT would be its own follow-up if the maintainer wants one).

## Reproduction (G-C1) — captured live 2026-06-11

Stack: odd-minimal (`AUTH_TYPE=DISABLED`), image `odd-platform:odd-team-sut` built by
`run-suite.sh` from the odd-platform WORKING TREE @ `8c142e15` (clean = the same bits as
`ref:main`, pre-fix), digest `sha256:275f56ffd3da…`. The runner confirmed "the e2e stack is
running the SUT image".

Drive: `integration-tests/run-suite.sh IT-002` — seeds entity 2001 (`view_count=0`,
precondition asserted), opens `/dataentities/2001/overview` ONCE in headless Chromium,
waits for network-idle + 1.5 s settle, reads the counter back from Postgres:

```
Error: One Overview page-open must register exactly ONE view; got 2.
  Expected: 1
  Received: 2
1 failed — logged → integration-tests/run-log/2026-06-11-IT-002.md (outcome: e2e:FAIL)
```

One page-open = +2 — the LSN-017/PLT-104 double-count, live on the current main. This run
is simultaneously the G-C1 reproduction and the RED half of the fix proof (IT-002 is the
pre-existing failing test; it must flip GREEN on the fixed working tree). Screenshot +
Playwright trace under `integration-tests/e2e/test-results/`.

## Root cause (verified on source + pinned at runtime)

`DataEntityDetails.tsx:56-64` — the details-fetch `useEffect` lists `details.status?.status`
(line 63) in its dependency array. The selector returns `emptyObj` before the first fetch
(`dataentity.selectors.ts:93-97`), so on every first visit: mount fires fetch #1
(`status === undefined`) → fulfilled action writes the entity into the store → the dep
transitions `undefined → <status>` → the effect re-fires → fetch #2 → quiesce (same status).
Each `GET /api/dataentities/{id}` is a backend `view_count + 1`
(`DataEntityServiceImpl.getDetails` :207 → `ReactiveDataEntityRepositoryImpl.incrementViewCount`
:173-180) — net **+2 per page-open**, from every navigation entry point. The dep is not read
inside the effect body; it exists as the refetch-after-status-change trigger added with the
status feature (`002f415a`, #1399) — and that refetch is load-bearing (status changes
soft-delete/restore lineage + group relations server-side:
`DataEntityInternalStateServiceImpl.changeStatusForDataEntities` :74-98, `softDeleteDataEntities`
:107-130). The correct fix removes the reactive trigger (the double-fire) and keeps one
explicit refetch at the status-change point.

## Comments (issue thread)

- Clarify comment: **none warranted** (G-C6) — recorded in scope analysis.
- Root-cause-only comment: SKIP (CTRIB-003 precedent — the issue body, authored from our
  PLT-104, already carries the full root cause; restating it to its author is noise).
- **Scope comment: REQUIRED** (G-C5, maintainer directive 2026-06-11) — the plan narrows
  #1764 to concern 1 of 3, so the scope split + rationale must live on the public thread,
  not only in this record. ONE comment (scope + a one-line root-cause anchor), drafted in
  the Plan below; **GATE 1 approval = approval to post it**; posts immediately after
  approval, before any code; URL recorded here.
- **POSTED 2026-06-11 (post-GATE-1, pre-code):**
  https://github.com/opendatadiscovery/odd-platform/issues/1764#issuecomment-4681791399
  (author `odd-contributor[bot]`; final sentence = the Closes variant per GATE 1).

## Plan

**Branch:** `contrib/CTRIB-004-view-count-double-fetch` on `opendatadiscovery/odd-platform`.

### Change — 2 FE files; zero backend changes

1. **`odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx`** — remove
   `details.status?.status` from the details-fetch `useEffect` dependency array (line 63).
   Deps become `[dataEntityId, isDataEntityGroupUpdated, isDataEntityAddedToGroup,
   isDataEntityDeletedFromGroup]`. One mount = one fetch = +1 view_count; every navigation
   entry point (search row, Popular tile, lineage node, bookmark, F5) inherits the fix.
2. **`odd-platform-ui/src/components/shared/elements/EntityStatus/StatusSettingsForm/StatusSettingsForm.tsx`**
   — in `onSubmit`, after `dispatch(updateEntityStatus(…))`, add
   `dispatch(fetchDataEntityDetails({ dataEntityId }))` (import from `redux/thunks`).
   Preserves the load-bearing refetch-after-status-change — now explicit at the trigger
   point instead of reactive via a fetch-derived dep. Status-change observable behaviour is
   IDENTICAL to today: instant chip update (`updateEntityStatus`), one details refetch
   (catches the server-side group/lineage soft-delete/restore), one +1 view_count.

### Test plan (G-C9, routed by the tests-pillar home rule)

- **Unit bucket: N/A with reason** — FE-only fix; no CI job executes any FE unit framework
  (vitest in `package.json` with zero workflow references — CTRIB-003-verified precedent;
  a vitest test would be an orphan, tests-as-gates). Repo-level no-regression gate instead:
  full `scripts/run-platform-tests.sh` (`:odd-platform-api:build` = test + checkstyle +
  assemble) GREEN on the branch. The FE compile is gated by the SUT image build every
  `run-suite.sh` run (webpack build from the working tree).
- **Integration bucket (the executable gate):**
  - **IT-002** (`regresses: [PLT-104]`, asserts one open == +1): **RED captured pre-fix**
    (this run, above) → must run **GREEN on the fixed working-tree SUT** (default
    `ODD_SUT=working`). The protocol's `expected_result` + status flip with the fix.
  - **IT-001** (backend +1-per-GET contract, probe P-001): must STAY GREEN — proves the fix
    moved nothing server-side.
  - The preserved status-change refetch is NOT e2e-driveable under DISABLED (runtime-confirmed
    `[]` permissions); covered by code-read + tsc/webpack compile + suite no-regression.

### Docs decision (G-C10 + G-C11) — routing: `release/0.28.0` train

Both affected pages READ (source @ documentation main, 2026-06-11):
- `docs/data-discovery/entity-detail-page.md` — "General panel — view count caveats": the
  **"+2 not +1" warning hint goes stale at merge** → rewrite on the train as a
  version-anchored fixed-note ("one open = one view as of 0.28.0; releases ≤0.27.x
  double-counted +2 — LSN-017 class"), adjust the section lead ("Two behaviours…"). The
  second hint (sole-signal / trivially-inflatable) **stays** — still true post-fix.
- `docs/data-discovery/catalog-overview.md` — the Popular-column hint's clause "and opening
  a detail page registers as **+2**, not +1" → updated the same way; the inflatable warning
  itself stays.
- Mechanics: author on documentation branch `release/0.28.0` (sync-first; create from
  `origin/main` if absent; same-name push only — LSN-034). Paired backlog item
  **DOC-443** (`milestone: 0.28.0`, `pending-release`, affected pages + post-merge URLs)
  so the release gate runs the live verification. DOC-297 stays `done` (it correctly
  documented then-current behaviour).

### Ontology refresh (G-C10)

- `/enrich --touched` sidecars: `…react-component__component__DataEntityDetails.md`,
  `…redux-thunk__thunk__fetchDataEntityDetails.md`,
  `…controller-method__getDataEntityDetails.md` (chain multiplicity 2×1 → 1×1).
- `F-001.yaml`: +2 facets → RESOLVED-1764 (chain composition, headline drift); the
  inflation/no-anti-abuse invariant STAYS (deliberately unfixed, follow-up below); IT-002
  use-case coverage flips on the GREEN run.
- `probes/P-004.yaml`: asserts flip 2→1 per its own pre-authored note ("when the dep-array
  bug is fixed … xhr_count becomes 1, delta becomes 1").
- `IT-002` protocol: `expected_result` → green-state wording.
- Workspace: PLT-104 status note; PLT-091 Defect-2 cross-link ("closed by #1764").
- Graph re-embed; ALL COMMITTED (not narrated).

### Scope EXCLUSIONS (G-C5 — deliberately NOT touched)

- **No server-side dedup / rate-limit / idempotency / auth gate on the increment.** The
  anti-abuse design is the G-C7 class (security-posture + session-identity design under
  `DISABLED` auth; a naive sentinel is attacker-controlled theater). → Follow-up drafted
  this run: `issues/odd-platform/PLT-217.md` (paste-ready; covers increment hardening +
  ranking secondary-signal + the `view_count` index; cites REFACTOR-201/220, P-002 evidence).
- **No ranking change** — `listPopular` stays `view_count DESC` (secondary signal + index =
  PLT-217; pagination defect = PLT-026, separate).
- **No search-side change** — PLT-091 owns Defects 1/3/4; its Defect 2 is closed BY this fix.
- **No backend change of any kind** (IT-001 pins the +1 contract unchanged).
- **No `updateEntityStatus` slice removal / no other dep-array edits** — the three
  group-flags deps are real triggers and stay.
- **No vitest/CI wiring** (orphan without a CI executor; CTRIB-002/-003 precedent).
- **No LDAP-stack status-flow IT** in this PR (the dialog is permission-gated off under the
  default stack; flagged as an optional follow-up, maintainer's call).

### Scope comment (posts to #1764 immediately after GATE 1 approval — ASCII, public)

> Scope note for the upcoming fix PR.
>
> This issue bundles three concerns of different classes:
>
> 1. **The +2-per-open double-fetch** -- the `details.status?.status` entry in the
>    `useEffect` dependency array of `DataEntityDetails.tsx` is populated by the fetch's
>    own fulfilled action, so every first visit fires the detail fetch twice, and each
>    fetch is a backend `view_count + 1`. Re-verified end-to-end today: a one-page-open
>    e2e regression test (expects `view_count == 1`) fails with `2` on current main.
> 2. **No rate-limit / idempotency / auth gate on the increment** -- real, but closing it
>    is an anti-abuse design decision (what identifies a "session" under
>    `auth.type=DISABLED`? cookie/IP sentinels are attacker-controlled), i.e. an
>    architectural proposal, not a rider on a bug fix.
> 3. **Ranking hardening** (a secondary ranking signal + an index on `view_count`) --
>    likewise an architectural/product change to a public surface.
>
> The PR for this issue fixes **concern 1 only**: remove the status dep (one mount = one
> fetch = +1 from every navigation entry point -- search click, Popular tile, lineage
> node, bookmark), and keep the refetch-after-status-change working by dispatching it
> explicitly in the status settings form (that refetch is load-bearing: a status change
> soft-deletes/restores lineage and group relations server-side, so the page must re-read
> after it).
>
> Concerns 2 and 3 are deliberately not in that PR; they will be filed as a separate
> hardening issue so they keep public tracking {after this one closes | while this issue
> stays open carrying them — final wording per the GATE 1 Closes-vs-Refs decision}. Until
> that lands, the docs keep their "view count is trivially inflatable" warning.

### PR mechanics

`Closes #1764` (recommended — the verified, milestone-fitting defect is fixed; the
anti-abuse/ranking facets get their own paste-ready issue PLT-217 for the maintainer to
file) — OR `Refs #1764` keeping the issue open for the hardening facets. **GATE 1 decision**
(the scope comment's final sentence adapts accordingly). → **GATE 1 chose `Closes #1764`.**
Draft PR body: root-cause + change + exclusions + both-bucket evidence + docs routing note
(`Docs: documentation@release/0.28.0 — publishes with the 0.28.0 release`) +
`Milestone: 0.28.0` line.

## Test ledger

- **Unit bucket: N/A with reason (per plan) + repo no-regression gate GREEN.** FE-only fix;
  no CI job executes any FE unit framework (vitest configured, zero workflow executors —
  CTRIB-002/-003 precedent re-confirmed; an in-repo vitest pin would be an orphan).
  Full `scripts/run-platform-tests.sh` (`:odd-platform-api:build` = test + checkstyle +
  assemble + jacoco): **BUILD SUCCESSFUL in 5m 40s** (2026-06-11, working tree = the fix).
  FE compile gates: `tsc --noEmit` exit 0; `eslint` on both changed files exit 0; the SUT
  image webpack build succeeded twice (run-suite.sh builds).
- **Integration — IT-002 (`regresses: [PLT-104]`, the pre-existing failing test):**
  - **RED (pre-fix):** SUT = working tree CLEAN @ `8c142e15` (= the same bits as
    `ODD_SUT=ref:main`), digest `sha256:275f56ffd3da…` — FAILED `Expected: 1, Received: 2`
    (run-log `2026-06-11-IT-002.md` entry 1). This run is simultaneously the G-C1
    reproduction.
  - **GREEN (post-fix):** SUT built from the fixed working tree @ `8c142e15+uncommitted`
    (committed as `93cb5252` immediately after, identical content), digest
    `sha256:40c53f9aac…` — **1 passed** (run-log entry 2).
- **Integration — IT-001 (backend +1-per-GET contract, probe P-001):** **PASS** on the
  fixed SUT (digest `sha256:205179eda3…`, run-log `2026-06-11-IT-001.md`; probe-run
  `2026-06-11-P-001.yaml`) — the fix moved nothing server-side.
- **Status-change refetch preservation:** NOT e2e-driveable under the DISABLED stack
  (permissions `[]`, runtime-verified — the dialog never renders). Verified by: code-read
  (the explicit dispatch sits at the exact point the removed dep used to fire), tsc +
  eslint + webpack compile, and suite no-regression. An LDAP-stack status-flow IT remains
  an optional follow-up (maintainer's call).

## Adjacent findings (logged, out of scope — G-C5)

- **Loader-boolean dep edges can double-refire the details fetch on 2nd+ group mutations**
  (static trace through `loader-selectors.ts:12-22` + `loader.slice.ts:27-49`; the three
  `isLoaded` group flags flip true→false→true on subsequent group ops). LSN-017-family,
  much lower frequency than page-opens, NOT runtime-verified. Recorded in the
  `fetchDataEntityDetails` sidecar (`bugs_limitations_corner_cases`); promote to a PLT
  draft only if runtime-confirmed (would need a group-update drive, which needs
  permissions → LDAP stack).
- **PLT-217 drafted** (`issues/odd-platform/PLT-217.md`) — the deferred anti-abuse +
  ranking-hardening facets, paste-ready for the maintainer.

## Branch / PR

- Branch `contrib/CTRIB-004-view-count-double-fetch` pushed to
  `opendatadiscovery/odd-platform` (commit `93cb5252`, authored + committed
  `odd-contributor[bot]`; 2 files, +11/−1 — the two FE files only).
- Draft PR: **#1770** — https://github.com/opendatadiscovery/odd-platform/pull/1770
  (`draft: true`, `Closes #1764`, `Milestone: 0.28.0` line, docs-publication note
  `documentation@release/0.28.0 — publishes with the 0.28.0 release`; review requested
  from `RamanDamayeu`; the bot cannot merge — GATE 2 is the human's). Milestone
  re-verified at PR time: `0.28.0` open, unchanged (G-C11).
- Scope comment on #1764 (GATE-1-approved, posted pre-code):
  https://github.com/opendatadiscovery/odd-platform/issues/1764#issuecomment-4681791399
- Follow-up drafted: `issues/odd-platform/PLT-217.md` (anti-abuse + ranking hardening,
  paste-ready). Paired doc item: `backlog/docs/DOC-443.md`.

## Definition of Done (four merge-readiness gates — `retrospectives/LSN-032`)

1. **Unit (full build, on the branch):** ✅ `BUILD SUCCESSFUL in 5m 40s` (2026-06-11).
2. **Integration (working-tree SUT):** ✅ IT-002 RED→GREEN (digests `275f56ff…` →
   `40c53f9a…`) + IT-001 PASS (`205179ed…`); LSN-033 honoured (SUT = run parameter,
   built from the tree each run).
3. **Docs:** ✅ READ + **CHANGED + ROUTED to the train** — three pages carried the "+2"
   claim (the converge sweep caught `search.md` beyond the plan's two);
   documentation branch `release/0.28.0` created from `origin/main` @ `5d92250`, commit
   `a0199ae`, pushed same-name (`push.default=current` verified pre-push — LSN-034 guard);
   docs `main` untouched; paired item `backlog/docs/DOC-443.md` (`milestone: 0.28.0`,
   `review-ready`).
4. **Ontology:** ✅ committed (this workspace commit) — 3 sidecars re-enriched/created by
   file-analyser (all 3 `validate-sidecar` OK; the 2 controller-method sidecars
   additionally probe-stamped by the IT-001 run), F-001 description + hop-1 multiplicity
   + amplification 2→1 + UC-2 `confirmed/verified` + chain-composition facet RESOLVED-1764,
   P-004 asserts 2→1, IT-002 protocol flipped, PLT-104/PLT-091 cross-linked, enrichment.log
   appended; graph re-embedded (`graph-build odd-platform`: nodes=7082, vectors=8014,
   `BAAI/bge-small-en-v1.5`; new StatusSettingsForm sidecar = top retrieval hit on
   spot-check).

## Review (2026-06-11, session: separate from the implementing session — post-dd055ad)

- **Result**: ACCEPTED — `pr-draft` → `review-ready`. GATE 2 (human review + merge of
  PR #1770) is the remaining step. Paired DOC-443 flipped `review-ready` → `pending-release`
  (Gate 8 PENDING-RELEASE 0.28.0; post-merge URLs recorded in that item).
- **Re-verification protocol**: every load-bearing claim re-derived from branch source /
  live GitHub API / the reviewer's own fresh suite runs — not from this record.

### Definition of Done (LSN-032 four gates) — re-verified

1. **Unit (full build, on the branch)** — PASS. PR #1770 CI ran 6/6 checks green on the exact
   head `93cb5252`: Test Results + run_tests (406 tests, 0 failures, ~3m24s, 120 suites) +
   Playwright test/lint/format-check — VERIFIED via check-runs API fetch. Independently
   corroborates the recorded local `:odd-platform-api:build` GREEN (5m40s).
2. **Integration (working-tree SUT)** — PASS, **re-run by the reviewer on the COMMITTED
   branch tip**: `run-suite.sh IT-002` against the SUT built from clean `93cb5252` (digest
   `sha256:40f75c31…`) → harness confirmed "the e2e stack is running the SUT image" →
   **1 passed (3.8s)** (one page-open == exactly one view). `run-suite.sh IT-001` on the same
   tip (digest `sha256:ee15e801…`) → **P-001 PASS, all assertions** — backend +1 contract
   unmoved. Both runs appended to the 2026-06-11 run-logs with filled narrative fields.
   RED half: implementer's pre-fix run (clean `8c142e15` = main bits, digest `275f56ff…`,
   `Expected: 1, Received: 2`) — VERIFIED via run-log read; LSN-033 honoured throughout
   (SUT = run parameter, built from the tree each run).
3. **Docs** — PASS. Train branch `release/0.28.0` exists on the documentation remote at
   exactly `a0199ae` (ls-remote), based on `origin/main` @ `5d92250`; main untouched
   (a0199ae unreachable from main). Diff = 3 pages / +6/−6, read end-to-end at the train ref:
   entity-detail-page "+2" warning → version-anchored **info** note (correct hint downgrade;
   lead resynced to "One version note and one caveat"); catalog-overview "+2" clause →
   "one view as of 0.28.0"; search.md section retitled + false direct-nav advice corrected
   in place; all three "sole signal / trivially inflatable" warnings preserved (still true);
   canonical anchor `#general-panel-view-count-caveats` intact. Train-tree grep: zero
   surviving present-tense "+2"/double-count claims. Live page still serves the 0.27.x "+2"
   warning (WebFetch) — release-gating intact, no leak. Commit carries a full `Sources:` footer.
4. **Ontology** — PASS, verified on disk: 5 sidecar files present (3 re-enriched/created
   2026-06-11 + 2 probe-stamped); F-001 `amplification_factor: 1` + FIXED-1764 provenance +
   hop-1 multiplicity 1 + chain facet RESOLVED-1764 + UC-2 `verdict: confirmed` /
   `coverage: verified` (F-001.yaml:592-601); P-004 asserts flipped to `xhr_count == 1` with
   pre-authored HISTORY; IT-002 protocol `expected_result` green-state; PLT-104 fix section +
   PLT-091 Defect-2 closure cross-links in dd055ad; graph build-info `built_at: 2026-06-11`,
   nodes=7082, vectors=8014, `BAAI/bge-small-en-v1.5`. The reviewer's IT-001 run re-stamped
   P-001 probe-run + both controller sidecars + feature-flows to the committed tip (stronger
   provenance than the implementer's pre-commit tree; committed with this review).

### Contributor gates

- **G-C1 reproduce-first** — PASS. Live RED reproduction on the unfixed tree (clean
  `8c142e15`, digest `275f56ff…`): `Expected: 1, Received: 2` + the permissions probe
  (`GET …/permissions` → `[]`) — VERIFIED via run-log + `reproduced:` frontmatter; the RED
  run doubles as the failing-test-first half (IT-002 pre-existed as the PLT-104 pin).
- **G-C2 running system, not the diff** — PASS via the reviewer's own IT-002 + IT-001
  re-runs on the committed branch tip (above) + CI's full suite on the exact commit.
- **G-C3 GATE 1 plan-before-code** — PASS. `plan_approved_by: RamanDamayeu (2026-06-11,
  approved as written INCLUDING the scope comment; Closes + PLT-217 chosen)`; the shipped
  diff matches the approved plan exactly — `git show 93cb5252`: 2 files, +11/−1, dep removed
  + explicit refetch dispatch, nothing else — VERIFIED via full diff read.
- **G-C4 GATE 2 human merge** — PASS (structural). PR #1770 `draft: true`, author
  `odd-contributor[bot]`, review requested from RamanDamayeu, base `main` — VERIFIED via PR API.
- **G-C5 bounded diff + public scope comment** — PASS. Diff bounded (zero backend changes —
  IT-001 green proves it at runtime); every exclusion held (no dedup/rate-limit, no ranking
  change, no search-side change, no other dep edits, no vitest, no LDAP IT). **The scope
  comment is on the public thread**: issue #1764 comment 4681791399, author
  `odd-contributor[bot]`, posted 2026-06-11T14:44:54Z — BEFORE the code commit (93cb5252
  authored 15:21:12Z) — content matches the GATE-1-approved draft with the Closes-variant
  final sentence — VERIFIED via comment API fetch. Deferred facets tracked: PLT-217 drafted,
  ASCII-clean, paste-ready.
- **G-C6 one-question bar** — PASS. "No question warranted" recorded with reason (issue is
  the maintainer's own PLT-104 with full root cause); issue thread has exactly 1 comment =
  the scope comment, zero clarify noise — VERIFIED via issue API (comments: 1).
- **G-C7 blast-radius** — PASS. `adr_required: false` is correct: FE-only dep-array fix +
  explicit dispatch; no migration, no auth/posture change, no wire-contract change. The
  G-C7-class concern (anti-abuse design under DISABLED) was identified and EXCLUDED to
  PLT-217 rather than half-fixed — the gate working as designed.
- **G-C8 issue-is-data** — PASS. Issue body re-fetched: maintainer-authored bug report,
  no instruction-like content — VERIFIED via issue API fetch.
- **G-C9 test integrity, both buckets** — PASS. Unit: N/A-with-reason re-confirmed (vitest
  has zero CI executors — CTRIB-002/-003 precedent; the repo no-regression gate is the full
  build, green locally AND in CI on the exact commit). Integration: IT-002 is the
  pre-existing failing test for exactly this bug (`regresses: [PLT-104]`), RED pre-fix →
  GREEN post-fix (failing condition = the real pre-fix tree, not an asserted-buggy pin);
  IT-001 pins the unchanged backend contract. The user-facing symptom is integration-only
  (LSN-031) and that is where it is tested. Status-change refetch preservation: NOT
  e2e-driveable under DISABLED (permissions `[]` runtime-confirmed); verified by code-read
  (sole consumer chain: StatusSettingsForm → SelectableEntityStatus:67 → EntityStatus:21
  `selectable` → DataEntityDetailsHeader:113-122 permission-gated — grep-verified single
  render path, so the explicit dispatch fires only with the detail page mounted) + tsc/eslint/
  webpack + suite no-regression; LDAP-stack IT correctly left as a maintainer-option follow-up.
- **G-C10 ontology + docs move with the code** — PASS (DoD items 3+4 above; all committed,
  not narrated).
- **G-C11 milestone gate** — PASS. Issue #1764 milestone `0.28.0` OPEN (re-verified via
  API at review time); PR body carries verbatim `Milestone: 0.28.0` + `Closes #1764` +
  `Docs: documentation@release/0.28.0 -- publishes with the 0.28.0 release (commit a0199ae).`
  — VERIFIED via PR API verbatim-quote fetch. Docs routed to the train (DoD 3); paired
  DOC-443 carries `milestone: "0.28.0"` for the release gate.

### Universal Quality Bar gates

- **Gate 1 (no duplicates)** — PASS. No new test/protocol duplicates (IT-002 pre-existed and
  was flipped, not re-authored); PLT-217 deduped against PLT-026 (pagination defect stays
  separate) and PLT-091 (Defect 2 closed-by, Defects 1/3/4 remain there); DOC-443 vs DOC-297/
  DOC-260 correctly classified as supersede-on-train, prior items stay `done` — via grep + read.
- **Gate 2 (aliases)** — N/A (no new doc concept/alias).
- **Gate 3 (caveats)** — PASS. The retired caveat became a version-anchored info note (not
  deleted); the still-true inflatable/sole-signal warnings preserved as warning admonitions
  on all three pages — via train-ref read.
- **Gate 4 (consumer-read)** — PASS. Both commit footers re-walked: workspace dd055ad
  (4 files) and odd-platform 93cb5252 (12 files) — every cited consumer re-read this review;
  key chain re-derived: dep populated by own fulfilled action (selectors `:93-97` emptyObj),
  increment `:174-180`, `.flatMap(this::incrementViewCount)` `:207`, `listPopular` VIEW_COUNT
  DESC `:633`, soft-delete/restore side effects (`DataEntityInternalStateServiceImpl:74-98,
  107-135`), dep origin `002f415a` (#1399, 2023-08) — all match.
- **Gate 5 (unset-parameter)** — N/A (no SDK builder in scope).
- **Gate 6 (bidirectional code↔doc)** — PASS. Behaviour change (one open = +1) → 3 train
  pages updated; preserved behaviours (status-change refetch +1; inflatable counter) →
  existing docs still accurate; converge sweep independently re-run at the train ref (zero
  surviving "+2" claims). Code paths touched are all documented surfaces (detail page,
  Popular ranking, search-row click).
- **Gate 7 (layout/completeness)** — PASS. No SUMMARY change needed (no page added/moved);
  section retitle on search.md keeps its in-page position; anchors resolve — via read.
- **Gate 8 (publishing/live)** — PASS for the pillar's public surfaces (PR #1770, issue
  comment, branch — all fetched live). Docs half: **PENDING-RELEASE (0.28.0)** by design —
  branch-verifiable sub-checks run NOW and green (PyYAML OK on all 3 train pages;
  descriptions 189/191/129 ≤200 chars; links tree-relative; live pages still serve 0.27.x
  truth = no leak). Post-merge URLs + phrases recorded in DOC-443 for the release gate.
- **Gate 9 (claim provenance)** — PASS. Every load-bearing record claim re-derived (claims
  1-7 of the verification table re-walked against branch source; comment/PR/issue/milestone
  via API; train via ls-remote + diff). Banned-phrase grep over the record: zero hits.
  Outbound URL sweep: 6 live fetches (PR ×2, issue, comment, check-runs, live doc page),
  all resolved, zero mismatches.
- **Gate 10 (content-type homing)** — PASS. Work record in `contributor/`, run evidence in
  `run-log/`, probe artefacts in `probe-runs/`, doc edits on the train, follow-ups in
  `issues/` + `backlog/` — per canonical-homes.
- **Gate 11 (audience isolation)** — PASS. Banned-term grep over all 3 train pages: zero
  hits (no LSN/CTRIB/PLT/gate jargon leaked; the public PR/issue text is operator-language;
  IT-002 references there are repo-public traceability).

### Verdict bookkeeping

- **Regressions**: none found. The one candidate vector — the explicit dispatch firing from
  a non-detail-page context — is closed by the grep-verified single render path (above).
  Loader-boolean double-refire risk was already logged by the implementer in the thunk
  sidecar as a static-trace adjacent finding (correctly NOT promoted without runtime proof).
- **Navigation**: consistent — `navigation/domains/data-entities.md:41` already points at
  `odd-platform-ui/src/components/DataEntityDetails/`; no new bean factories/SDK builders
  discovered.
- **Upstream issues logged**: none new this review (PLT-217 was drafted by the implement
  session and verified here).
- **Doc-product editorial findings** (audit per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: focused pass on the touched surface + neighbours (full-tree sweep
    was 2026-06-08, commit `6463778`): entity-detail-page.md end-to-end at the train ref;
    catalog-overview.md Recommended/Popular sections; search.md edited section + flanking
    sections + Where-to-next.
  - **Findings**: none surfaced this run.
- **Follow-ups filed this review**: `backlog/tests/TST-041.md` (low) — stale RED-today header
  comment in `view-count-overview.spec.ts` + two harness-templated run-log narrative fields
  left unfilled by the implement run (machine-stamped evidence intact; reviewer's filled
  re-run entries supersede).
- **Banned-phrase check**: none used in record or review.

### Post-verdict correction (2026-06-11, maintainer-found — flip residue)

The maintainer caught what both the implement session AND this review missed: **the
IT-002 red→green flip was incomplete.** The pin was still in the `known-bugs` suite lane
(`integration-tests/suites.yaml`) whose own description names the move to
`feature-complete` as "the measurable regression closure" — and a workspace-wide grep
found further unflipped surfaces: the spec's RED-today header (TST-041, known), the e2e
README index line, sibling feature flows **F-141 UC-09** and **F-176 UC-009** (both still
claiming IT-002 RED / promise-broken), `PHASE3-BUILDOUT.md`, and `test-plan.md`.

- **Why /contribute missed it**: the GATE-1 plan's ontology-refresh checklist enumerated
  the F-001-adjacent artefacts (protocol, P-004, F-001, sidecars) and the flip was executed
  from that list; suites.yaml and the sibling flows were never on it.
- **Why this review missed it**: (a) Gate 7 was run docs-scoped, despite the CTRIB-002
  precedent including a suites.yaml registration check; (b) the reviewer's own runs used
  `run-suite.sh IT-002` — direct protocol invocation bypasses suite-lane resolution, so
  the green run never touched the stale registry; (c) the `grep -rn IT-002` converge sweep
  was run only AFTER the first finding (the spec comment) and stopped there instead of
  classifying every hit — the [[feedback-converge-claim-complete-not-instance-loop]]
  failure class, repeated.
- **Fixed (same day)**: lane moved known-bugs → feature-complete (+ lane comments + I9
  comment); spec header + README + PHASE3 + test-plan flipped; F-141 UC-09 / F-176 UC-009
  flipped (`coverage`, `test_ref`, `test_demand`, `use_case_coverage` counts/notes — F-176
  verified 1/12 → 2/12); run-log narrative fields backfilled (TST-041 both halves →
  `review-ready`); graph re-embedded. **Class guard added**: `pillars/tests/pillar.md`
  "The flip-on-fix checklist (red→green closure)" — 8 surfaces + the mandatory grep;
  cites this miss as case-law.
- **Verdict impact**: Gate 7 amended PASS → **PASS-after-correction** (the original PASS
  was wrong by omission). The ACCEPTED result stands — the code, PR, docs train, and
  primary-feature ontology were verified correct; the residue was workspace test-state
  bookkeeping — but the miss is recorded as a review-quality failure, not excused.

### Full-set regression measurement (2026-06-11 directive — G-C2 closed for this item)

The maintainer's same-day directive (every unit + every integration test at implement AND
review; scoped runs are never the gate) was applied retroactively to this item — the
original implement + review had only run the impacted IT-001/IT-002. Measured on the
PR #1770 branch SUT (committed `93cb5252`):

| Set | Result | Verdict |
|---|---|---|
| Unit — full `:odd-platform-api:build` | 406 tests, 0 failures (local 5m40s + CI 6/6 on the exact head) | GREEN |
| `feature-complete` run 1 (first-ever full run incl. IT-002) | 269 passed / 2 failed (4.5m) | flake — see below |
| `feature-complete` run 2 (clean re-run) | 270 passed / 1 failed (4.6m) | flake — see below |
| `multi-stack` | 9 passed (3.4m) — MinIO, LOGIN_FORM ×2, LDAP ×2, notifications WAL ×2 | GREEN |
| `known-bugs` | 6 failed — every failure = its documented pin; none unexpectedly green | RED-as-designed ✓ |

The three e2e failures were three DIFFERENT specs, each failing in exactly one of the two
runs and passing in the other (and solo): view-count got-0 + global-alerts negative
(run 1), data-entity-overview 999999 networkidle-hang (run 2). All three are wait-strategy
/ shared-seed-isolation fragility under full-set sequential load — the 2026-06-07/08
canonical-run class, next instances → **TST-042** (spec hardening; includes the open
platform-side question why a 404-entity route keeps the network busy 60s). Harness defect
observed en route → **TST-043** (mixed-rail double image build + mid-suite stack recreate
+ nondeterministic double run-log entry).

**Regression verdict for #1764: NO regression attributable to the fix.** Mechanical
exclusion on top of the statistics: the fix removes a duplicate dispatch (cannot produce
got-0 — the remaining dispatch is unconditional on mount), creates no alerts, and the
404-entity path is identical pre/post-fix (the removed dep only changed on FULFILLED
actions, which a 404 never emits). GATE 2 remains unblocked.
