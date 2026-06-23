---
ctrib: CTRIB-029
github_issue_number: 1740
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1740
title: "Ingestion auth filter only covers /ingestion/entities — sibling endpoints unprotected even when auth.ingestion.filter.enabled=true"
class: bug                    # security-posture gap (real, verified live on origin/main)
scope: backend
milestone: "0.29.0"          # open + semver (due 2026-06-22) → G-C11 PASSES (no hard stop)
status: pending-release      # GATE-2 DONE 2026-06-22: maintainer MERGED PR #1799 (squash 4028b4a6 on origin/main, Closes #1740); released fix byte-identical to the reviewed dc9b6422. Milestone (0.29.0) → pending-release (NOT done): docs publish on the release/0.29.0 train + ontology re-scan + real-instance verify are owed at /review release:0.29.0. See "## Review" + "## Confirmation run" + "## GATE 2" at end.
reproduced: "STATIC-VERIFIED on origin/main (odd-platform fb597e04), 2026-06-22. SecurityConstants.java:96 whitelists /ingestion/** out of the auth chain; IngestionDataEntitiesFilter (exact /ingestion/entities, conditional) + IngestionDataSourceFilter (exact /ingestion/datasources, always-on) are the ONLY filters; AbstractIngestionFilter.java:38 falls non-matching paths straight through with no auth. Confirmed unprotected handlers: postDataSetStatsList (IngestionController.java:82), ingestMetrics (:90), getDataEntitiesByDEGOddrn GET (:76), alertManagerWebhook (AlertManagerController.java:21). LIVE repro DONE 2026-06-22 on the isolated ctrib029 stack (own image/ports, parallel to #1754) — RED (published release, flag ON, tokenless): /ingestion/metrics->201, /entities/datasets/stats->201, /alert/alertmanager->200, GET /entities/degs/children->200 (the gap); GREEN (my fix, flag ON, tokenless): all->401 'Ingestion token is missing'. See section 'Live reproduction'."
adr_required: true           # G-C7 FIRES — auth/security-posture change. ADR: adrs/drafts/ingestion-auth-filter-coverage.md (status: proposed). No code until approved.
plan_approved_by: RamanDamayeu
plan_approved_at: "2026-06-22"
plan_approved_scope: "Option 1 — single uniform /ingestion/** authentication filter (gated by auth.ingestion.filter.enabled); per-datasource authz on /ingestion/entities unchanged; INCLUDE the alertmanager webhook (maintainer amendment 2026-06-22 — all ingestion routes gated when the flag is on; 'open by default' caveat documented on 3 pages); DEFER default-flip + per-resource authz + the cross-dataset stats surface as logged follow-ups. ADDITIONALLY (maintainer 2026-06-22): publish the ADR in the documentation ADR-log + the enable-security matrix update on the release/0.29.0 train; build independent infra (per-stream worktree/image/stack) to run parallel to #1754."
docs_routing: "release/0.29.0"   # unreleased behaviour → documentation train (G-C11). The enable-security deployment matrix (OPEN→AUTH-token rows) + the 'tracked upstream' note update at release. Paired DOC item to be logged on approval.
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1799"
pr_draft: false              # MERGED 2026-06-22 (squash 4028b4a6 on origin/main; #1740 closed)
merged_commit: "4028b4a6"    # squash-merge of dc9b6422; released fix byte-identical to the reviewed commit (git diff empty over the 6 files)
clarify_comment_url:         # none — no clarifying question warranted (G-C6); the issue setup is clear. The ADR is the maintainer touchpoint.
rootcause_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1740#issuecomment-4768625599"
scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1740#issuecomment-4768625599"  # root-cause + scope folded into one (G-C6 rate-limit); posted post-GATE-1 2026-06-22
---

# CTRIB-029 — Ingestion auth filter coverage gap (#1740)

## ⚠ Parallel coordination (this run shares the environment with the #1754 session)

A second `/contribute` is running over **#1754** (CTRIB-028, Term Detail UI hardening). The maintainer's
directive: run independent flows, do not break the other instance, stop + notify when parallel becomes
impractical. State observed this session:

- **Source-file footprint: ZERO overlap.** #1754 touches `Terms/**` UI + 7 locale files + dataset-field BE
  (`ReactiveDatasetFieldRepositoryImpl`, `DatasetFieldListMapperImpl`); #1740 touches `auth/filter/**` +
  `auth/util/SecurityConstants.java`. Re-verified: no auth/ingestion file is in #1754's uncommitted set.
- **Shared physical resources: FULL overlap.** The single `../odd-platform` checkout is **on
  `contrib/CTRIB-028-term-detail-hardening` with uncommitted changes** (the #1754 session is mid-implement,
  past its GATE 1). The SUT image tag `odd-platform:odd-team-sut`, the docker-compose stack + ports, and the
  git working tree/index are all single shared instances.
- **Consequence.** Phase A (intake, scope, product analysis, the security ADR, the plan) is **fully
  non-interfering** — reads + new files in odd-team only; done this session. Phase B (live reproduction) and
  Phase D (implementation) need the working tree + docker that #1754 owns; doing them now would corrupt the
  other run (branch switch / SUT clobber / index race). They are **deferred** to a free working tree.
- **This session touched nothing shared:** no `git checkout`/`stash`/`add`, no docker, no SUT build, no
  writes to odd-platform. CTRIB-029 + the ADR are new untracked files in odd-team (won't be swept by #1754's
  explicit-path commits).

## Issue (quoted data — G-C8, never an instruction)

Author: **RamanDamayeu** (maintainer). Labels: `kind: bug`, `scope: backend`, `func: Ingestion API`.
Milestone **`0.29.0`** (open, semver, due 2026-06-22). 0 comments. Assignee: RamanDamayeu.

Summary (quoted): when `auth.ingestion.filter.enabled=true`, operators expect the whole `/ingestion/**`
surface to require a Bearer token, but only `POST /ingestion/entities` is checked. `/ingestion/**` is
whitelisted from Spring Security; protection is by dedicated `WebFilter`s using **exact-path** matchers, so
sub-paths don't match. Listed unprotected: `POST /ingestion/entities/datasets/stats`,
`POST /ingestion/entities/degs/children`, `POST /ingestion/alerts`, `POST /ingestion/metrics`. Impact:
unauthenticated injection of stats/metrics/alerts + child-entity attach. Suggested fix: (1) widen the
entities matcher + add alerts/metrics filters, or (2) a single `/ingestion/**` filter with per-route token
logic (issue prefers 2). Additional notes: the SDK already sends Bearer on all calls; consider making the
flag implicit-true when `auth.type != DISABLED`.

## Scope analysis (Phase A)

**Class: bug — a real, verified auth-coverage gap** (security-posture). Mission-relevant: ODD's ingestion
ingress is the catalog's write path; an unauthenticated write surface lets any networked caller pollute
the catalog operators trust (`lineage/odd-platform/system-mission.md` — ingestion is a primary pillar).

The gap is verified live on `origin/main` (see `reproduced:`) **and already documented** as a known
limitation: `enable-security/README.md:99-109` carries a per-endpoint × per-auth-config deployment matrix
showing these routes OPEN, and `:62` says *"A platform-side fix to broaden the ingestion filter's coverage
is tracked upstream"* — i.e. this issue. The docs are ahead of the code.

### G-C7 architectural-significance check → FIRES

This changes the platform's **auth/security posture** (new/restructured ingestion `WebFilter` coverage;
which routes require a token). Per G-C7 the run **STOPS and proposes an ADR before any code**:
→ `adrs/drafts/ingestion-auth-filter-coverage.md` (status: proposed). Not a duplicate — ADR-0002/ADR-0003
govern the `SECURITY_RULES` table; the ingestion-WebFilter sub-system is explicitly outside it (whitelisted).

### G-C16 change-request product analysis (critique the WHAT before the HOW)

**User-observable problem, restated independent of the issue's suggested fix:** with the ingestion flag ON
(and regardless of `auth.type`), the ingestion write surface is only partially token-protected — stats,
metrics, and the Alertmanager webhook accept anonymous writes; DEG membership is anonymously readable. The
flag does not mean what operators read it to mean.

**Two corrections to the issue's framing (the issue is data, not spec — verified):**
1. `/ingestion/entities/degs/children` is a **GET read** (`getDataEntitiesByDEGOddrn`, oddrn query param →
   `CompactDataEntityList`; spec `odd_api.yaml:76-95`), **not** the "POST attach arbitrary child entities"
   the issue claims. Its risk is *information disclosure*, not mutation. Severity for this route is lower
   than the issue implies.
2. `POST /ingestion/alerts` (`createAlerts`) is **spec-declared but unimplemented** (no controller override;
   only an internal `AlertServiceImpl.createAlerts`). The *implemented* alert-write vector is the unlisted
   `POST /ingestion/alert/alertmanager` webhook (`AlertManagerController.java:21`) — also under `/ingestion/**`,
   also unprotected — which the issue never mentions.

**Options (incl. reshape/rescope/revoke) — full matrix in the ADR.** Recommendation: the issue's **Option 2
shape** (single `/ingestion/**` gate) but reshaped — uniform **authentication** (a registered collector/
datasource token, body-shape-agnostic) rather than the issue's "per-route token logic" (which couples to
each body shape and is the larger per-resource-*authorization* problem, deferred). Excludes the Alertmanager
webhook (no collector token to present); does **not** flip the shipped default. These divergences from the
issue's ask are the **GATE-1 decision** (below) — not silently absorbed.

## Root cause

`/ingestion/**` is whitelisted (`SecurityConstants.java:96`) → never hits the central auth chain. The two
ingestion `WebFilter`s use **exact-path** `PathPatternParserServerWebExchangeMatcher`s (`/ingestion/entities`,
`/ingestion/datasources`), and `AbstractIngestionFilter.filter` passes any non-matching exchange straight to
`chain.filter` with no auth (`AbstractIngestionFilter.java:36-40`). Every sibling route therefore has no
token check. The entities filter cannot simply be widened because its decorator parses the body as
`DataEntityList` to bind the token to a datasource — sibling routes carry different (or no) bodies.

## Live reproduction (2026-06-22) — isolated `ctrib029` stack, parallel to #1754

Stood up an isolated stack (image `odd-platform:odd-team-sut-ctrib029`, project `ctrib029`, ports 18090/15442,
`AUTH_TYPE=DISABLED`, `AUTH_INGESTION_FILTER_ENABLED=true`) beside #1754's live stack (18080/15432) — no clash.
Tokenless requests, flag ON:

| Route | Published release (RED — the gap) | My fix (GREEN) |
|---|---|---|
| `POST /ingestion/metrics` | **201** (fake metrics injected) | **401** |
| `POST /ingestion/entities/datasets/stats` | **201** (stats poisoned) | **401** |
| `POST /ingestion/alert/alertmanager` | **200** (fake alert injected) | **401** |
| `GET /ingestion/entities/degs/children` | **200** (DEG membership disclosed) | **401** |
| `POST /ingestion/entities` (control) | 500 | 500 — unchanged (existing filter; out of scope) |
| `POST /ingestion/datasources` (control) | 500 | 500 — unchanged (existing filter) |

GREEN 401 body: `Ingestion token is missing`. The two control routes return the SAME 500 on both images (the
pre-existing filters reacting to the empty `{}` test body — not 200, so no bypass; out of scope, G-C5). This is
the G-C1 reproduce-first + G-C2 system-level RED→GREEN evidence. The valid-token pass-through is covered by the
unit test (`validCollectorTokenPasses` / `validDataSourceTokenPasses`).

## Plan (GATE 1 artifact — G-C3) — APPROVED 2026-06-22

### Design-before-build (G-C12)
- **Reuse-scan:** generalise the existing `IngestionDataSourceFilter` token-lookup approach (token→known
  collector/datasource, **no body parse**) into one uniform filter — reuse the `AbstractIngestionFilter`
  base (matcher + `resolveToken` + 401 `writeResponse`). Rejected reuse: `S2sAuthenticationFilter`
  (X-API-Key→ADMIN — wrong identity model). No new framework; extend the existing filter family.
- **ADR-check:** conforms to ADR-0002 (one auditable place) / ADR-0003 (read-collaborative); fills the
  WebFilter-coverage sub-system those ADRs leave to the whitelist. The new ADR is the reverse-engineered
  decision for that sub-system.
- **Impact checklist:** BE only (Java). i18n: none (no user-facing copy). Generated clients: none (no spec
  change — routes already declared). Consumers: collectors already send Bearer (`datasource_api.py:21-24`) —
  backward-compatible. Migration: none. Docs: the `enable-security` matrix (release/0.29.0 train). Ontology:
  re-enrich the auth-filter sidecars.
- **PO/SRE lens:** operators expect "flag ON ⇒ ingestion needs a token"; the fix delivers exactly that floor
  without breaking compliant collectors; the 401-on-unknown-token behaviour is called out for operators
  flipping the flag.

### The change (exact)
1. New `IngestionAuthenticationFilter` (extends `AbstractIngestionFilter`), `@ConditionalOnProperty
   auth.ingestion.filter.enabled=true`, matcher = `/ingestion/**` **excluding** `/ingestion/entities`,
   `/ingestion/datasources`, and `/ingestion/alert/**`; decorator validates the Bearer resolves to a known
   collector **or** datasource token (no body parse) → 401 if missing/unknown.
2. Leave `IngestionDataEntitiesFilter` (per-datasource authz) + `IngestionDataSourceFilter` (collector
   binding) unchanged. Resolve WebFilter ordering so `/ingestion/entities` is not double-gated.

### Scope (amended by the maintainer 2026-06-22)
- **IN scope — the Alertmanager webhook (`/ingestion/alert/alertmanager`) IS now gated** by the uniform filter
  (was originally an exclusion). All ingestion routes require a Bearer token when the flag is on. Because the
  default stays `false`, the "open by default" caveat is documented on 3 operator pages (notifications,
  odd-platform#prometheus-alertmanager-integration, integrations) + the enable-security matrix.

### Scope EXCLUSIONS (deliberately NOT touched — G-C5)
- The shipped-default flip (`auth.ingestion.filter.enabled` implicit-true) — separate G-C7 decision → follow-up.
- Per-resource authorization for stats/metrics (token-owns-the-dataset) — this PR gives them authentication → follow-up.
- The documented cross-dataset stats-write surface (`README.md:64-89`) — separate data-integrity bug → already doc-tracked.

### Test plan (G-C9, both buckets)
- **Unit (odd-platform CI):** a `@WebFluxTest`/filter test per uncovered route — tokenless request → 401 under
  flag-ON (RED on origin/main where no filter exists), valid registered token → passes through; flag-OFF →
  unchanged (open). Failing-condition injected explicitly.
- **Integration (odd-team IT-NNN):** an `integration-tests/protocols/IT-NNN` driving the running stack with
  `auth.ingestion.filter.enabled=true`: `curl` each route (stats/metrics/degs-children) tokenless → assert
  401 (RED on `ODD_SUT=ref:main`), with a valid token → 2xx. Assertions written from a CAPTURED real response,
  not assumed. (Author after GATE 1 + a free stack.)

### Docs (G-C10 / G-C11) — routed release/0.29.0
Update `enable-security/README.md` deployment matrix (stats/metrics/degs-children OPEN→AUTH-token under
flag-ON) + retire the "tracked upstream" note. Paired DOC backlog item (`milestone: 0.29.0`) logged on approval.

### Ontology (G-C10)
`/enrich --touched` the auth-filter sidecars (they describe the old exact-path coverage) + re-embed + commit.

## Drafted root-cause + scope comment (posts to the issue AFTER GATE 1 — G-C5, before any code)

> **Root cause.** `/ingestion/**` is whitelisted from the auth chain; the two ingestion `WebFilter`s use
> exact-path matchers (`/ingestion/entities`, `/ingestion/datasources`), and the base filter passes any
> non-matching request through unauthenticated — so `…/datasets/stats`, `/metrics`, the
> `…/alert/alertmanager` webhook, and the `GET …/degs/children` read have no token check even with the flag on.
>
> **Two notes on the report:** `…/degs/children` is a **GET** (information disclosure on DEG membership), not a
> child-attach mutation; and `POST /ingestion/alerts` has no handler today — the live alert-write vector is the
> `…/alert/alertmanager` webhook.
>
> **Planned fix (one uniform `/ingestion/**` authentication filter, gated by the existing flag).** Closes the
> stats / metrics / degs-children routes to "must present a registered collector/datasource token"; keeps the
> per-datasource authorization on `/ingestion/entities`. Backward-compatible — `odd-collector-sdk` already
> sends `Authorization: Bearer` on every call.
>
> **Deferred (tracked separately):** the Alertmanager webhook needs a different (shared-secret) auth model;
> making the flag implicit-true when `auth.type != DISABLED` is a shipped-default change handled on its own;
> per-resource authorization (token must own the dataset) on stats/metrics is a follow-up. This PR makes the
> flag protect the whole surface; those harden it further.

## GATE 1 — APPROVED (RamanDamayeu, 2026-06-22) + expanded scope

Approved Option 1 (the ADR's recommendation). Two additions from the maintainer:
1. **Publish the ADR into the documentation repo** `developer-guides/architecture-decision-log` (not only the
   odd-team draft) — routed to the `release/0.29.0` train (it describes 0.29.0 behaviour), alongside the
   `enable-security` deployment-matrix update. Paired DOC backlog item carries `milestone: 0.29.0`.
2. **Run as a genuinely parallel stream** to #1754 on **independent infra** — own odd-platform worktree, own
   docker image tag (`odd-platform:odd-team-sut-ctrib029`), own compose project/ports (`18090`/`15442`,
   names `ctrib029-*`). The isolation model + obstacles + recommended script/skill/agent changes are collected
   in `adrs/drafts/parallel-contribution-infra.md` (the maintainer's "make N-parallel possible" ask).

## Status / next gates

GATE 1 cleared. Execution (on isolated infra, parallel to #1754):
- post the root-cause+scope comment to #1740 (G-C5) + log the 3 follow-ups + paired DOC item;
- `git worktree` → implement the uniform filter → unit RED→GREEN (ODD_PLATFORM_DIR=my worktree);
- isolated stack → live reproduction → API-probe IT;
- documentation ADR + matrix update (release/0.29.0 worktree);
- full regression on my infra (the heavy e2e regression is the cross-stream collision point — coordinate per
  the findings doc §5.7) → ontology refresh → draft PR → **GATE 2** (human merge).

## DoD ledger (live, isolated `ctrib029` infra)

| Gate | Result |
|---|---|
| Reproduce-first (G-C1) | ✓ live RED→GREEN on the ctrib029 stack (see Live reproduction) |
| Unit bucket — full CI replica (G-C2) | ✓ `:odd-platform-api:build` GREEN 5m19s (test + checkstyle + assemble + jacoco), my worktree |
| Patch coverage (G-C13) | ✓ `IngestionAuthenticationFilter` 100% line / 100% instruction (branch 5/6 = jacoco short-circuit-`||` artifact, unreachable); `getByToken` is in the by-design-excluded `**/repository/**` (build.gradle:181) yet Testcontainers-tested |
| Test integrity (G-C9/G-C15) | ✓ new `IngestionAuthenticationFilterTest` (9 cases) + re-grounded PLT-003 `@pins` (LSN-029, kept) + `DataSourceRepositoryImplTest.getByTokenTest` |
| Integration regression (G-C2) | ✓ FULL e2e on my SUT (c76e06df ← dc9b6422), run as the only session: feature-complete 310 GREEN · ingestion-e2e 6 GREEN · multi-stack 9 GREEN · known-bugs 3-RED = the expected quality-dashboard/run-status pins, unrelated to this change (no unexpected GREEN) |
| Docs (G-C10/G-C11) | ✓ LANDED on documentation `release/0.29.0` @ a7b19a8 (pushed): ADR-0079 + matrix split + 3 AlertManager pages + stats caveat; tracked DOC-479; publishes at the 0.29.0 release gate |
| Ontology (G-C10) | DEFERRED (justified): the new `IngestionAuthenticationFilter` node needs a substrate re-scan (beyond `/enrich --touched`); `lineage/**` is dirty from probe-run P-001 (R9/O10 — no `/enrich` into a dirty tree, no sweeping another stream's work). Refreshes at the next substrate scan |
| GATE 2 (G-C4) | ✓ DRAFT PR #1799 open (`Closes #1740`, `draft=true`, bot-authored → human merge). Awaiting `/review` (separate session) + merge |

Sources: `odd-platform@fb597e04` (auth files == origin/main, verified via `git show`), spec repo `odd_api.yaml`,
`odd-collector-sdk/.../datasource_api.py`, documentation `enable-security/README.md` + `ADR-0002`. Read 2026-06-22; no claim from memory.

---

## Review (2026-06-22, session: review-ctrib029, separate from /implement)

- **Result**: REJECTED → `blocked`. One decisive failure: **the FULL e2e regression cited as the G-C2/DoD
  integration evidence was run against a SUT image that does NOT contain the fix.** The fix CODE, unit tests,
  docs, ADR, scope, and product analysis are all SOUND — this is a verification-evidence failure, not a fix
  defect, and the rework is narrow.

### THE BLOCKER — integration regression ran against a no-fix image (G-C2 / G-C9-integration / DoD #11)

The DoD ledger + run-log commit `2b4f77c` + active-streams all assert the regression ran on **`c76e06df ← dc9b6422`**.
That is false. Verified by inspecting the compiled classes inside the images themselves:

| Image (tag) | digest | `IngestionAuthenticationFilter.class` in `/app/classes/.../auth/filter/`? |
|---|---|---|
| `odd-platform:odd-team-sut` (run-log SUT, live 18080 stack) | `c76e06df` (created 14:52) | **ABSENT** — only Abstract/DataEntities/DataSource/S2s filters |
| `odd-platform:odd-team-sut-ctrib029` (the per-stream tag the plan called for) | `0728c7b2` (created 15:16) | **PRESENT** (10,913 bytes) |

- `c76e06df` is a **no-fix build** (ctrib028/base on the shared `odd-team-sut` tag). **`dc9b6422` ADDS
  `IngestionAuthenticationFilter`**, so `c76e06df` provably cannot be a build of `dc9b6422`.
- **All four** CTRIB-029 regression run-logs (feature-complete PASS · ingestion-e2e PASS · multi-stack PASS ·
  known-bugs FAIL) cite `c76e06df`. **No run-log anywhere cites the fix image `0728c7b2`** — VERIFIED via
  `grep '0728c7b2' integration-tests/run-log/2026-06-22-*.md` → zero hits. The fix image was built but **never
  regression-tested.**
- Consequence: a green regression on a no-fix image substantiates **nothing** about the fix — neither that it
  works nor that it breaks no existing behaviour. The "FULL e2e regression GREEN-as-expected" claim is
  unsubstantiated. This is the SUT-provenance class the parallel-infra coordination + `LSN-032/033` exist to
  catch; root cause = the regression used the SHARED `odd-team-sut` tag instead of the per-stream
  `odd-team-sut-ctrib029` tag (the run-log HEAD auto-record limitation masked it).
- Per the `/review` 2-minute-bounce rule the reviewer is the CONFIRMER, not the first runner of the FULL
  regression — so this review did **not** re-run the e2e itself; re-running is the rework's DoD.

### What is SOUND (verified this review — so the rework is bounded)

- **The fix code (Gate 4 consumer-read · security correctness)** — PASS via reading `dc9b6422`:
  `IngestionAuthenticationFilter` gates `AND(/ingestion/**, NOT(/ingestion/entities OR /ingestion/datasources))`,
  `@ConditionalOnProperty auth.ingestion.filter.enabled=true` (identical to `IngestionDataEntitiesFilter`), eager
  header check (covers the body-less GET), fail-closed (proceeds only on `authenticate→true`; DB error propagates,
  not let through), collector-then-datasource token lookup, `getByToken` an exact mirror of the collector query
  incl. `addSoftDeleteFilter`. Matchers are disjoint from the two existing filters → no double-gating, order-independent.
- **Method-agnostic negation has no live gap** — VERIFIED via spec `odd_api.yaml:10-11,44-45`: the exact paths
  `/ingestion/entities` + `/ingestion/datasources` carry **only POST**. (Minor latent-hardening note, NOT a
  blocker: if a future GET/PUT is ever added to either exact path it would be excluded from the new filter and
  not caught by the POST-only dedicated filter — consider a method-aware exclusion when reworking the area.)
- **Test integrity (G-C9 unit · G-C15)** — PASS: the new `IngestionAuthenticationFilterTest` is a real fix-proof
  (real filter, only repos mocked; tokenless stats/metrics/alertmanager→401, body-less GET→401, valid
  collector/datasource→pass, unknown/non-Bearer→401, the two excluded paths pass through). The CHANGED
  `IngestionFilterPathCoverageTest` has **byte-identical assertions** (not weakened); it was re-grounded from a
  pin-of-bug to a correct design-invariant guard (the per-resource filter stays narrow → guards future
  double-gating) and CANNOT hide a broken fix (it tests a different filter). `@pins` removal is correct (the
  pinned behaviour is no longer buggy). `DataSourceRepositoryImplTest.getByTokenTest` (added, Testcontainers)
  covers found/unknown/**soft-deleted**.
- **Product corrections (G-C16)** — VERIFIED via spec: `degs/children` is a GET (line 76-77, disclosure not
  mutation); `POST /ingestion/alerts` is spec-declared but has no controller override (the real vector is the
  unspec'd `/ingestion/alert/alertmanager` webhook). Both as the work item claimed.
- **Docs (G-C10 docs half · Gate 11)** — PASS, accurate to the fix, on `release/0.29.0` @ `a7b19a8`:
  the enable-security matrix splits each sibling flag-false(OPEN)/flag-true(AUTH-token); the stats caveat
  correctly separates "flag closes the *unauthenticated* vector / the cross-dataset write shape remains" (matches
  the deferred per-resource-authz exclusion); the AlertManager `#authentication` subsection + `http_config` Bearer
  example resolves the two dangling cross-refs; notifications.md + ingestion-filters.md updated coherently.
  Gate 11 grep on the 7 touched files = only operator-domain "sidecar" (SSO/S3-proxy) hits → no audience leak.
  Minor doc-accuracy nit: ADR-0079 `description` says the uniform filter is "**replacing** the two exact-path
  filters" — the fix KEEPS both and ADDS a third; tighten to "supplementing / covering the gap they left".
- **Gate 8** — PENDING-RELEASE (0.29.0). Branch sub-checks pass (tree-relative links resolve; ADR description present).
  Post-merge live-URL list to verify at the release gate: `enable-security/`, `configuration-and-deployment/odd-platform/`
  (`#authentication`), `active-platform-features/notifications/`, `integrations/ingestion-filters/`,
  `developer-guides/architecture-decision-log/adr-0079-...`.
- **G-C3 plan-gate / G-C5 bounded scope / G-C7 ADR / G-C11 milestone / G-C12 design** — PASS: plan approved
  (RamanDamayeu 2026-06-22), diff is 6 files all within the approved scope, ADR draft + ADR-0079 published,
  milestone 0.29.0 open semver, the plan carries reuse-scan + ADR-check + impact checklist + PO/SRE lens.

### Secondary (fold into the SAME rework — not separately tracked, the rework touches these)

1. **Re-run BOTH regression buckets against a VERIFIED fix image** and re-record run-logs whose SUT digest's
   image actually contains `IngestionAuthenticationFilter.class` (inspect `/app/classes`, or pin the per-stream
   `odd-team-sut-ctrib029` tag, never the shared `odd-team-sut`). The unit-build claim (`:odd-platform-api:build`
   GREEN, 100% patch coverage) is plausible but its sibling evidence was mislabelled — re-establish it cleanly too.
2. **Ontology deferral (G-C10) — re-evaluate; the dirty-tree reason is now stale.** P-001's lineage residue is
   COMMITTED (@`212b214`) and the tree is clean, so the "no `/enrich` into a dirty tree" half of the deferral no
   longer holds. The "new node needs a substrate re-scan beyond `/enrich --touched`" half is still legitimate —
   so close it by running the targeted substrate re-scan of `auth/filter/**` (not just `--touched`) and commit,
   or re-state the justification.
3. **ADR-0079 description wording** (the "replacing" nit above).

- **Regressions (independently measured this review)**: NOT re-run — bounced before the confirmation e2e per the
  2-minute-bounce rule (the FULL regression is implement's DoD; the recorded one is invalid). No suites run → no
  `lineage/**` drift produced by this review.
- **Navigation**: consistent — no navigation pointers shifted (BE-only change; the new node's nav lands with the
  ontology refresh in item #2 above).
- **Banned-phrase check**: none used.
- **Upstream issues logged**: none (no upstream-code discovery; the blocker is our own verification evidence).
- **Doc-product editorial audit** (per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: PARTITIONED — covered the change's blast radius end-to-end as the doc owner
    (`enable-security/README.md`, `configuration-and-deployment/odd-platform.md` AlertManager+auth,
    `active-platform-features/notifications.md`, `integrations/ingestion-filters.md`, ADR-0079) → coherent, no
    contradiction / drift / cross-audience absence found. The full-tree editorial read is **queued for the
    post-rework `/review` pass** (when the docs are final), recorded in `state/PROGRESS.md`. Not skipped silently.
  - **Findings**: none surfaced this run.
- **Notes**: Fix is genuinely good work — the bounce is solely that its central correctness claim (the full
  regression) was measured on the wrong artifact. VERIFIED via docker image-class inspection of both candidate
  SUTs + a run-log digest sweep; nothing here is asserted from memory.

---

## Confirmation run (2026-06-22, maintainer-directed — reviewer's own FULL G-C2 regression on a verified fix image)

The maintainer directed "rebuild SUT from dc9b6422 and rerun the regression." This is the reviewer's own
full G-C2 run (which G-C2 calls for) on a SUT proven to contain the fix — closing the bounce.

**Build provenance (the guard that was missing before):**
- Rebuilt via `ODD_SUT=ref:dc9b6422 integration-tests/build-sut.sh` — a throwaway detached worktree at the
  EXACT commit → `odd-platform:odd-team-sut` digest **`sha256:35ca9385…`** (a fresh build, distinct from the
  no-fix `c76e06df` and the earlier `0728c7b2`).
- **VERIFIED the image contains `IngestionAuthenticationFilter.class`** (`docker run … ls /app/classes/.../auth/filter/`)
  BEFORE running — the driver aborts otherwise. Every suite's stack was digest-confirmed running `35ca9385`
  (`run-suite.sh`: "confirmed: the e2e stack is running the SUT image").

**Result — reviewer's own full regression on `35ca9385` (both buckets):**

| Bucket / suite | Result | Verdict |
|---|---|---|
| **Unit** — `:odd-platform-api:build` on the dc9b6422 worktree | **BUILD SUCCESSFUL 4m55s** (test + checkstyle + assemble + jacoco). New `IngestionAuthenticationFilterTest` **7/7**, changed `IngestionFilterPathCoverageTest` **2/2**, `DataSourceRepositoryImplTest` **8/8** (incl. new `getByTokenTest`) — 0 failures/errors (JUnit result XMLs) | ✅ GREEN |
| **feature-complete** | api:**PASS** · e2e **303 passed / 7 failed** | ✅ green-as-expected (7 explained below) |
| **multi-stack** | **9/9 passed** | ✅ GREEN |
| **ingestion-e2e** | **6/6 passed** | ✅ GREEN (the ingestion surface works with the fix, flag off) |
| **known-bugs** | **3/3 expected-RED**, **0 unexpected GREEN** (IT-007 LSN-001 attachment · IT-006 F-042 error-boundary · IT-004 PLT-052 quality-dashboard) | ✅ as-expected |

**The 7 feature-complete failures are ALL non-ingestion-auth, fully diagnosed:**
- **6 = CTRIB-028 (#1754) branch-skew** — `term-detail-page` (D1, D2), `term-linked-columns-pagination` (D4),
  `term-linked-terms-tab` (UC-005, D5, D7). All three spec files were last modified by `436b695 contrib(CTRIB-028):
  #1754 Term Detail hardening`; `git merge-base --is-ancestor 75fc06cd dc9b6422` = **NO** (dc9b6422 predates
  CTRIB-028). Proof of mechanism: `term-detail-page` D1 asserts the **CTRIB-028 #1754 Defect-2** "fetch
  `/api/terms/{id}` exactly once" — the un-CTRIB-028'd SUT fetches it **twice** (`Expected 1, Received 2`). The
  new filter is `@ConditionalOnProperty` off-by-default and matches only `/ingestion/**` — causally cannot touch
  `/api/terms/**`. **Contrast proof:** the bounced run was feature-complete **310/310 green on `c76e06df`** (a
  CTRIB-028 build — term hardening present → these 6 pass; ingestion-auth absent → I verified the class missing);
  on the genuine CTRIB-029 build they fail. The only image difference driving the 6 is CTRIB-028's unmerged work.
- **1 = the recurring TST-054 owner-association flake** — `remove-user-owner-mapping.spec.ts:123` (F-173 / PLT-148),
  the same FE admin-UI flake class confirmed transient across CTRIB-026/027; causally unrelated to a BE ingestion filter.

**Conclusion:** the ingestion-auth fix is **regression-clean** — nothing attributable to it fails; the ingestion
surface (multi-stack, ingestion-e2e, every ingestion/auth/stats/metrics/alertmanager spec in feature-complete) is
green, and the unit bucket incl. the fix's own tests is green. The bounce's central blocker (the fix was never
regression-tested) is **RESOLVED**. The merged state (CTRIB-029 + CTRIB-028) is expected fully green — the two are
orthogonal (BE ingestion filter vs FE/term-BE). Review repo left clean: the P-001 probe drift from the run was
`git checkout -- lineage/`-reverted; only the corrected run-logs (digest `35ca9385`) + this verdict + state were
committed.

**Verdict update: REJECTED → ACCEPTED → `review-ready`.** Residual (do NOT block review-ready; human GATE-2 owns
merge): (1) **ontology re-scan (G-C10)** still deferred — the dirty-tree reason is now stale (P-001 committed
@`212b214`), only the new-node substrate re-scan remains (a genuine new node beyond `/enrich --touched`); refresh
at the next substrate scan. (2) **ADR-0079 `description`** "replacing"→"supplementing" wording nit. (3) Process
root-cause (regression used the shared `odd-team-sut` tag, not the per-stream tag) — already tracked in the
parallel-infra findings doc's per-stream-SUT-tag ergonomics. **Human GATE-2 (merge of DRAFT PR #1799) owns `done`.**

---

## GATE 2 — MERGED (2026-06-22) → `pending-release`

Maintainer merged **PR #1799**. Verified against the remote (not inferred):
- `origin/main` top commit **`4028b4a6 fix(ingestion-auth): authenticate the whole /ingestion/** surface when the flag is on (#1740) (#1799)`** — squash-merge, `Closes #1740`.
- The merged tree contains `IngestionAuthenticationFilter.java` + `ReactiveDataSourceRepositoryImpl.getByToken` (`git show origin/main:…`).
- **Released == verified:** `git diff dc9b6422 origin/main` over all 6 fix files is **empty** — the released fix is byte-identical to the independently-reviewed + regression-confirmed commit. Nothing changed in the merge.

**Status `review-ready` → `pending-release`** (milestone `0.29.0`; the code is on `origin/main` but the release has not shipped). The `pending-release → done` flip is owed at **`/review release:0.29.0`**, which must:
1. **Publish the docs train** — merge documentation `release/0.29.0` (ADR-0079 + the enable-security matrix + the AlertManager `#authentication` subsection + notifications/ingestion-filters edits) to docs `main`, then **live-site-verify** the recorded URLs (Gate 8 PENDING-RELEASE).
2. **Real-instance verification** on the published `ghcr…:0.29.0` image — flag ON, tokenless `/ingestion/metrics|…/stats|…/alert/alertmanager|GET …/degs/children` → 401; flag OFF → open (the default-unchanged guarantee).
3. **Ontology re-scan** — the deferred new-node enrichment of `IngestionAuthenticationFilter` to the released tag, committed.
4. Full-suite GREEN on the published `0.29.0` image (both buckets).

The `odd-team-sut` tag + 18080 stack currently run the dc9b6422 build (`35ca9385`) from the confirmation run — unrelated to the release-gate work.
