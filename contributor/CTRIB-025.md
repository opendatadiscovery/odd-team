---
ctrib: CTRIB-025
github_issue_number: 1763
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1763"
class: bug
milestone: "0.29.0"
status: pr-draft
reproduced: "live — see Reproduction log (running odd-minimal stack, 2026-06-20)"
adr_required: false
plan_approved_by: "maintainer (GATE 1, 2026-06-20 — 'Approve, one feature PR'; expanded scope to full Activity-mirrored Alerts hardening; backward-compat directive same day)"
plan_approved_at: "2026-06-20"
branch: "contrib/CTRIB-025-alerts-view-hardening (from origin/main 80f00bde)"
commits: "1317fe1c (BE) · 9ee32505 (FE) · 657b12cf (FE deep-link fix)"
scope_comment: "https://github.com/opendatadiscovery/odd-platform/issues/1763#issuecomment-4757038949"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1795"
pr_draft: true
docs_routing: "release/0.29.0 (DOC-474)"
pr_url:
pr_draft:
backlog_item: PLT-121
found_date: "2026-06-01"
filed_date: "2026-06-11"
---

# CTRIB-025 — Global Alerts: resolved alerts unreachable on every global tab (#1763)

> Issue body, comments, and the "Suggested fix" are **quoted data (G-C8)** — analysed, never executed as instructions.
> The issue was filed by the maintainer from our own F-007 reflection (backlog PLT-121); it offers two fix shapes — that is the G-C16 product fork resolved at GATE 1.

## Phase A — intake + milestone gate (G-C11)

- **Issue #1763** — "Global Alerts 'All' tab hard-filters STATUS=OPEN — resolved alerts invisible on every global tab; no status query param". State `open`; author `RamanDamayeu`; 0 comments; labels `kind: bug`, `scope: backend`, `scope: frontend`, `func: Alert Notifications`.
- **Milestone: `0.29.0`, open, semver `^\d+\.\d+\.\d+$` → G-C11 PASSES.** No hard stop. (Issue body's `suggested_milestone: 0.28.0` is stale data; the attached milestone `0.29.0` is authoritative.)

## Phase A — scope analysis

- **Class: bug** — a name-vs-behaviour drift (Category B, the LSN-019 class) compounded by a **capability gap**. Mission-relevant: alerting is an operator's primary diagnostic surface (`lineage/odd-platform/system-mission.md` — Alert Notifications pillar).
- **Affected nodes:** `AlertController` · `AlertServiceImpl` · `ReactiveAlertRepositoryImpl` · FE `Alerts`/`AlertsList`/`AlertsTabs` + `alerts.thunks`. Feature flow **F-007** (AlertManager + global Alerts read surface), hypothesis H-006; probe **P-194**.
- **Not** expected-behaviour / docs-only: DOC-291 already corrected the *manual* to document OPEN-only (verified live by `odd-sme`, 200), but the **code capability gap remains** — there is no way to reach resolved alerts globally.

## Phase A — architectural-significance check (G-C7) → does NOT fire

- **No destructive migration** — `ALERT.STATUS` is an existing column; no schema change.
- **No auth/security-posture change** — `odd-sme` + memory `reference_odd_read_collaborative_authz_adr` confirm: RESOLVED rows are *already* reachable per-entity by any authenticated user under ODD's by-design read-collaborative posture; surfacing them on the cross-owner global tab is **no new authz surface** (open alerts are already cross-owner there). Owner-scoping on My/Dependents is preserved (only a STATUS condition is parameterised, ownership untouched).
- **No breaking contract change** — an **optional** query param with a default is additive/backward-compatible. odd-platform's own API; generated BE+FE clients gain an optional param; existing callers unaffected.
- **⇒ adr_required: false.** ADR-check (G-C12) below conforms to an existing pattern; no new ADR.

## Phase B — Reproduction log (G-C1) — live, running system

Stack: the already-up `odd-minimal` SUT (`probe-odd-platform` :18080 / `probe-database` :15432, `AUTH_TYPE=DISABLED`). Alert code is identical to `origin/main` (CTRIB-024 touched only DQ run-history). Status codes verified from source — `AlertStatusEnum`: **OPEN=1, RESOLVED=2, RESOLVED_AUTOMATICALLY=3** (P-194's note "OPEN=0" was wrong; `db.ts` seed `status=1`=OPEN is right).

Seeded on a fresh entity 9201: alert **id=11 OPEN** (status=1) + alert **id=12 RESOLVED** (status=2), each with a chunk (the list INNER-JOINs `alert_chunk`).

```
# GLOBAL  GET /api/alerts?page=1&size=30   → ids [9, 10, 11]   (the 3 OPEN alerts; RESOLVED 12 ABSENT)
# PER-ENT GET /api/dataentities/9201/alerts → ids [11, 12]      (BOTH — incl. RESOLVED 12)
DB: status=1 alerts=3 (ids 9,10,11) · all alerts=12 · id12 status=2 RESOLVED, chunked
```

(NB the live wire is **snake_case** — `data_entity`/`page_info`; a first camelCase read falsely showed 0 — corrected. Recorded so the IT asserts the real shape, per G-C15/IT-137.)

**Observed = the user-facing symptom:** a RESOLVED alert is retained and visible on its entity's Alerts tab, but **invisible on the global Alerts page**, with **no `status` parameter to request it**. A steward who resolved an alert cannot find it globally and may conclude it was purged.

## Phase B — Root cause

Three repository list methods hard-code the status filter; the three controller endpoints + spec ops expose no `status` param to override it:

| Tab | Controller (`AlertController`) | Service (`AlertServiceImpl`) | Repository (`ReactiveAlertRepositoryImpl`) — hard filter |
|---|---|---|---|
| All | `getAllAlerts` :36 | `listAll` :77 | `listAllWithStatusOpen` — `.where(ALERT.STATUS.eq(OPEN))` **:145** |
| My Objects | `getAssociatedUserAlerts` :44 | `listByOwner` :83 | `listByOwner` — `…eq(OPEN)` **:166** |
| Dependents | `getDependentEntitiesAlerts` :52 | `listDependentObjectsAlerts` :234 | `listDependentObjectsAlerts` — `…eq(OPEN)` **:230** |

`ALERT.STATUS` is an available-but-unused column on these list queries. The per-entity `getAlertsByDataEntityId` (:182) has **no** status filter — which is why the data is reachable there.

## Phase C — Change-request product analysis (G-C16)

**User-observable problem, independent of the issue's proposed solution:** on the global Alerts page there is no way to see RESOLVED / RESOLVED_AUTOMATICALLY alerts; the audit / postmortem workflow ("what fired and was resolved last week") is impossible without already knowing the asset. Secondarily, the "All" tab label names the *object-scope* axis but silently pins the *status* axis to OPEN, so a user reads "All" as all-alerts and concludes resolved ones were purged.

**SME / Product-Owner grounding** (`lineage/odd-platform/sme-consultations/2026-06-20-global-alerts-status-filter.md`, confidence HIGH):
- Verified competitor norm — **Grafana** (rule-state filter), **Datadog** (`status:` facet), **PagerDuty** (Triggered/Ack/Resolved, default Open). Status is an *exposed, operable* axis with an **open-leaning default** and **resolved reachable from the same global surface**. ODD matches the open-default half, breaks the global-reachability half → **genuine product gap**.
- ODD's own live manual (DOC-291) accurately documents OPEN-only — so this is a documented *capability decision*, not a docs-lie; if we add the capability, that sentence rides the 0.29.0 train.
- The "All" defect is real **independent** of the capability gap.
- Carry-forward: a global resolved view will also surface gaps left by the known `AlertHousekeepingJob` jOOQ purge bug (`concepts.yaml:371`) for manual-RESOLVED alerts past TTL — pre-existing, separate; arguably *good* that it becomes visible. No action here.

**Options (incl. reshape / rescope / revoke):**

| Option | What ships | Operator outcome | Cost / risk |
|---|---|---|---|
| **A — status filter (BE param + FE control), default OPEN** *(recommended)* | optional `status` on the 3 endpoints + a status selector on the global page | resolved alerts become reachable globally; "All" no longer misleads (status explicit) | BE small + FE moderate; additive, backward-compatible; overlaps only the *status* slice of PLT-050 |
| **B — relabel "All" → "Open" only** | 1 FE label + i18n; no BE | label stops lying, but the capability gap **remains** (still can't see resolved globally) | tiny; but a band-aid — lowers the promise instead of fixing it |
| **C — BE param only, defer UI to PLT-050** | spec+BE param + tests; no FE | API capability exists; operator still can't reach resolved until PLT-050 lands | BE-only; ships a half-finished surface (issue is `scope: frontend`) |

**Recommendation: Option A, default OPEN.** It is the product-right shape (SME-confirmed), the only one that closes the real bug (resolved reachable globally), and it conforms to an existing codebase pattern. B is a correct *subset* of A but leaves the gap (acceptable only as a fallback if A is out of budget). C risks a BE-shell. **This is the GATE-1 decision** — the issue offered A-or-B and did not decide; I recommend A.

## Phase C — Design before build (G-C12)

**(a) Reuse-scan — conform, do not invent:**
- **Spec:** `getRuns` (`openapi.yaml:1372`) already declares an **optional** `status` query param (`required: false` + a status enum `$ref`). `getDataEntityAlertsCounts` (:1347) already uses the `AlertStatus` enum as a query param. → add the *identical* shape to the 3 alert ops; **no new model** (`AlertStatus` enum already = {OPEN, RESOLVED, RESOLVED_AUTOMATICALLY}).
- **Repo:** `getAlertsCountByDataEntityId(id, AlertStatusEnum)` (:202) is the exact nullable-`AlertStatusEnum` conditional-filter precedent. → parameterise the 3 list methods the same way.
- **FE:** the global list is a generic `AlertsList` driven by a `fetchAlerts` thunk; a status value threads through the existing `fetch…({page,size})` calls. Reuse an existing select/segmented control (mirror the run-status filter UX) rather than a new component — confirm the concrete component in Phase D.

**(b) ADR-check:** no existing/implicit ADR constrains alert-list status params; the optional-typed-status-query-param is an established convention (`getRuns`). **Conform; no new ADR.**

**(c) Impact-dimension checklist:**
- **Spec** `openapi.yaml` — 3 ops gain `status` (optional). · **Generated BE client** (`AlertApi`) + **FE client** (`AlertApiGet*Request`) regenerate (BE: delete `build/generated` to force; FE: docker codegen, no Node 24 needed).
- **BE consumers** of the 3 service signatures: only `AlertController` (in-repo) — updated. Repo method signatures change → all callers in `AlertServiceImpl` updated.
- **Default semantics (backward-compat):** `status == null` → **OPEN** applied in the service, so `GET /api/alerts` with no param is **unchanged**. The repo always receives a non-null `AlertStatusEnum` → minimal SQL diff (`eq(OPEN)` → `eq(status)`).
- **Counts/badge:** `getTotals` stays OPEN-based (the tab badge = "open / needs-attention" count, orthogonal to the view filter) — a deliberate choice, documented; NOT made status-aware (avoids scope creep; flagged for maintainer veto).
- **i18n:** new label keys (e.g. `Status`, `Open`, `Resolved`, `Resolved automatically`) added to **all 7** locale files (br/en/es/hy/fr/ch/ua) + pass `i18n-key-parity.test.ts`; use `t()` (no hardcoded strings — PLT-205 class).
- **Migration:** none. · **Docs:** the DOC-291 sentence updates on the `release/0.29.0` train (below). · **Ontology:** F-007, P-194, the 4 touched sidecars re-enriched.

**(d) Product-Owner / SRE lens:** default OPEN keeps the page's default load = active-problems-first (correct; no perf regression — paginated, default path unchanged). Resolved/auto-resolved exposed as explicit choices (1:1 with the data model; honest). No "All-statuses" value (enum has none) — out of scope; a future list-param enhancement if wanted (logged, not built).

## Phase C — The Plan (NARROW — SUPERSEDED at GATE 1; see "REVISED PLAN" below)

> At GATE 1 the maintainer expanded the scope from the narrow status-param fix to a **full Alerts-view hardening modeled on the Activity page**. The narrow plan below is retained for the analysis trail; the **REVISED PLAN** section at the end is authoritative.

**Scope (Option A):**
1. **Spec** — add optional `status: AlertStatus` (`required: false`) query param to `getAllAlerts` / `getAssociatedUserAlerts` / `getDependentEntitiesAlerts` in `openapi.yaml`.
2. **BE** — `AlertController` passes `status` through; `AlertService(/Impl)` `listAll`/`listByOwner`/`listDependentObjectsAlerts` gain a nullable `AlertStatus`, convert to `AlertStatusEnum` defaulting **OPEN** when null; `ReactiveAlertRepositoryImpl` 3 methods take the `AlertStatusEnum` and filter by it (the hard `eq(OPEN)` becomes `eq(status)`).
3. **FE** — regenerate the client; thread a `status` (default Open) through the 3 alert thunks; add a status selector on the global Alerts page; reset the infinite-scroll list on change (reuse `changeAlertsFilterAction`); i18n × 7.
4. **Tests** — unit: `AlertServiceImplTest` (status plumbs + OPEN default, Mockito) [+ a repo-level Testcontainers `BaseIntegrationTest` for the SQL filter if the pattern exists]. integration: **extend IT-030** — seed OPEN+RESOLVED; assert RESOLVED absent by default + reachable when the status control = Resolved (RED on `ref:main`, GREEN on the fix).
5. **Docs** — update the alerting page's "global tabs list open alerts only" sentence to describe the status filter, on `documentation@release/0.29.0` + a paired backlog DOC item (`milestone: 0.29.0`, post-merge URL).
6. **Ontology** — `/enrich --touched` the 4 sidecars; refresh F-007/P-194; re-embed; commit.

**Explicit scope EXCLUSIONS (G-C5) — deliberately NOT in this PR (remain with PLT-050):** the broader Alerts filter cluster — type/date/entity-name filters, bulk-resolve, the hardcoded `size=30` page-size selector, the default-tab redirect, the hidden-but-navigable My/Dependents routes. Also excluded: making `getTotals` status-aware; an "All-statuses" param value; the `AlertHousekeepingJob` purge bug. This PR delivers **only** the status dimension (param + selector).

**Public scope note:** the PR covers exactly what #1763 asks (status param + a UI to use it); it does **not** narrow the issue. A concise root-cause + approach comment (what ships / what stays with the broader Alerts UX work) posts after GATE 1 (folded into one comment, ASCII, no workspace IDs — G-C5 / rate-limit).

## Ledger (live)
- Reproduction: live (above). · SME: `…/sme-consultations/2026-06-20-global-alerts-status-filter.md`.
- Branch `contrib/CTRIB-025-alerts-view-hardening` (from origin/main 80f00bde). Scope comment posted: `#issuecomment-4757038949`.
- **BE: DONE + committed `1317fe1c`** (re-done ADDITIVE per the 2026-06-20 directive — supersedes the earlier breaking `9717408c`, which was reset away). Branch reset to origin/main → clean single additive commit. Legacy endpoints byte-identical + `deprecated: true`; NEW: `getAlertsList` (/api/alerts/list), `getAlertCounts` (/api/alerts/counts), `getDataEntityAlertsList` (/api/dataentities/{id}/alerts/list); models `AlertViewType` + `AlertCountInfo`. Inner-loop build GREEN: regen + compile + checkstyle(both sets) + `*AlertServiceImplTest` (10 tests: legacy guards + new type-dispatch/status-plumbing/counts). Kept **offset pagination + bare `Alert[]`** (FE infers hasNext from length); tab discriminator `AlertViewType` (`AlertType` is the alert kind).
- **FE: re-launching** (mirror Activity → tabs/filters/status/list/per-entity/i18n; points at the NEW endpoints getAlertsList/getAlertCounts/getDataEntityAlertsList; legacy endpoints coexist deprecated, no FE caller; subagent).
- **Docs: READ** (`documentation/docs/active-platform-features/alerting.md` + `…/api-reference/alerts.md`); update pending on `release/0.29.0` (rewrite the DOC-291 "open-only" hint → resolved reachable via Status; 3→4 tabs; endpoint renames; retire the moot routing/filter UX-limitation notes).
- **FE: committed `9ee32505`** (mirror Activity; tsc/eslint/i18n-key-parity green per subagent). Notable: generalised the 5 shared `ActivityFilterItems` over the query shape (Activity call sites unchanged; regression covers Activity via IT-126/IT-129).
- **IT-030 extension caught a REAL bug (running-system verification payoff, LSN-031):** on `/alerts?status=RESOLVED` the page showed "Unknown Error" + no `/api/alerts/list` request. Root cause: `useQueryParams` (shared hook) returns ONLY the URL params for a non-empty URL (no merge with defaults), so a partial/deep-linked alerts URL drops the required `size`, and the generated `getAlertsList`/`getDataEntityAlertsList` throw synchronously on the missing required param → thunk rejects → AppErrorPage. NOT caught by tsc/eslint/the subagent's checks — only by driving the running page. **Fix:** always send the structural `size` explicitly in the global (`AlertsList`) + per-entity (`DataEntityAlerts`) fetches, without defaulting `status` (so the "All statuses" option still clears). Bounded local fix; the broader `useQueryParams` no-merge footgun (latent for Activity too) noted as a follow-up, not fixed here (shared-hook risk).
- **FULL regression (feature-complete):** 1st run 302/303 — the only fail was MY #1763 test's isolation (the cross-platform "All" tab is polluted by other specs' open "Failed DQ test" alerts vs a bare type-label assertion); NO code regression (Activity ITs + all alert ITs green). Fixed the test to assert on two dedicated uniquely-named seed entities (one open-only, one resolved-only) — RED-on-main preserved (G-C15). Re-running to confirm 303/303.
- **Docs: AUTHORED on `documentation@release/0.29.0`** (commit `d8758e2d`, not pushed; maintainer pushes the train). alerting.md (4 tabs + filters + resolved-reachable; retired the moot caveats) + api-reference/alerts.md (new ops primary; legacy in Deprecated tables + migration) + fixed 2 inbound cross-refs broken by the tab rename (catalog-overview.md, owners.md). Tracked by DOC-474 (live-URL verify at the 0.29.0 release gate).
- Integration (IT-030): GREEN isolated; full re-run in progress · Ontology: _in progress (subagent)_.

---

# REVISED PLAN (authoritative) — full Alerts-view hardening, modeled on Activity

**Maintainer direction at GATE 1 (quoted data):** *"Harden the Alerts View and make it similar to Activity so that for Alerts we also have All, My Objects, Downstream, Upstream tabs, and filters Period, Datasource, Namespace, Tag, Owner and Status with default value for Status set to Open. For Alerts on Data Entity level also add filters Period, Status. In any case Order by event datetime desc."*

The narrow status-param fix becomes a **subset** of this. The whole feature is a near-mechanical **mirror of the shipped Activity feature** — the strongest possible reuse story (G-C12): the architecture already exists, proven, in `Activity*`; we port it onto `Alert*` and add a Status dimension.

## Reuse map (Activity → Alerts) — G-C12, the design IS the mirror

| Concern | Activity (the shipped template) | Alerts (mirror) |
|---|---|---|
| Tab axis | `ActivityType {ALL, MY_OBJECTS, DOWNSTREAM, UPSTREAM}` + query-param `type` | reuse `ActivityType`-shaped enum **`AlertType`** (same 4 values) |
| Tab dispatch | `ActivityServiceImpl.getActivityList` switch on `type` | `AlertServiceImpl.getAlertList` — same switch |
| Lineage tabs | `DataEntityRelationsService.getDependentDataEntityOddrns(UPSTREAM/DOWNSTREAM)` | **reuse the same service** — no new lineage code |
| Counts/badges | `getActivityCounts` → `ActivityCountInfo{total,myObjects,downstream,upstream}` | `getAlertCounts` → new `AlertCountInfo` (same 4) — replaces `AlertTotals` |
| Pagination/order | keyset `last_event_id`+`last_event_date_time`, event-datetime DESC | keyset on `alert.last_created_at DESC, alert.id DESC` (already the order) |
| Filters (shared FE) | `CalendarFilter` (Period) · `SingleFilter` (Datasource, Namespace) · `MultipleFilter` (Tag, Owner) under `components/shared/elements/Activity/` | **reuse the same shared components** + add a Status `SingleFilter` |
| Tabs (FE) | `ActivityResults/ActivityTabs.tsx` | mirror → `AlertsTabs.tsx` (4 tabs + `AlertCountInfo`) |
| Filter panel (FE) | `Activity/Filters/Filters.tsx` | mirror → `Alerts/Filters/Filters.tsx` |
| Query-param state | `useQueryParams<ActivityQuery>` + `common.ts` | mirror → `AlertsQuery` |
| Per-entity | `getDataEntityActivity` (Period + keyset) + `DataEntityActivity/Filters` | mirror → `getDataEntityAlerts` + Period + **Status** |

## API (spec — `openapi.yaml` + `components.yaml`), mirroring the Activity ops

- **`GET /api/alerts`** (rework) → params: `type` (`AlertType`, default ALL), `begin_date?`, `end_date?` (Period — **optional**, see decision D2), `datasource_id?`, `namespace_id?`, `tag_ids?`, `owner_ids?`, `status?` (`AlertStatus`), `last_event_id?`, `last_event_date_time?`, `size`. Returns `Alert[]` (keyset). **Replaces** `GET /api/alerts/my` + `/api/alerts/dependents` (their function = `?type=MY_OBJECTS|DOWNSTREAM`, plus new `UPSTREAM`).
- **`GET /api/alerts/counts`** (replaces `/api/alerts/totals`) → same filter params → `AlertCountInfo{total,myObjects,downstream,upstream}` (mirror `getActivityCounts`).
- **`GET /api/dataentities/{id}/alerts`** (rework) → `begin_date?`, `end_date?`, `status?`, `last_event_id?`, `last_event_date_time?`, `size` → `Alert[]` (keyset).
- New model **`AlertCountInfo`** (mirror `ActivityCountInfo`); new **`AlertType`** enum (mirror `ActivityType`). `AlertStatus`/`AlertList`/`Alert` already exist. `PUT /api/alerts/{id}/status` unchanged.

## BE (`odd-platform-api`)
- `AlertController` — new method signatures (regen) passing the filter set + `type`/`status`/keyset through.
- `AlertService(/Impl)` — `getAlertList(...)` switch on `type` (reuse `DataEntityRelationsService` for DOWNSTREAM/UPSTREAM, mirror `fetchMy/fetchDependent`); `getAlertCounts(...)` (mirror `getActivityCounts`); `getDataEntityAlerts(...)` + Period/Status/keyset.
- `ReactiveAlertRepository(/Impl)` — `findAllAlerts/findMyAlerts/findDependentAlerts` + `count*` variants, each taking Period + datasource/namespace/tag/owner joins + **status** + keyset, ordered by `last_created_at DESC, id DESC` — mirroring `ReactiveActivityRepositoryImpl`'s filter+keyset query building. The hard `eq(OPEN)` is gone; status is a parameter (null → no status filter, see D1).
- `AlertMapper` / `AlertCountInfo` mapping.

## FE (`odd-platform-ui`)
- Regenerate the client (docker codegen, no Node 24). Rework `Alerts/` to mirror `Activity/`: `AlertsTabs` (4 tabs + `AlertCountInfo`), a `Filters` panel reusing the shared `CalendarFilter`/`SingleFilter`/`MultipleFilter` (Period, Datasource, Namespace, **Status** [single, default Open], Tag, Owner), `AlertsList` on keyset + `useQueryParams<AlertsQuery>` (tabs become query-param `type`, not routes → removes `AlertsRoutes` per-tab routing). Per-entity `DataEntityAlerts` gains a Period + Status filter (mirror `DataEntityActivity/Filters`). i18n × 7 — most labels (All/My Objects/Downstream/Upstream/Datasource/Namespace/Tag/Owner/Period/Filters/Clear All) already exist from Activity; net-new ≈ `Status`/`Open`/`Resolved`/`Resolved automatically`.

## What this subsumes / closes
- **#1763** — fully (resolved alerts reachable via Status; "All" no longer misleads; status explicit).
- **PLT-050** — Defect 2 (default-redirect) + Defect 3 (hidden-but-navigable routes) become **moot** (query-param tabs, no per-tab routes); Defect 4 (no global filter UI) + the hardcoded `size=30` (Defects 1/4) **resolved** (real filters + keyset `size`); Defect 1 per-entity filter **resolved** (Period+Status). Remaining PLT-050 (bulk-resolve, export) stays out (D3).

## Explicit scope EXCLUSIONS (G-C5)
Bulk-resolve / bulk-select; CSV/export; alert **type** filter and **event_type** filter (Activity has them; the maintainer did not ask — not added); the `AlertHousekeepingJob` purge bug (`concepts.yaml:371`, separate). The per-entity `alerts/counts` endpoint stays as-is unless the rework requires it.

## ⚠ DIRECTIVE 2026-06-20 (maintainer, post-GATE-1) — backward compatibility, ADDITIVE not breaking

The maintainer **reversed D4** (the breaking consolidation): *"keep the semantic of the legacy BE for backward compatibility with a deprecation warning, so a later version can drop them; create a NEW, more flexible/capable API for the new FE; provide a migration note; the previous BE endpoints must work EXACTLY as 0.28.0 — keep working endpoints as-is."*

**Revised API design — ADDITIVE:**
- **Legacy (kept byte-identical to 0.28.0, marked `deprecated: true`):** `GET /api/alerts` (`getAllAlerts`, OPEN-only, page/size → `AlertList`) · `/api/alerts/my` (`getAssociatedUserAlerts`) · `/api/alerts/dependents` (`getDependentEntitiesAlerts`) · `/api/alerts/totals` (`getAlertTotals` → `AlertTotals`) · `GET /api/dataentities/{id}/alerts` (`getDataEntityAlerts`, page/size → `AlertList`). **No behaviour change** — restored exactly; the original repo/service/controller methods come back.
- **New (the capable API for the new FE):** `GET /api/alerts/list` (`getAlertsList`, type + Period/Datasource/Namespace/Tag/Owner/Status → `Alert[]`) · `GET /api/alerts/counts` (`getAlertCounts` → `AlertCountInfo`) · `GET /api/dataentities/{id}/alerts/list` (`getDataEntityAlertsList`, Period/Status → `Alert[]`). `AlertViewType` + `AlertCountInfo` models stay.
- **Migration note** (docs, release/0.29.0): `getAllAlerts` → `getAlertsList?type=ALL&status=OPEN`; `getAssociatedUserAlerts` → `…?type=MY_OBJECTS`; `getDependentEntitiesAlerts` → `…?type=DOWNSTREAM` (+ new `UPSTREAM`); `getAlertTotals` → `getAlertCounts`; `getDataEntityAlerts` → `getDataEntityAlertsList`.
- The new **FE** points at the NEW endpoints; the new page replaces the old alerts UI (the legacy endpoints have no FE caller — they exist for external API consumers until removed). **Sequencing:** fold this in as the in-flight FE mirror lands (avoid a codegen race), then rename the FE thunks to the new operationIds.

## Decisions made (Principal calls — flagged for veto at GATE 1; D4 SUPERSEDED by the directive above)
- **D1 — status null-semantics:** the BE `status` param is uniform: **null → no status filter (all statuses)**. The FE sets the *default selection* per surface: **global = Open** (sends `status=OPEN`, preserving today's default + "active first"); **per-entity = All** (sends nothing, preserving today's resolved-visible behaviour — a default of Open there would *hide* resolved history, a regression). "All statuses" is expressible (no param). 
- **D2 — Period optional:** unlike Activity (begin/end required), Alerts Period is **optional** (null → all-time), so the default global view stays "all open alerts," not "open alerts in a default window."
- **D3 — counts honor the filters incl. status (mirror Activity):** so the tab badge always matches the visible list (default status=Open → badges = open counts = unchanged). No badge-vs-list contradiction.
- **D4 — consolidate to one `type`-driven endpoint + keyset (true Activity mirror):** replaces the 3 list endpoints + `/totals` + offset pagination. This is a **breaking change to odd-platform's own REST contract** (internal consumer = its FE, updated here). Surfaced for GATE-1 sign-off (G-C7); it conforms to the *existing* Activity pattern, so no new ADR is proposed (an ADR recording "Alerts conforms to the Activity list/filter/keyset architecture" can be added if wanted).

## Tests (G-C9, both buckets)
- **Unit (odd-platform CI):** `AlertServiceImplTest` — `type` dispatch (ALL/MY/DOWNSTREAM/UPSTREAM → right repo call + lineage-service reuse), status plumbing, counts; repo-level `BaseIntegrationTest` (Testcontainers) for the filter + keyset + status SQL (seed OPEN+RESOLVED across entities/datasources/tags/owners + lineage; assert each tab + each filter + status default + event-datetime-DESC order). Mirror the existing Activity repo tests if present.
- **Integration (odd-team, extend `IT-030`):** drive the real UI — the 4 tabs, the filter panel, Status default Open (resolved absent by default, **reachable when Status=Resolved** — the #1763 RED→GREEN on `ref:main`), ordering event-datetime-desc; a per-entity Period+Status assertion. RED on `ODD_SUT=ref:main`, GREEN on the working tree. Then the FULL regression (`feature-complete`/`multi-stack`/`known-bugs`/`ingestion-e2e`).

## Docs (G-C10/G-C11) + Ontology
- **Docs:** the alerting page — new tabs (Downstream/Upstream), filters, and resolved-reachable behaviour — on `documentation@release/0.29.0` (the DOC-291 "open alerts only" sentence is rewritten) + a paired backlog DOC item (`milestone: 0.29.0`, post-merge URLs). Read the live page first.
- **Ontology:** `/enrich --touched` the AlertController/Service/Repo + Alerts FE sidecars; refresh F-007 + P-194; re-embed; commit.

## Proposed structure / sequencing
One feature branch `contrib/CTRIB-025-alerts-view-hardening`, logical per-area commits (spec → BE → FE global → FE per-entity → tests → docs/ontology), one DRAFT PR `Closes #1763` (noting the PLT-050 defects it resolves). Given the size, it can also stage as **Stage 1** (BE + global FE: tabs/filters/status/counts/keyset — closes #1763's core) then **Stage 2** (per-entity filters) — maintainer's call at approval.

## Public scope comment (post after GATE 1, before code — G-C5)
One ASCII comment on #1763: the PR hardens the global + per-entity Alerts views to match Activity (All/My Objects/Downstream/Upstream tabs; Period/Datasource/Namespace/Tag/Owner/Status filters, Status default Open; ordered newest-first; resolved alerts now reachable), and notes bulk-resolve/export remain out of scope.
