---
ctrib: CTRIB-029
github_issue_number: 1740
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1740
title: "Ingestion auth filter only covers /ingestion/entities — sibling endpoints unprotected even when auth.ingestion.filter.enabled=true"
class: bug                    # security-posture gap (real, verified live on origin/main)
scope: backend
milestone: "0.29.0"          # open + semver (due 2026-06-22) → G-C11 PASSES (no hard stop)
status: pr-draft             # DRAFT PR #1799 open (GATE-2 entry). Code+tests committed+pushed (dc9b6422); feature-complete e2e GREEN; docs on release/0.29.0 (a7b19a8). Awaiting /review (separate session) + human merge.
reproduced: "STATIC-VERIFIED on origin/main (odd-platform fb597e04), 2026-06-22. SecurityConstants.java:96 whitelists /ingestion/** out of the auth chain; IngestionDataEntitiesFilter (exact /ingestion/entities, conditional) + IngestionDataSourceFilter (exact /ingestion/datasources, always-on) are the ONLY filters; AbstractIngestionFilter.java:38 falls non-matching paths straight through with no auth. Confirmed unprotected handlers: postDataSetStatsList (IngestionController.java:82), ingestMetrics (:90), getDataEntitiesByDEGOddrn GET (:76), alertManagerWebhook (AlertManagerController.java:21). LIVE repro DONE 2026-06-22 on the isolated ctrib029 stack (own image/ports, parallel to #1754) — RED (published release, flag ON, tokenless): /ingestion/metrics->201, /entities/datasets/stats->201, /alert/alertmanager->200, GET /entities/degs/children->200 (the gap); GREEN (my fix, flag ON, tokenless): all->401 'Ingestion token is missing'. See section 'Live reproduction'."
adr_required: true           # G-C7 FIRES — auth/security-posture change. ADR: adrs/drafts/ingestion-auth-filter-coverage.md (status: proposed). No code until approved.
plan_approved_by: RamanDamayeu
plan_approved_at: "2026-06-22"
plan_approved_scope: "Option 1 — single uniform /ingestion/** authentication filter (gated by auth.ingestion.filter.enabled); per-datasource authz on /ingestion/entities unchanged; INCLUDE the alertmanager webhook (maintainer amendment 2026-06-22 — all ingestion routes gated when the flag is on; 'open by default' caveat documented on 3 pages); DEFER default-flip + per-resource authz + the cross-dataset stats surface as logged follow-ups. ADDITIONALLY (maintainer 2026-06-22): publish the ADR in the documentation ADR-log + the enable-security matrix update on the release/0.29.0 train; build independent infra (per-stream worktree/image/stack) to run parallel to #1754."
docs_routing: "release/0.29.0"   # unreleased behaviour → documentation train (G-C11). The enable-security deployment matrix (OPEN→AUTH-token rows) + the 'tracked upstream' note update at release. Paired DOC item to be logged on approval.
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1799"
pr_draft: true
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
