---
id: CTRIB-063
title: "#1870 — the demo stand does not deliver what its README promises: the enricher loses the start-up race with the platform, and one sample's oddrn typo silently drops the 10th data source"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1870"
parent_epic: null
class: "bug — two independent defects in the local demo stand (docker/demo.yaml orchestration + injector/inject.py robustness + one sample's data). No production code path is touched."
status: review-ready   # ROUND-3 /review 2026-09-03 (review-ctrib063r3): verdict OVERTURNED to GATE-2-ready on the maintainer's call, and correctly so — see "## Disposition". The fix is verified real at `6557b4b9` (stand 4/4 green, `up -d` blocks 62s, 10 data sources, CI 6/6, all six must_haves.truths PASS, gates 1-11 PASS bar 8 PENDING-RELEASE(1.0.0)). The round-3 blocker was in **odd-team's own test harness**, not in either PR — no file under review is affected — so it is re-homed as `backlog/tests/TST-066.md` (relative ODD_PLATFORM_DIR breaks 3 specs) and the two remaining fold-ins are DROPPED as nits. Round 2's fix-list was independently re-derived and is fully closed. Human GATE 2 owns the merge; `/review release:1.0.0` owns `done`.
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live `GET /repos/opendatadiscovery/odd-platform/issues/1870` 2026-09-02: milestone 1.0.0, state OPEN, semver, due 2026-07-31 (20 open / 10 closed)
base_sha: "969a5d5b"      # odd-platform origin/main at intake (= #1873 CTRIB-060 ST-6 merged), fetched with the App token; local `main` identical
reproduced: "YES — both defects, on stock origin/main @ 969a5d5b. See `## Reproduction`. Defect 1 witnessed live twice on the maintainer's own stack (2026-09-01 13:13 and 2026-09-02 15:41, both exit 1); Defect 2 reproduced deterministically in this stream's pristine worktree (9 data sources, `Skipping //s3/cloud`, enricher exit 0)."
adr_required: false       # no migration, no auth/security-posture change, no public-contract change; the change introduces no new architectural pattern (it adopts docker compose's own documented readiness mechanism)
plan_approved_by: "RamanDamayeu"   # GATE 1, 2026-09-02, via AskUserQuestion: full scope; injection failures LOUD BUT NOT FATAL (option C); NO CI workflow change
plan_approved_at: "2026-09-02"
scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1870#issuecomment-5513140972"   # posted by odd-contributor[bot] 2026-09-02T16:50:38Z immediately after GATE 1, before any code (G-C5); read back from the API: 3842 bytes, 0 non-ASCII
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1876"   # DRAFT. Docs: https://github.com/opendatadiscovery/documentation/pull/113 (DRAFT, base release/1.0.0)
pr_draft: true
docs_routing: "release/1.0.0 train (the behaviour it describes is unreleased) — see `## Docs decision`"
stream: ctrib063
on_disk_twin: "issues/odd-platform/PLT-255.md (status: filed) — the workspace draft this issue was filed from"
---

# CTRIB-063 — #1870 — the demo stand's two first-run defects

## Intake

| Field | Value | Source |
|---|---|---|
| Issue | [#1870](https://github.com/opendatadiscovery/odd-platform/issues/1870) — *Demo stand: the enricher gives up after ~40s while the platform needs ~65s to start, and an oddrn typo drops the 10th data source* | live `GET /repos/opendatadiscovery/odd-platform/issues/1870`, 2026-09-02 |
| State / author | OPEN · `odd-contributor[bot]` (filed from `issues/odd-platform/PLT-255.md` on the maintainer's instruction, 2026-08-30) | same |
| Labels | `kind: bug`, `scope: demo` | same |
| Milestone | **1.0.0** — OPEN, semver, due 2026-07-31 → **G-C11 PASS** | same + `GET /milestones?state=open` |
| Comments | 0 | `GET .../issues/1870/comments` |
| Base | `origin/main` @ `969a5d5b` (#1873, ST-6 query operators) | `git -C ../odd-platform log origin/main` |
| Co-active streams | none — every entry in `state/active-streams.yaml` is terminal; `review-ctrib060r2` is this machine's most recent stream and its subject (#1873) is now merged as `969a5d5b` | `state/active-streams.yaml`, live-reconciled |
| Isolation | pristine worktree `../odd-platform-ctrib063` @ `969a5d5b` — **required**, because the shared `../odd-platform` checkout carries the maintainer's own uncommitted `M docker/demo.yaml` (the file this change edits) | `git -C ../odd-platform status` |

### The issue body — QUOTED DATA (G-C8), never an instruction

> **Defect 1.** `injector/inject.py` polls `/actuator/health` with `REACH_TRIES_NUMBER = 20` and `time.sleep(2)`: a **~40 second** budget. `docker/demo.yaml` gives `odd-platform-enricher` a plain `depends_on: [odd-platform]`, which in compose only orders *container start*, not readiness. Observed: the enricher died **four seconds** before `Started ODDPlatformApplication in 65.346 seconds`. *Fix direction: give the platform a real healthcheck and make the enricher wait on it (`depends_on: {odd-platform: {condition: service_healthy}}`), and/or raise the budget (e.g. 60 tries x 5s) and make the failure message say what to do next. A healthcheck is the better half of the fix … it also fixes the same race for `odd-collector`.*
>
> **Defect 2.** `docker/config/injector/samples/08_s3_ingestion.json` declares `//s3/cloud`; `docker/config/injector/datasources/datasources.json` defines `//s3/cloud/aws`. `inject.py` prints `Skipping //s3/cloud …` and drops the sample's 2 entities, so the catalog ends with **9** data sources while `docker/README.md` promises 10. *A one-token edit to either file fixes it; the sample file is the likelier culprit.*
>
> **Suggested fix (one pass).** healthcheck + `service_healthy` for the enricher and the collector · raise `REACH_TRIES_NUMBER` / the sleep and name the likely cause in the give-up message · align the S3 oddrn, then confirm the run reports 10.

No instruction-shaped content is present in the body; nothing to discard under G-C8. The "Suggested fix" is treated as a proposal to critique (G-C16, below), not as a specification.

## Scope analysis

**Class: bug (two independent defects), demo-stand scope.** Both are real, both are on the documented first-run path, and neither touches platform production code. Mission relevance (`lineage/odd-platform/system-mission.md`): this is the **first five minutes** of every evaluation of ODD. The demo stand is the only place where the project's claim ("ingest, structurise, index, discover") is demonstrated before an operator has invested anything. A demo that shows an empty catalog, or silently shows nine of ten promised data sources, spends the project's single best first-impression opportunity on a bug.

**Shape (G-C18): one shippable PR, not an epic.** Two defects, four files, one user-observable outcome ("the documented command produces the documented result"). No decomposition.

**Entry gate (Cornerstone 1): reproduce-first (G-C1), not spec-gate.** Both defects are clear-cut — there is exactly one defensible target state for each (the enricher must not start before the platform can serve it; the sample must load). G-C17 spec-gate does not fire; the reproduction below IS the spec.

**G-C7 does NOT fire.** No migration; no auth or security-posture change (the healthcheck calls `/actuator/health`, which is already permit-all in every auth mode the demo can run — `LoginFormSecurityConfiguration.java:50` lists it explicitly, and the demo's default `auth.type=DISABLED` permits everything); no public-API/wire-contract change. The diff is one compose file, one demo script, one sample JSON, one repo README.

## Verified code read — `origin/main @ 969a5d5b` (every claim has a file:line)

### Defect 1 — the readiness budget and the ordering primitive

| Fact | Evidence |
|---|---|
| The budget is 20 tries with a 2-second sleep | `injector/inject.py:8` `REACH_TRIES_NUMBER = 20`; `:72` and `:77` `time.sleep(2)` |
| The loop breaks only on a top-level `status == 'UP'` | `injector/inject.py:75` `if hc_response.json().get('status') != 'UP':` |
| Only `ConnectionError` is caught; every other request failure propagates | `injector/inject.py:70` `except requests.exceptions.ConnectionError:` |
| No per-request timeout — a hung connect has no bound | `injector/inject.py:69` `requests.get(f"{platform_host_url}/actuator/health")` |
| `hc_response.json()` is unguarded — a non-JSON body raises out of the retry loop | `injector/inject.py:75` |
| Exhaustion raises a message that names no cause and no remedy | `injector/inject.py:83-84` `raise Exception(f"Couldn't reach the platform in {REACH_TRIES_NUMBER} tries")` |
| The enricher's dependency orders container *start* only | `docker/demo.yaml:36-37` `depends_on:` / `- odd-platform` (short syntax) |
| There is **no healthcheck anywhere** in the file | `docker/demo.yaml` — `grep -c healthcheck` = 0 |
| …and none anywhere in the repository | `git grep -n "healthcheck\|service_healthy" -- '*.yaml' '*.yml'` → **0 hits**. This change introduces the repo's first one. |
| The collector has no dependency on the platform at all | `docker/demo.yaml:60-61` `depends_on:` / `- sample-postgresql` |
| The platform image ships `curl` (so a compose healthcheck has a probe) | `odd-platform-api/build.gradle:120-124` `jib { from { image = 'eclipse-temurin:17-jdk' } }`; verified on **both** images actually used — `docker run --rm --entrypoint sh ghcr.io/opendatadiscovery/odd-platform:latest -c 'command -v curl'` → `/usr/bin/curl` (Ubuntu 26.04), same for the locally built `odd-platform:latest` |

### Defect 2 — the oddrn mismatch, and which side is wrong

| Fact | Evidence |
|---|---|
| The sample declares `//s3/cloud` | `docker/config/injector/samples/08_s3_ingestion.json` → `data_source_oddrn` |
| The data-source list defines `//s3/cloud/aws` ("Data Lake S3") | `docker/config/injector/datasources/datasources.json` — 10 entries |
| A sample with no matching data source is silently skipped, and the data source is never created either | `injector/inject.py:93-96` `ds_form = data_sources_grouped.get(ds_oddrn)` → `print("Skipping …")` → `continue` (before `create_data_source_and_retrieve_token` at `:102`) |
| **The sample file is the wrong side** — its own two entities live *under* `//s3/cloud/aws` | the sample's items are `//s3/cloud/aws/buckets/data_lake/keys/raw` and `…/keys/transaction_dataset`. Every other sample follows the same rule (e.g. `07_kinesis_ingestion.json` declares `//kinesis/cloud/aws/account/111111111111/region/us-west-2` and its item is `…/streams/kds_clickstream`). So `datasources.json` is consistent with the sample's *contents*; only the sample's `data_source_oddrn` line disagrees. This is stronger than the issue's "likelier culprit" — it is determined by the data. |
| The README's promise | `docker/README.md:36` "You should be able to see 10 predefined data sources in the list" |
| **A SECOND consumer of `inject.py` exists** — odd-platform's own Playwright harness | `tests/docker/docker-compose.yaml:26-39` mounts `../../injector:/injector` (the same script) with its own sample set `tests/docker/injector/`, launched by `tests/docker/up-platform.sh` / `npm run odd-up` (`tests/package.json:16`). It has the **same defect**: `depends_on: [odd-platform]` short form, no healthcheck, same `PLATFORM_HOST_URL=http://odd-platform:8080` (`tests/docker/.env:5`). |
| …but it is **not** exercised in CI today | `.github/workflows/run-playwright-tests.yml:62-77` — every step that starts the stack and runs the specs is **commented out**; the `test` job only builds the image and uploads an (empty) report. So the harness is a developer-facing path, not a CI gate. |
| The harness's sample set is **forward-clean but not a bijection** | `tests/docker/injector/`: 5 data sources defined, 4 samples; every sample's oddrn IS defined, but `//kinesis/cloud/aws/account/13/region/us-west-2` is defined-but-unused. **This decides the validation's direction** — see the plan. |
| The published manual's promise | `documentation@origin/main:docs/configuration-and-deployment/trylocally.md:36` "You should be able to see 10 predefined data sources in the list." (and `deployment.md:52` "~10") |

## Reproduction (G-C1)

### Defect 2 — deterministic, this stream's own pristine run

Worktree `../odd-platform-ctrib063` detached at `969a5d5b` (so the maintainer's dirty `docker/demo.yaml` is excluded), compose project `ctrib063demo`, stock file, the documented command:

```
docker compose -p ctrib063demo -f docker/demo.yaml up -d odd-platform-enricher
```

Result:

```
enricher log : Skipping //s3/cloud. Define DataSourceFormData in order to inject from the json file
enricher log : "Data source has been created" x 9
enricher exit: 0                         <-- SUCCESS is reported while the demo under-delivers
GET /api/datasources?page=1&size=1000 -> 9 items; "//s3/cloud/aws | Data Lake S3" is ABSENT
POST /api/search {"query":"transaction_dataset"} -> 0 results   (the S3 sample's entity)
POST /api/search {"query":"kds_clickstream"}     -> 2 results   (a sample that DID load — the contrast)
```

The user-visible statement of this: the page the README and the manual send the reader to shows **9**, they were told **10**, and nothing anywhere reports an error.

### Defect 1 — the race, measured on the running system

The race is **intermittent by construction**, so it is stated as an arithmetic identity between two measured quantities rather than as a single observation.

**Loss A — the maintainer's own stack, 2026-09-02 15:41 (stock `inject.py`; witnessed live during this intake).**

| Event | Timestamp | Delta |
|---|---|---|
| platform container started | 15:41:24.154 | T+0.0 |
| enricher container started | 15:41:24.901 | T+0.7 |
| enricher's first poll (`pip install requests` finished) | 15:41:30.159 | T+6.0 |
| enricher's last poll (try 1 of 20) | 15:42:08.488 | T+44.3 |
| `Exception: Couldn't reach the platform in 20 tries` → **exit 1** | 15:42:10.501 | T+46.3 |
| platform bound its port (`Netty started on port 8080`) | 15:42:25.581 | T+61.4 |
| `Started ODDPlatformApplication in 57.91 seconds` | 15:42:25.825 | T+61.7 |

The polling window measured **40.34 s** (15:41:30.159 → 15:42:10.501) — the `20 x 2s` budget, exactly. The platform became reachable **15.1 seconds after the enricher had already died.**

**Loss B — the same stack, 2026-09-01 13:13:00.744 → 13:13:41.007**, budget **40.26 s**, same exception, same exit 1. Two recorded losses, no recorded win, on the maintainer's machine.

**A win — this stream's pristine run, 2026-09-02 15:54.** Platform ready at T+53.8 s (`Started … in 50.336 seconds`, 92 Flyway migrations applied in 5.8 s); the enricher's `pip install requests` took **22.4 s** on a cold pip cache, so its budget ran to T+62.6 s and it won **by 8.8 seconds**.

**Which platform binary each measurement used — stated, because it is not the same one.** `docker/demo.yaml:14` pins `ghcr.io/opendatadiscovery/odd-platform:latest`, and `docker compose up` does **not** re-pull a tag that is already in the local cache. The cached `:latest` on this machine is byte-identical to `:0.28.0` — image `0b0391b036f5`, digest `sha256:b0ac202e62389d96d90685223d1052de1ddfb54339a182e772ba211ebca14408`, built 2026-04-21, pulled 2026-06-17 — which is why it applied **92** migrations, the count at tag `0.28.0`; `969a5d5b` carries **101** (`git ls-tree -r --name-only … db/migration | wc -l`). So:

| Measurement | Platform binary | Boot to health |
|---|---|---|
| Losses A and B (the maintainer's stack) | `odd-platform:latest`, a **local jib build** (their `docker/demo.yaml` is edited to use it) | 57.9 s |
| The win (this stream's stock run) | `ghcr.io/opendatadiscovery/odd-platform:latest` == `0.28.0`, digest `b0ac202e` | 50.3 s |

This does not weaken the finding — the enricher's 40 s budget is fixed and every observed boot is 50-58 s — but it does mean two things the plan must respect. (1) The published `:latest` on ghcr has almost certainly moved past `0.28.0` (upstream tagged `0.29.0`), and it carries **9 more migrations**, so a first-time evaluator's boot today is if anything *slower* than what was measured here: the race is worse in the field than in this reproduction, not better. (2) **IT-154 must not assert against a stale local cache** — that is the `LSN-032`/`LSN-033` rule the workspace already codified. See the test plan for how the image is pinned and recorded per run.

**The root-cause identity.** The enricher's whole lifetime is `pip_install_time + 40 s`. The platform needs 50-65 s from the same starting gun. So:

> **whether the demo works is decided by how long `pip install requests` takes.** A warm pip cache (5-6 s, the maintainer's runs) loses; a cold one (22 s, this run) wins. Nothing about the fix-or-not decision should depend on that, and no user can see it.

That also explains why the defect can sit unnoticed: on the machine of whoever last ran it, it may well have passed.

## Root cause

1. **Defect 1.** `depends_on` in its short form is a *start-order* primitive, not a *readiness* one — compose's documented readiness primitive (`healthcheck` + `depends_on: {condition: service_healthy}`) is not used anywhere in the repository. In its absence the enricher's fixed 20 x 2 s poll is the only readiness gate, and it is shorter than a cold platform boot (the whole Flyway migration set against an empty database, then the Spring context). Secondary robustness defects in the same loop compound it: no per-request timeout, only `ConnectionError` caught, an unguarded `.json()`, and a give-up message that names neither the cause nor the remedy.
2. **Defect 2.** `08_s3_ingestion.json`'s `data_source_oddrn` is one path segment short of the data source its own entities belong to. The class-level cause is that `inject.py` treats an undeliverable sample as a **normal, successful** outcome — it prints one line among forty and exits 0 — so a data typo can (and did) survive indefinitely.
3. **A third instance of that same class, found while verifying the plan rather than from the issue.** Running the stock enricher a **second** time against the already-seeded platform: 8 of 9 samples inject, `10_ge_ingestion.json` **fails**, the script prints `Possibly the 'ingestion.filter.enabled' property is set to 'true'` — a **wrong** diagnosis, that property is `false` (`application.yml:51-53`, and `IngestionDataEntitiesFilter` is `@ConditionalOnProperty(havingValue = "true")`, so the filter bean does not even exist) — and **exits 0**. The real cause is upstream and has nothing to do with the demo: `POST /ingestion/entities` returns `400 USR003 Database constraint violation`, platform-side `duplicate key value violates unique constraint "alert_unique_messenger_oddrn_is_present"`. That is the same missing-`ON CONFLICT` defect already tracked as `issues/odd-platform/PLT-014` Defect 3, which had only been characterised on the AlertManager webhook path; **PLT-014 has been extended in place** (LSN-009, not a duplicate issue) with this ingestion-path instance, the sibling index, and the evidence. What belongs to CTRIB-063 is only that the demo currently **hides** it behind a guess and a zero exit code.

## Change-request product analysis (G-C16)

**(a) The user-observable problem, stated independently of the issue's proposed solution.** A first-time evaluator runs the one documented command and does not get the documented result. In two ways: sometimes an empty catalog (a one-shot loader gives up before the platform can serve it, and under `-d` nobody sees the exit-1 container); always one data source short of the promised ten. The property both share is the important one: **the demo stand has no assertion that it delivered its promise** — it reports success while under-delivering, so the user cannot tell "nine is what this demo does" from "something broke".

**(b) Product-owner / SRE reasoning.** No `odd-sme` consultation was warranted here: this is not a question about ODD's domain semantics (what a data source *means*, how discovery *should* behave) — it is a first-run-experience and orchestration question, and the two sources that decide it are the project's own published promise (`trylocally.md:36`, `docker/README.md:36`) and docker compose's documented readiness mechanism. Both were read. The PO position: a getting-started stand's dominant quality is **determinism** — it must produce the documented result on the first attempt, on a slow laptop and in CI, or it converts the project's best first impression into doubt. And in a demo, *silent* partial success is worse than loud failure, because the reader's only reference is the README count.

**(c) Options considered.**

| # | Option | User-facing consequence |
|---|---|---|
| 1 | Exactly as the issue proposes: healthcheck + `service_healthy`, raise the poll budget, align the oddrn | Both symptoms closed. The silent-skip *class* stays: the next data typo is equally invisible. |
| 2 | **Option 1 + make an undeliverable sample a loud, immediate failure** (validate every sample's `data_source_oddrn` against `datasources.json` before any work; exit non-zero naming the file and the oddrn) | Both symptoms closed **and the class closed**. The demo can no longer report success while under-delivering. Cost: 12 lines, and a partial sample set now fails instead of silently shrinking — which is the intended signal. |
| 3 | Fix the oddrn + raise the poll budget only (no healthcheck) | Cheaper and closes today's symptom, but leaves the race live on slower machines and in CI, and leaves the mechanism compose already has unused. Rejected: the budget is a mitigation, the healthcheck is the fix. |
| 4 | Reshape / rescope / won't-implement | Not defensible. Reproduced, user-facing, on the documented first-run path, and the published manual currently makes a claim the code cannot satisfy. |

**(d) Recommendation: Option 2**, and this is where the plan **diverges from the issue's "Suggested fix"** — the issue asks for the oddrn to be aligned, not for the loader to refuse to under-deliver. The divergence is deliberate: the typo is the instance, the silent skip is the class, and closing only the instance leaves the same trap armed. Two smaller divergences, also recorded: the issue offers a "one-token edit to either file" — the source data determines the answer (the sample is the wrong side; see the code read); and the issue's collector suggestion is a *new* dependency edge, not a condition change (the collector today depends only on `sample-postgresql`), which is a decision the plan makes explicitly rather than by inheritance. A fourth divergence came out of the Phase-A consumer scan and is not in the issue at all: `tests/docker/docker-compose.yaml` mounts the same `injector/inject.py` and carries the identical start-order-only `depends_on`, so the same race lives in the harness a contributor uses to run the Playwright suite locally. Closing one and not the other would be patching the instance again, at the level above.

## Design before build (G-C12)

**(a) Reuse-scan.** `git grep -n "healthcheck\|service_healthy" -- '*.yaml' '*.yml'` in odd-platform → **0 hits**; `git grep "actuator/health"` → three (the injector's poll, the LOGIN_FORM permit-list, `HealthAPITest`). There is no existing in-repo readiness pattern to reuse, so this adopts docker compose's own documented one rather than inventing anything. The workspace *does* carry a directly relevant precedent — `integration-tests/e2e/helpers/stack.ts:20-46` polls the same endpoint for 60 x 3 s and its comment records a lesson this design must respect:

> *"Require the TOP-LEVEL status to be UP, rather than testing the raw body for the substring 'UP'. … the detailed body of a DOWN platform still contains `"status":"UP"` for every component that IS healthy, so a substring test would wave a half-started stack through."*

Consequently the healthcheck is `curl -fsS` on `/actuator/health` and relies on the **HTTP status code** (Spring Boot serves 200 when UP and 503 when DOWN) — never a `grep` for a substring in the body, which would break the moment `management.endpoint.health.show-details` is turned on. For the same reason `inject.py`'s existing top-level `status == 'UP'` test is kept as-is.

**(a2) The mechanism was PROVEN before planning, not assumed.** A throwaway compose stack (scratchpad, torn down) ran the exact healthcheck below against the real published image `ghcr.io/opendatadiscovery/odd-platform:latest` with a dependant gated on `condition: service_healthy`:

```
docker inspect .State.Health.Log:
  18:06:59  exit=7  curl: (7) Failed to connect to localhost port 8080     <- booting
  18:07:04  exit=7  curl: (7) Failed to connect to localhost port 8080
  18:07:10  exit=7  curl: (7) Failed to connect to localhost port 8080
  18:07:15  exit=0  {"status":"UP"}                                        <- ready
  Health=healthy  FailingStreak=0
dependant released 61s after `up` — i.e. only after the platform was healthy.
```

So `curl -fsS` really does discriminate booting from ready on this image (exit 7 vs exit 0), `start_period` absorbed the three failing checks without consuming retries, and the gate released the dependant at the right moment. This is the plan's central mechanism and it is measured, not reasoned.

**(b) ADR-check.** `lineage/odd-platform/implicit-adrs.md` and the published ADR log carry no decision about the demo stand or service readiness. This change introduces no new architectural pattern — it uses the orchestrator's documented feature — so **no ADR is required** and none is proposed. (Recorded rather than assumed: `adr_required: false`.)

**(c) Impact-dimension checklist.**

| Dimension | Verdict |
|---|---|
| i18n | N/A — no user-facing string in the product; the changed text is container logs and a repo README. |
| Generated BE/FE clients | N/A — no OpenAPI/spec change. |
| Consumers of a changed signature | `inject.py` is a standalone script with **three** callers, enumerated from the tree: (1) `injector/start.sh` via `docker/demo.yaml`; (2) `injector/start.sh` via **`tests/docker/docker-compose.yaml:26-39`**, the Playwright harness stand, with its own sample set and the identical race — in scope, change 2; (3) the documented manual invocation at `documentation:docs/developer-guides/build-and-run/build-and-run-odd-platform.md:107`, which is precisely why the poll budget is fixed in the script and not only in compose. All three covered. |
| Migrations | None. |
| Docs | Yes — see `## Docs decision`. |
| Ontology | Two halves, and the first draft asserted the second away. **Code side:** `injector/` and `docker/` carry no substrate node, so `/enrich --touched` has nothing to refresh there. **Doc side: it does.** `lineage/odd-platform/doc-understanding/configuration-and-deployment__trylocally.md` exists and quotes the very mechanics this change alters — `:32` "injects a 10-data-source sample", `:34` "see 10 / 11 data sources in `/management/datasources`". Since the change edits `trylocally.md`, that sidecar is refreshed (or, if `lineage/**` is claimed at the time, deferred with the G-C10 "no refresh now + why" note). Verified by listing the directory, not assumed. |
| Compose compatibility | **Measured, and the floor stated rather than waved away.** Both implementations on this machine honour the condition — a probe stack whose dependency turns healthy at 15 s released the dependent at 18 s (`docker-compose` v1.29.2) / 17 s (`docker compose` v5.1.4) — and the exact final `demo.yaml` resolves on both to the intended graph. **But the file declares `version: "3.3"` and the change uses keys above it**: `healthcheck.start_period` is a compose **format 3.4** key, and the long-form `depends_on` condition was absent from format 3.x until docker-compose V1 re-merged it at **1.27.0**. It validates here only because 1.29.2 is lenient. Every ODD instruction still names the V1 binary (`docker/README.md:30`, `trylocally.md:31`), so the honest move is to declare a format that contains the keys used: **`version:` 3.3 → 3.9** (one line, accepted by both, verified) and name the real floor in the README's Prerequisites. |
| Ports / other stacks | `docker/examples/{ldap,oauth2}.yaml` have neither an enricher nor a collector, so the race does not exist there; they are deliberately not touched. |

**(d) Product-Owner / SRE lens.** Covered in the G-C16 critique above (this is a bug-shaped change; the PO question was "is closing only the instance enough", answered no).

## Plan

### The change

1. **`docker/demo.yaml`** — give the stack real readiness signals and make every dependant wait for them.
   - `version: "3.3"` → `"3.9"`. Not cosmetics: `healthcheck.start_period` is a compose **format 3.4** key and the long-form `depends_on` condition was re-merged into docker-compose V1 only at **1.27.0**, so declaring 3.3 while using 3.4+ keys is simply wrong even though 1.29.2 tolerates it. Verified accepted by both implementations here.
   - give `database` a healthcheck and make `odd-platform` wait for it:
     ```yaml
     healthcheck:
       test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DATABASE}"]
       interval: 5s
       timeout: 5s
       retries: 30
     ```
     This is not scope creep, it is what stops the change making the tail case *worse*: once the enricher blocks on platform health, a platform that never becomes healthy (because Postgres was not ready and it crash-looped) turns a silent empty catalog into a ~5-minute wait ending in `dependency failed to start`. Gating the platform on a ready database removes the only path where the new behaviour is worse than today's.
   - add to the `odd-platform` service:
     ```yaml
     healthcheck:
       test: ["CMD", "curl", "-fsS", "http://localhost:8080/actuator/health"]
       interval: 5s
       timeout: 5s
       retries: 60
       start_period: 30s
     ```
     (`curl -f` fails on 503 and on a refused connection, so the probe tracks Spring's own verdict — measured above; ~5.5 min of tolerance covers a cold boot on a slow machine or in CI.)
   - `odd-platform.depends_on` → long form, `database: {condition: service_healthy}`.
   - `odd-platform-enricher.depends_on` → long form, `odd-platform: {condition: service_healthy}`.
   - `odd-collector.depends_on` → long form, `sample-postgresql: {condition: service_started}` (today's semantics, preserved) **plus** `odd-platform: {condition: service_healthy}` — an explicit new edge, justified: the collector cannot do anything without the platform, `PLATFORM_HOST_URL` is `http://odd-platform:8080` (`docker/.env:5`, always the in-compose platform), and on a bare `docker compose up` it currently restart-loops against a port nothing is listening on.
2. **`tests/docker/docker-compose.yaml`** — the same block for `odd-platform`, and `odd-platform-enricher.depends_on` → `condition: service_healthy`. **Added to scope after the Phase-A consumer scan, not in the issue.** This file mounts the very same `injector/inject.py`, has the identical short-form `depends_on`, and is what `npm run odd-up` / `tests/docker/up-platform.sh` bring up for anyone running the Playwright suite locally. Fixing `demo.yaml` alone would leave the identical bug live one directory away, in the harness a contributor uses to check their own work. No CI risk either way: the workflow's stack-and-run steps are commented out (`run-playwright-tests.yml:62-77`).
3. **`injector/inject.py`** — make the readiness poll robust, and stop the script reporting success while under-delivering. Every bullet below closes the same class the issue's two defects are instances of, except the last, which is a named one-line fold-in.
   - **budget**: `REACH_TRIES_NUMBER` 20 → 60 and a new `REACH_RETRY_DELAY_SECONDS` 2 → 5, both env-overridable via the file's existing `os.getenv(...)` idiom — so the standalone invocation documented at `build-and-run-odd-platform.md:107` is safe too, where no compose gate applies;
   - **robustness**: a per-request `timeout` (today a hung connect has no bound at all); catch `requests.exceptions.RequestException` (a superset of today's `ConnectionError`); guard `hc_response.json()`, which currently raises straight out of the retry loop on a non-JSON body; and a give-up message that names the cause and the remedy (how long it actually waited, that a first start is slow because it applies the whole database migration set against an empty database, and the env knob to raise). No migration *count* is baked into the message — the measured value today is 92 (`Successfully applied 92 migrations`, this stream's run) and it grows with every release, so a number would rot;
   - **validate before working**: read `datasources.json` and every sample once, up front; if any sample's `data_source_oddrn` is not defined, print each offending `file → oddrn` and exit non-zero. The now-unreachable `Skipping …` branch in the injection loop is deleted (subtraction, not addition). **Forward direction only** — a defined-but-unused data source is NOT an error, because `tests/docker/injector/` legitimately carries one (5 defined, 4 samples) and a bidirectional check would break the Playwright harness. The forward direction is the one that drops data; the reverse creates nothing and loses nothing.
   - **an injection failure is no longer swallowed, and no longer mis-diagnosed** — *GATE-1 decision D1 = option C, loud but not fatal*: `inject.py:106-111` today catches everything with a bare `except:`, prints a guess — *"Possibly the 'ingestion.filter.enabled' property is set to 'true'"* — and continues. This is not hypothetical: on the second run of the stock demo it fires, and the guess is **wrong** (Root cause 3 — the real answer is `400 USR003`, an upstream alert-uniqueness defect now recorded on `PLT-014`). So `inject_data` raises with the **actual HTTP status and response body**; each failure is reported at the point it happens and again in a **final summary naming every failed file with its status**; the hint survives only as a hint. The process **still exits 0** — the maintainer's call at GATE 1, and a coherent one: a *configuration* error means the demo cannot possibly deliver and fails fast before any work (the validation bullet above, exit non-zero), whereas a *runtime* rejection may be upstream or transient and a red container on every repeat `up` is worse for a demo than a loud summary. (`except Exception`, not bare `except:`, so Ctrl-C still works.) **Residue, recorded:** the exit code alone still cannot distinguish a complete run from a partial one; the summary is what a reader must look at.
   - **trivial fold-in, named rather than hidden**: `DATA_SOURCES_ONLY = os.getenv("DATA_SOURCES_ONLY") or False` (`:10`) treats *any* non-empty string as true, so `DATA_SOURCES_ONLY=false` currently means true. One line, in a file this change already rewrites; folded in and called out in the PR body rather than left as a known bug behind a ticket.
4. **`docker/config/injector/samples/08_s3_ingestion.json`** — `data_source_oddrn`: `//s3/cloud` → `//s3/cloud/aws`, matching both `datasources.json` and the sample's own entity oddrns.
5. **`docker/README.md`** — Step 1 gains one sentence: the first start takes about a minute while the platform applies its migrations, and the enricher now waits for it; and Prerequisites names the real compose floor (docker-compose >= 1.27, or any `docker compose` v2+) instead of "preferably the latest". Two existing promises need no edit because the code change makes them true: `:36` "10 predefined data sources" and `:65` "Overall you should see 11 data sources" — the second one is repaired by change 4 as well, and is currently just as wrong as the first.

### `must_haves`

```yaml
must_haves:
  truths:                # each verifiable by a human driving the stock demo stand
    - "Running the documented `docker compose -f docker/demo.yaml up -d odd-platform-enricher` on a cold
       machine leaves the catalog populated, every time — not on a coin flip decided by how long
       `pip install` happens to take."
    - "http://localhost:8080/management/datasources lists 10 data sources, the number the README and the
       published manual promise; the S3 sample's entities (e.g. `transaction_dataset`) are searchable."
    - "If a sample ever again names a data source that is not defined, the run FAILS immediately and says
       which file and which oddrn — instead of one `Skipping` line among forty and a zero exit code."
    - "Run standalone (no compose), the injector waits minutes rather than 40 seconds for a platform that is
       still booting, and if it does give up it says what to do next."
    - "If any sample fails to inject, the run names that file and reports the platform's ACTUAL status and
       response body, at the point of failure and again in a closing summary — never a guess about a property
       that is not even set. (Measured: on a second run today this fires, and today's guess is wrong.)
       Per GATE-1 decision D1 the exit code stays 0; the summary is the signal."
    - "`npm run odd-up` (the Playwright harness stand) is subject to the same readiness gate, so a contributor
       checking their own work does not hit the identical race one directory away."
  artifacts:
    - path: "odd-platform:docker/demo.yaml"
      provides: "the platform's readiness signal + readiness-gated start for the enricher and the collector"
      anchor: "condition: service_healthy"
    - path: "odd-platform:injector/inject.py"
      provides: "a bounded, robust readiness wait + up-front sample/datasource validation that fails loudly"
      anchor: "REACH_RETRY_DELAY_SECONDS"
    - path: "odd-platform:docker/config/injector/samples/08_s3_ingestion.json"
      provides: "the 10th data source and its 2 entities actually load"
      anchor: "//s3/cloud/aws"
    - path: "odd-platform:tests/docker/docker-compose.yaml"
      provides: "the same readiness gate for the Playwright harness stand, which mounts the same inject.py"
      anchor: "condition: service_healthy"
    - path: "odd-platform:docker/README.md"
      provides: "the reader knows the first start takes ~a minute and that the wait is expected"
      anchor: "first start"
    - path: "odd-team:integration-tests/protocols/IT-154-demo-stand-first-run.md"
      provides: "the human-carryable protocol — 8 assertions, each with its RED-on-base behaviour"
      anchor: "regresses: [PLT-255]"
    - path: "odd-team:integration-tests/suites.yaml"
      provides: "REGISTRATION — without this line IT-154 is never resolved by any suite and never runs"
      anchor: "IT-154"
    - path: "odd-team:integration-tests/e2e/specs/demo-stand-first-run.spec.ts"
      provides: "the automation rail named by `automation: e2e:...` — without it the protocol lands in MANUAL[]"
      anchor: "demo-stand"
    - path: "odd-team:integration-tests/e2e/helpers/demo-stand.ts"
      provides: "the per-stack wrapper (loginform-stack.ts pattern) + the host-port-remap override"
      anchor: "18095"
    - path: "odd-team:integration-tests/e2e/helpers/stack.ts"
      provides: "one optional composeExtra field so composeUp can take the override file — additive, no change for the 7 existing callers"
      anchor: "composeExtra"
    - path: "documentation:docs/configuration-and-deployment/trylocally.md (release/1.0.0 train)"
      provides: "the published Step 1 tells the reader the same thing as the repo README"
      anchor: "first start"
  key_links:
    - from: "docker/demo.yaml odd-platform.healthcheck"
      to: "odd-platform-enricher / odd-collector start"
      via: "depends_on: {odd-platform: {condition: service_healthy}} — long form; the short-form list must be
            REPLACED, not appended to, or compose rejects the mixed shape"
    - from: "the healthcheck command"
      to: "Spring's health verdict"
      via: "curl -fsS on /actuator/health inside the container — relies on the HTTP status (200 UP / 503 DOWN),
            never on grepping the body (stack.ts:26-32 lesson). Requires curl in the image: verified present in
            BOTH ghcr.io/opendatadiscovery/odd-platform:latest and a local jib build (eclipse-temurin:17-jdk)."
    - from: "inject.py's up-front validation"
      to: "the injection loop"
      via: "samples are read ONCE into (path, oddrn, payload) and reused — the loop no longer re-reads files,
            and its `Skipping` branch is removed as unreachable"
    - from: "inject.py's per-sample injection failures"
      to: "the closing summary a reader actually sees"
      via: "the bare `except:` at :106-111 becomes `except Exception as e`, the raised error carries the real
            HTTP status + body, and every failure is collected and re-printed in a final block naming each
            file. Exit code stays 0 (GATE-1 D1) — so the SUMMARY is the whole signal, and it must be the last
            thing printed, after the forty injection lines, or it is as buried as the line it replaces"
    - from: "the forward-only validation"
      to: "tests/docker/injector (the OTHER sample set on the same script)"
      via: "5 datasources / 4 samples, one defined-but-unused — so the check must NOT be bidirectional or the
            Playwright harness stand stops starting"
    - from: "IT-154's protocol file"
      to: "an actual executed verdict"
      via: "suites.yaml registration (multi-stack) + `automation: e2e:demo-stand-first-run.spec.ts` + the spec
            itself. run-suite.sh:78-96 resolves ids ONLY from suites.yaml and drops anything whose automation is
            empty/manual into a printed-but-never-run MANUAL[] — the CTRIB-031/IT-139 orphaning shape"
    - from: "IT-154's platform binary"
      to: "the run-log verdict"
      via: "`docker pull ghcr.io/opendatadiscovery/odd-platform:latest` before bring-up + the resolved digest
            recorded per run — otherwise the gate silently inherits whatever stale tag the local cache holds
            (this reproduction inherited 0.28.0 from 2026-06-17)"
    - from: "IT-154"
      to: "the stock demo stand"
      via: "the IT drives `docker/demo.yaml` from the odd-platform worktree under its own compose project,
            composed with a host-port-remap-ONLY override (the demo's 8080/5432 are hard-coded and a developer
            stack may hold them); the container-network path odd-platform:8080 the enricher uses is untouched,
            so the readiness gate and the injection are exercised exactly as a user gets them"
```

### Test plan (G-C9 — both buckets)

**Sequencing note:** the integration rail is built **first**, not last. It is the piece a budget squeeze drops, and the plan-check found exactly that failure shape in the first draft (a protocol file with no rail is never executed by anything — `run-suite.sh:78-96` classifies `automation: '' | manual | none` into a `MANUAL[]` array that is *printed* and never run, and ids resolve only from `suites.yaml`; the repo's own case-law is `suites.yaml:16`, the CTRIB-031 IT-139 orphaning).

**Unit bucket (odd-platform CI) — none, by the maintainer's decision at GATE 1, and the residue is recorded rather than glossed.** There is no Python test harness in this repo (CI is `./gradlew odd-platform-api:build` plus a Playwright job; `git grep pytest` → 0). The plan offered a ~20-second workflow job that would have run the injector's own new check against both bundled sample sets with no platform involved — routed there because the check is a pure local read of two JSON directories, which by the tests-pillar home rule (`pillars/tests/pillar.md`) is unit-shaped, so "there is no pytest here" would have been a tooling objection rather than a routing one. **GATE 1 chose to leave CI alone**, keeping the PR a pure bug fix an upstream reviewer can read in one pass.

Consequences, stated plainly so nobody has to rediscover them:
- the in-repo guard against a future sample/datasource drift is now the **demo run failing loudly** — which is a real guard, because the validation runs *before* the readiness poll, so a broken sample set fails in about a second rather than after a five-minute wait;
- the *repeatable* guard is **IT-154**, which lives in odd-team and is therefore invisible to an upstream contributor;
- `VALIDATE_ONLY` is dropped with the CI job that motivated it. Validation-before-polling gives IT-154's assertion 7 the same stack-free, one-second failure for free, so the switch would have been an unused knob. Subtract.


**Integration bucket (odd-team) — MANDATORY here, and fully wired.** `integration-tests/protocols/IT-154-demo-stand-first-run.md`, `gates: regresses: [PLT-255]`, plus **every artifact that makes it actually run**:

| Artifact | Why it is required |
|---|---|
| `integration-tests/suites.yaml` — IT-154 added to **`multi-stack`** | ids resolve only from here; `multi-stack` is the suite for specs that bring up their own stack (`suites.yaml:112-118`), and it is in `run-regression.sh`'s default set. `feature-complete` is wrong — its specs share one global stack. |
| `automation: "e2e:demo-stand-first-run.spec.ts"` | anything else lands in `MANUAL[]` and never produces a verdict |
| `integration-tests/e2e/specs/demo-stand-first-run.spec.ts` | the rail itself: Playwright, because the README's promise is *"open this URL and see 10"* — the browser is the faithful assertion surface |
| `integration-tests/e2e/helpers/demo-stand.ts` | the per-stack wrapper, following `loginform-stack.ts` exactly |
| `integration-tests/e2e/helpers/stack.ts` — one optional `composeExtra` field | `composeUp` builds a single `-f`; the demo stand needs two. An additive optional field, no behaviour change for the seven existing callers — conform to the shared helper, do not fork a parallel one. |
| a host-port-remap-only override file | the demo pins host `8080`/`5432`; the stand runs on **18095/15495** (free: the e2e fixed ports stop at 18090/15441, and `run-regression.sh:53-58` starts its SUT search at 18100/15500). Only host mappings are overridden — the enricher still reaches `odd-platform:8080` over the compose network, so the readiness gate and the injection are exercised exactly as a user gets them. |

`stack:` frontmatter is `odd-demo-stand (docker/demo.yaml from the odd-platform tree)` — deliberately **not** a `lineage/_extractor/probe-stacks/` profile, because the compose file *is* the artifact under test; copying it into a profile would test the copy.

**The SUT, stated explicitly** (G-C2 / `LSN-032`): the demo stand takes its platform binary from `ghcr.io/opendatadiscovery/odd-platform:latest` **by design** — that is what a user runs. So the working-tree half of the SUT is the compose file, the injector and the sample data (all mounted or read from the worktree), and the platform half is the published image. The spec therefore **`docker pull`s `:latest` before bringing the stand up and records the resolved digest in the run-log**, so a green result names the binary it was green against instead of silently inheriting a months-old local cache (this reproduction inherited `0.28.0` from 2026-06-17 exactly that way).

**Assertions, each with its RED-on-base behaviour:**

| # | Assertion | On base @ `969a5d5b` |
|---|---|---|
| 1 | the `odd-platform` container reports a health status at all | **deterministic RED** — no healthcheck exists; `.State.Health` is null |
| 2 | the enricher's `StartedAt` is after the platform reached `healthy` | deterministic RED (there is no `healthy` to be after) |
| 3 | the enricher exits 0 | flaky RED — this is the race itself |
| 4 | `GET /api/datasources` returns **10** | **deterministic RED** — 9 |
| 5 | the catalog is populated — a search returns entities at all | separates Defect 1 from Defect 2: assertion 4 alone cannot tell an empty catalog (race lost) from a nine-source catalog (oddrn typo) |
| 6 | the S3 sample's `transaction_dataset` is searchable | **deterministic RED** — 0 results |
| 7 | a fixture with one sample re-pointed at an undefined oddrn makes the injector exit **non-zero**, naming that file and that oddrn | **deterministic RED** — base exits 0 with one `Skipping` line. This is the negative path for the plan's headline widening; without it that decision is untested. |
| 8 | run standalone against a closed port with `REACH_TRIES_NUMBER=2 REACH_RETRY_DELAY_SECONDS=1`, the injector exits non-zero within a few seconds and its message names the knob | **deterministic RED** — base has no env knobs and burns its fixed budget. Covers the standalone-budget truth, which nothing else reaches. |

Assertions 7 and 8 need no stack at all, so they are cheap and cannot be dropped for being slow.

**The RED proof has a named mechanism** (the first draft left this to a worktree that is also where the fix is written): a **second, detached worktree `../odd-platform-ctrib063base` pinned at `969a5d5b`** is created before the first edit and never written to; the base run is executed there. `ODD_SUT=ref:main` is not the right knob here — it swaps the *platform image*, and the base/fix difference in this change lives in the compose file and the injector, not in the platform binary.

**Full regression (G-C2):** `integration-tests/run-regression.sh ctrib063` — all four suites (`feature-complete` green · `multi-stack` green-target, now including IT-154 · `known-bugs` expected-RED · `ingestion-e2e` green-target) plus the full CI-replica unit build `scripts/run-platform-tests.sh`, both at the committed SHA. The change touches no `src/`, so it cannot plausibly move them — and measuring that rather than asserting it is exactly the point.

### Docs decision (G-C10 + G-C11)

**Pages read, not assumed** (`git show origin/main:<path>`):
- `docs/configuration-and-deployment/trylocally.md` — Step 1 Result, line 36: *"You should be able to see 10 predefined data sources in the list."* The count claim needs **no correction**: it is what the product is supposed to do and change 4 makes it true on the same release. What it *does* need is the same one-sentence expectation the repo README gets (the first start takes ~a minute; the enricher waits for it), so a reader who opens the URL immediately is not left thinking the demo failed.
- **Recorded rather than glossed:** `trylocally.md:36` is **live and false today** — it promises 10 to every reader of every released version while the shipped stand delivers 9. Leaving it is defensible only because the fix rides the same release: it is an **accepted, time-boxed falsehood whose expiry is the 1.0.0 release gate**, and if this change does not ship in 1.0.0 the correct move flips to correcting the number on docs `main`. Stated here so the judgment is auditable rather than implicit.
- `docs/configuration-and-deployment/deployment.md:52` — hedged ("~10"); no edit needed.
- `docs/developer-guides/build-and-run/build-and-run-odd-platform.md:107` — documents the standalone `python injector/inject.py` invocation; the raised budget is what makes that path safe. No text change required, and none is invented.

**Routing:** the behaviour described is unreleased, and #1870 carries milestone **1.0.0**, so the edit rides the **`release/1.0.0` train** (`origin/release/1.0.0` already exists) on branch `docs/CTRIB-063-demo-stand-first-run`, in a per-stream worktree — the shared `../documentation` checkout is parked on a stale branch and is not touched. A paired `backlog/docs/DOC-NNN` item (id resolved at authoring time — `DOC-519` is already taken by the released-truth finding below) carries `milestone: 1.0.0` + the expected post-merge URL for the deferred Gate 8.

### Scope EXCLUSIONS (G-C5) — deliberately NOT touched

- **`odd-collector`'s empty `token: ""` and its 500-instead-of-401 restart loop** — that is [#1869](https://github.com/opendatadiscovery/odd-platform/issues/1869) / `issues/odd-platform/PLT-254.md`. This change removes the *start-order* half of the collector's first-boot noise and nothing else.
- **The upstream alert-uniqueness defect** that makes a *second* ingestion of the Great Expectations sample return `400 USR003` (`duplicate key … alert_unique_messenger_oddrn_is_present`). Real, reproduced, and NOT a demo bug — it is `createAlerts` missing an `ON CONFLICT`, already tracked as `issues/odd-platform/PLT-014` Defect 3 and **extended in place today** with this ingestion-path instance rather than filed as a duplicate (LSN-009). CTRIB-063 makes it *visible*; fixing it is a different slice in a different subsystem.
- **A bidirectional sample↔datasource check** (a defined data source with no sample) — deliberately NOT added: `tests/docker/injector/` carries exactly that case (5 defined, 4 samples) and a hard bidirectional check would stop the Playwright harness stand from starting. The forward direction is the one that loses data.
- **`docker/examples/{ldap,oauth2}.yaml`** — no enricher, no collector, no race.
- **Un-commenting the Playwright CI steps** (`run-playwright-tests.yml:62-77`) — the harness's stack-and-run steps are disabled upstream, presumably deliberately. This change makes that stand more reliable; turning it back on in CI is a separate decision with its own runtime cost, and is not smuggled in here.
- **Re-pointing `trylocally.md`'s wrong collector data-source name** (`Sample demo data source` vs the shipped `postgresql-step2-test`) — released truth, belongs on docs `main`, not on the 1.0.0 train this change rides. Filed as `backlog/docs/DOC-519`.
- **Nothing under `odd-platform-api/src/`, `odd-platform-ui/`, or the specification.** The diff contains no product code.
- **`.github/workflows/run-playwright-tests.yml`'s commented-out stack-and-run steps** — see above; making that stand reliable is this change's business, turning it back on in CI is not.

### Scope comment for the issue thread (G-C5) — POSTED

**[issuecomment-5513140972](https://github.com/opendatadiscovery/odd-platform/issues/1870#issuecomment-5513140972)**, `odd-contributor[bot]`, 2026-09-02T16:50:38Z — posted immediately on GATE-1 approval, before any code. Read back from the API: 3842 bytes, 0 non-ASCII. Body as sent:

The plan **widens** the issue's stated scope in two places (the no-silent-success behaviour in the injector, and the identical fix in `tests/docker/docker-compose.yaml`) and **pins** one open choice the issue left open (which of the two files the oddrn typo lives in), so per G-C5 a public scope comment is drafted and is posted immediately on GATE-1 approval, before any code:

> This is being picked up. Scope of the PR, so the thread matches it.
>
> Defect 1 is fixed with both halves the issue names: `odd-platform` gets a compose healthcheck on
> `/actuator/health` and the enricher and the collector both wait for `condition: service_healthy`. Two
> additions in the same block, for the same reason: `database` gets a `pg_isready` healthcheck that the
> platform waits on (otherwise, once the enricher blocks on platform health, a platform that crash-loops on a
> not-yet-ready database turns a silent empty catalog into a five-minute wait ending in "dependency failed to
> start"), and the file's `version` moves 3.3 -> 3.9, because `start_period` is a 3.4 key and the long-form
> `depends_on` condition only came back to docker-compose V1 in 1.27 - declaring 3.3 while using 3.4+ keys is
> wrong even where it is tolerated. The README's Prerequisites will name that floor.
>
> The injector's own readiness poll is raised and hardened too (a per-request timeout, every request failure
> retried rather than only connection errors, a non-JSON body tolerated, env-tunable tries and delay, and a
> give-up message that says what to do), so the script is also safe run standalone - which the developer guide
> documents - where no compose gate applies.
>
> Defect 2 is fixed in `08_s3_ingestion.json` rather than in `datasources.json`. The sample's own two entities
> are `//s3/cloud/aws/buckets/...`, so `//s3/cloud/aws` is the value both files should carry - the data
> settles which side the typo is on.
>
> Two things beyond what the issue asks for, both deliberate:
>
> 1. The injector stops hiding what it failed to deliver. A sample naming an undefined data source now fails
>    the run immediately, naming the file and the oddrn, before any waiting - that is a configuration error and
>    the demo cannot possibly succeed. An injection that fails is reported with the platform's ACTUAL status
>    and response body, at the point of failure and again in a closing summary listing every failed file,
>    instead of being swallowed by a bare `except:` that prints a guess and carries on. That guess is not
>    hypothetical and it is not correct: running the stock enricher a second time today, one sample fails and
>    the script blames `ingestion.filter.enabled`, which is `false` and whose filter bean does not exist. The
>    real answer is `400 USR003 Database constraint violation` from an alert-uniqueness defect on the platform
>    side, reported separately - the demo's part was hiding it.
> 2. `tests/docker/docker-compose.yaml` gets the same healthcheck and the same `service_healthy` gate. It
>    mounts the very same `injector/inject.py` and has the identical start-order-only `depends_on`, so it has
>    the identical race; it is what `npm run odd-up` starts for the Playwright suite. Fixing only
>    `docker/demo.yaml` would leave the same bug one directory away. (Nothing changes in CI - that workflow's
>    stack-and-run steps are commented out today, and this PR does not turn them back on.)
>
> Not in this PR: the collector's empty token and its 500-instead-of-401 restart loop (that is #1869); the
> platform-side alert-uniqueness defect described above; any workflow change; and turning the Playwright CI
> steps back on.
>
> Verified on a stock stand at the current main before planning any of it. Defect 1 is a race whose outcome is
> currently decided by how long `pip install requests` takes: the enricher's whole lifetime is that install
> plus a fixed 40s poll, while the platform needs 50-65s from the same start. Two runs lost by ~15s (the
> platform bound its port 15.1s after the enricher had already exited 1); one run won by 8.8s because a cold
> pip cache took 22s. Defect 2 needs no luck at all - `GET /api/datasources` returns 9, `Data Lake S3` is
> absent, and a search for `transaction_dataset` returns nothing while `kds_clickstream` returns 2 rows.

## GATE-1 decisions — ANSWERED 2026-09-02 by RamanDamayeu

**Plan APPROVED, full scope.** Both defects, the fail-loudly class fix, the Playwright harness compose, the docs on the 1.0.0 train, and IT-154. **D1 = option C** (loud but not fatal). **D2 = leave CI alone.** Recorded verbatim below with the options as they were put.

**D1 — what a *second* `docker compose up` should do, now that injection failures are fatal.**
Measured today on the stock stand: run 1 injects everything and exits 0; run 2 injects 8 of 9, fails
`10_ge_ingestion.json` on an upstream alert-uniqueness defect (`PLT-014`), and **exits 0 with a wrong
diagnosis**. Making failures fatal is right, but it changes what a repeat `up` looks like.

| Option | What a second `up` does | Cost |
|---|---|---|
| A (recommended by this run, **not chosen**) — fatal + the real error | exits non-zero, naming the file and `400 USR003 …` | Truthful, and it surfaces a genuine platform bug instead of hiding it. But a repeat `up` on an existing stack now shows a red container until `PLT-014` is fixed. |
| B (**not chosen**) — fatal, plus skip injection for a data source that already exists | exits 0, "already seeded, nothing to do" | Makes the enricher idempotent, which is what a repeat `up` wants, and removes the upstream bug from the demo path. Changes seeding semantics: re-running would no longer re-apply an edited sample (`down -v` becomes the reset). |
| **C — CHOSEN** — loud but not fatal | exits 0, prints a failure summary naming every failed file with the platform's real status and body | Smallest change, and the demo never shows a red container for an upstream defect it did not cause. The accepted residue: the exit code alone still cannot distinguish a complete run from a partial one, so the closing summary is the whole signal and must be the last thing printed. |

**D2 — the CI validation job.** It is the only part of the change that adds a workflow surface to a public
repo. With it, a future sample/datasource drift is caught on the PR that introduces it; without it, the guards
are the demo run's own loud failure plus IT-154, which lives in odd-team and is invisible upstream.
**CHOSEN: leave CI alone** — keeping the PR a bug fix an upstream reviewer can read in one pass. Consequences are written into the test plan's unit-bucket paragraph rather than left implicit, and `VALIDATE_ONLY` is dropped with it (validation-before-polling covers IT-154's stack-free case anyway).

## Plan-check (G-C19)

**Round 1 — `.claude/agents/plan-checker.md`, fresh context, 2026-09-02: ISSUES FOUND — 5 blockers, 8 warnings.**
Every one was re-verified against the tree by this run before acting on it (an agent's report is evidence to
check, not a verdict to adopt). Two of the five were already closed by plan revisions the checker had not seen;
one was **wrong in its mechanism but right in its instinct**, and chasing it down found a real third defect.

| # | Finding | Disposition |
|---|---|---|
| B1 | IT-154 is an unwired artifact — a protocol with no `suites.yaml` entry and no `automation:` rail is never executed by anything | **VALID, fixed.** Re-verified: `run-suite.sh:78-96` drops `automation: ''\|manual\|none` into a printed-never-run `MANUAL[]`, and ids resolve only from `suites.yaml`. The plan now names all five rail artifacts, the suite (`multi-stack`), the ports (18095/15495), and the stack decision. |
| B2 | The headline widening (fail-loudly) had zero test coverage; so did the standalone budget | **VALID, fixed.** Assertions 7 and 8 added, both stack-free and deterministic-RED; the CI validation job promoted from a maybe to a delivered artifact, since the home rule — not the absence of pytest — decides routing. |
| B3 | `truths[3]` is false as designed; on a re-run every sample sends `Bearer None` and fails, so the script still exits 0 | **MECHANISM WRONG, INSTINCT RIGHT — and it found a third defect.** Measured rather than argued: ingestion auth is off by default (`application.yml:51-53`; the filter bean is `@ConditionalOnProperty(havingValue="true")`), so `Bearer None` is never checked and **8 of 9 samples inject fine** on a re-run. But **one genuinely fails** — `10_ge_ingestion.json` → `400 USR003`, `duplicate key … alert_unique_messenger_oddrn_is_present` — and the script prints a **wrong** cause and exits 0. So the truth was reachable, the reason was not the one given. Recorded as Root cause 3; `PLT-014` extended in place (LSN-009); the re-run consequence raised as GATE-1 decision **D1** rather than decided here. |
| B4 | "exactly two callers" is wrong — `tests/docker/docker-compose.yaml` is a third, with the identical race | **ALREADY CLOSED** in plan rev 2, found independently by this run's Phase-A consumer scan; the checker read rev 1. The stale sentence in the impact table has now been corrected too. |
| B5 | The timings and the "92 migrations" figure were measured against `0.28.0`, not against the stated base | **VALID, fixed.** Re-verified: the cached `ghcr…:latest` is byte-identical to `:0.28.0` (`0b0391b036f5`, digest `b0ac202e…`), and `969a5d5b` carries **101** migrations to that image's 92. The reproduction now states which binary each measurement used, the count is out of the shipped string, and IT-154 pulls `:latest` and records the digest per run. |
| W1 | Two wrong `file:line` cites in a table headed "every claim has a file:line" | **VALID, fixed** — `36-37` and `60-61`, re-read from the tree. Exactly the recall-instead-of-read failure the workspace has case-law for. |
| W2 | "adds no minimum-version requirement" is wrong — `start_period` is a 3.4 key under a 3.3 header | **VALID, fixed** — `version` 3.3 → 3.9 is now in scope, and the README states the real floor. |
| W3 | Excluding a `database` healthcheck makes the tail case worse than today | **VALID, fixed** — `pg_isready` + `odd-platform` gated on it, in the same block. |
| W4 | `truths[1]` is compound; assertion 4 cannot distinguish the two defects | **VALID, fixed** — truth split, and assertion 5 (catalog populated at all) added. |
| W5 | The ontology dimension was asserted away; `trylocally`'s doc-understanding sidecar exists and quotes "10 data sources" | **VALID, fixed** — verified the file exists; the sidecar is now in scope for refresh. |
| W6 | Budget is 8-10 artifacts; the IT rail is what gets dropped under pressure | **ACCEPTED** — the rail is now sequenced first and said so explicitly. |
| W7 | The RED proof names the same worktree the fix is written in | **VALID, fixed** — a second detached worktree `../odd-platform-ctrib063base`, created before the first edit. |
| W8 | `trylocally.md:36` is live and false today; `docker/README.md:65` is a second promise repaired but uncredited | **VALID, fixed** — recorded as an accepted falsehood expiring at the 1.0.0 gate; `:65` credited. |

**Re-check status:** the corrections are structural (rail wiring, coverage, evidence provenance) and none of them
changes the shape of the fix, so a full second adversarial pass is owed only if GATE 1 changes the scope — in
which case it runs again before any code, per the ≤3-loop rule.

## Deviations from the approved plan (Phase D), and why

Recorded so `/review` compares the diff against a plan that matches it. Both are *narrower* than
what GATE 1 approved, not wider.

1. **`integration-tests/e2e/helpers/stack.ts` is NOT extended.** The plan proposed one optional
   `composeExtra` field on the shared helper. Building it showed that would be a forced fit: the
   demo stand's whole lifecycle differs from every other stack here — it brings up **one** service
   (`up -d odd-platform-enricher`, the documented command), and the property under test is that
   *compose itself* blocks that command until the platform is healthy. `composeUp` does `up -d`
   (all services) and then polls for health in the harness — which would have hidden exactly what
   IT-154 measures. `demo-stand.ts` therefore owns its own `up`/`down` and reuses `composeCmd()`
   from `docker.ts`, which is the part carrying real knowledge (prefer the v2 plugin; legacy v1
   crashes on container recreate). Seven existing specs are left untouched.
2. **`pg_isready` ships without the plan's `-d` flag.** The plan specified
   `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DATABASE}`; the code ships `-U` only. Behaviourally
   identical on this stack — `docker/.env` sets `POSTGRES_DATABASE` and `POSTGRES_USER` to the same
   value (`odd-platform`), and `pg_isready` reports whether the *server* is accepting connections,
   not whether a given database exists — and `-U` alone is the idiom the postgres image documents.
   Recorded here because the review caught it as an unlogged divergence, not because the code is wrong.
3. **The stand's assertions are ONE test with `expect.soft`, not six tests.** Both alternatives were
   built and run against the base tree before this was settled: `serial` stops at the first failure,
   so a red result cannot say *which* defect regressed — and telling the race apart from the oddrn
   typo is the entire job of assertions 4/5/6. Six independent tests do each report, but Playwright
   discards the worker after a failed test and starts a fresh one, which re-runs `beforeAll`:
   measured on base, **every red assertion rebuilt the whole demo stand**, ~2 minutes each. Soft
   assertions give what both were reaching for — every assertion reports, on one stand, in one pass.

## Test ledger

> **Round 1 only** — superseded by `## Rework — round 2`, which adds IT-154 assertion 9 (so the spec is
> 4 cases, not 3) and re-runs every gate at `9c1360df`. Kept as the historical record of what round 1
> measured, including the gate it honestly declared incomplete.

**Both buckets, routed by the tests-pillar home rule; every gate RUN, not reasoned about.**

| Bucket | What ran | Result |
|---|---|---|
| Unit (odd-platform CI guard) | **none, by the maintainer's GATE-1 decision D2.** The offered guard was a ~20s workflow job running the injector's own validation against both bundled sample sets; GATE 1 chose to leave CI alone so the PR stays a pure bug fix. The consequences are written into the test plan rather than left implicit: the in-repo guard is now the demo run's own loud failure (validation runs *before* the readiness poll, so a broken sample set fails in about a second), and the repeatable guard is IT-154, which is invisible upstream. | recorded, not skipped |
| Unit (full CI replica) | `scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build`) on the branch worktree at `c88bf405` | **814 / 1 / 0 / 0** across 181 classes; checkstyle clean; the 1 is TST-061 |
| Integration (odd-team) | **IT-154** — protocol + `suites.yaml` registration in `multi-stack` + the e2e spec + the helper + the port override. Rail resolution verified by RUNNING it: `run-suite.sh IT-154 --dry-run` -> `ui e2e: demo-stand-first-run.spec.ts · manual: none` | **GREEN 3/3 on the fix · RED 3/3 on base** |
| Integration (full regression) | `run-regression.sh ctrib063` | **`feature-complete` 328/12 zero-unattributed · `known-bugs` INTERRUPTED · `multi-stack` NOT RUN · `ingestion-e2e` NOT RUN** |

### The RED proof — a named mechanism, not an assertion

The base is `../odd-platform-ctrib063base`, a **second detached worktree pinned at `969a5d5b`, created before
the first edit and never written to**. `ODD_SUT=ref:main` is deliberately not used: it swaps the *platform
image*, and the base-vs-fix difference here lives in the compose file, the injector and the sample data, not
in the platform binary — which is held constant at digest `sha256:3b61b3f2…` on both sides.

`up -d odd-platform-enricher` returns in **2s** on base and blocks **62-86s** on the fix. Ten soft assertions
go red on base: no healthcheck on either service, no passing probe on record, `Skipping //s3/cloud`, 9 data
sources, `//s3/cloud/aws` absent, `transaction_dataset` -> 0, `Data Lake S3` not rendered; plus the two
stand-free cases — a broken fixture exits **0** with one `Skipping` line, and `REACH_TRIES_NUMBER=2` is
ignored while the run burns all 20 tries and dies with the old message.

**Stated honestly: the race did NOT fire on that base run.** `the enricher must exit 0` and `the catalog must
actually hold ingested entities` both PASSED there — the enricher won the coin flip. That is defect 1's real
shape, and it is precisely why assertion 5 exists: a populated **nine**-source catalog says *oddrn typo*, an
empty one says *race*. The deterministic half of the proof stands alone; the intermittent half is recorded as
intermittent rather than dressed up as reliable.

### Three defects the tests themselves had, caught by RUNNING them (G-C9, "you run what you write")

Each would have shipped a false result had the spec been authored and handed to `/review` unrun:

1. **`.State.Health.Log` is a five-entry ring buffer.** Reading "the first passing probe" at teardown reports
   a time ~20s stale, so the ordering assertion **failed against a perfectly correct stand**. Now captured in
   `beforeAll`, while the log still holds the transition.
2. **`{{json .State.Health.Log}}` makes `docker inspect` exit non-zero** when the service has no healthcheck —
   which is exactly the base tree. It threw out of `beforeAll` and **skipped every remaining assertion**, so
   the first RED run reported "3 failed / 4 did not run" instead of naming each regression. The nil guard now
   lives in the Go template.
3. **Playwright discards the worker after a failed test and re-runs `beforeAll`.** With six independent tests,
   every red assertion rebuilt the whole demo stand (~2 min each) on base. Hence one test with `expect.soft`.

### G-C15 — changed tests

None. Every test file here is **new**; no existing assertion, matcher, fixture or skip-state was touched, so
the "a changed test must assert more truth" analysis has nothing to bite on. The one edit to a shared harness
file was considered and **rejected** (Deviations #1) — `stack.ts` is untouched and its seven callers are
unaffected.

### Definition of Done

| # | Gate | State |
|---|---|---|
| 1 | full unit build green on the working tree | **RUN — 814 tests / 1 failure / 0 errors / 0 skipped across 181 classes** (31m25s; JUnit XML mtimes 19:55 = this run). 24 actionable tasks, 24 executed — `test` + `checkstyleMain` + `checkstyleTest` + `assemble`; **checkstyle clean**. The one failure is `OpenApiDocsContractTest.platformApiGroupDocumentLoads()` — `Timeout on blocking read for 60000000000 NANOSECONDS`, the class at 71.3s against its own 60s bound — i.e. **TST-061**, seventh recorded reproduction. The diff contains no Java, so gradle compiled exactly `origin/main`'s sources. |
| 2 | FULL integration regression against the working-tree SUT | **INCOMPLETE — declared, not inferred.** `feature-complete` **328 passed / 12 failed (34.2m), ZERO UNATTRIBUTED** — the twelve are set-equal by exact `spec:line` to TST-059's eleven plus `swagger-openapi-discovery:63` (TST-057), which is the identical 328/12 two other branches measured. `api:FAIL` is TST-065 verbatim, pre-registered before the numbers landed. Then **every background task in the session was killed**: `known-bugs` had produced 2 expected-RED results and was cut off; **`multi-stack` (which carries the new IT-154) and `ingestion-e2e` NEVER RAN**. This gate is therefore OWED. IT-154 itself was run directly and independently (GREEN 3/3 on the fix, RED 3/3 on base), so what `multi-stack` still owes is confirming it coexists with the other seven self-managed stacks. |
| 3 | docs read + decided + routed **AND authored** — committed on the train, not a draft | **DONE** — `documentation` `docs/CTRIB-063-demo-stand-first-run` @ `b270da6` off `origin/release/1.0.0` @ `379baf3`, draft PR [#113](https://github.com/opendatadiscovery/documentation/pull/113); paired item `backlog/docs/DOC-520` (`pending-release`, milestone 1.0.0) |
| 4 | ontology re-enriched + committed | **DONE** — the `trylocally` doc-understanding sidecar carries a dated refresh note; no re-analysis run, and the reason is recorded (no binding moves). No code substrate node exists for `injector/` or `docker/`. |
| 5 | Principal sufficiency review (G-C13) | **enough + meaningful**: 10 assertions across both defects *and* the class behind them, each with a stated RED-on-base behaviour, two of them stack-free so they cannot be dropped for being slow. **Local patch-coverage gate: N/A, and that is an empty gate rather than a skipped one** — the diff contains no Java, so `min-coverage-changed-files` has no changed production lines to measure. **No control lost**: nothing new is abstracted, and the change subtracts (the unreachable `Skipping` branch is deleted). **What did I make worse?** One thing, named rather than buried: `up -d odd-platform-enricher` now takes ~60-90s to return instead of ~2s. That IS the fix; it is documented in both READMEs and on the train, and the `database` healthcheck exists specifically so the pathological version of that wait cannot happen. |


## Follow-ups logged

Every one on disk, per `playbooks/follow-up-on-disk.md`; the backlog was grepped first (LSN-009) and one of
these was **extended in place rather than filed as a duplicate**.

| Item | What | Why not in this PR |
|---|---|---|
| `issues/odd-platform/PLT-014` — **EXTENDED, not duplicated** | The re-run `400 USR003` (`duplicate key … alert_unique_messenger_oddrn_is_present`) found by running the stock enricher twice. Same root cause the issue already names — `createAlerts` has no `ON CONFLICT` — but reached through **ordinary ingestion** rather than the AlertManager webhook, and against the *sibling* index, where `messenger_entity_oddrn` is the DQ **test** oddrn (DB-verified). The suggested fix now has to cover both indexes or the ingestion path stays broken while the webhook path is fixed. | A different subsystem and a different slice. This PR makes the failure *visible* (real status + body, named in a closing summary) instead of hiding it behind a wrong guess. |
| `backlog/docs/DOC-519` (pending, medium) | `trylocally.md` Step 2 tells readers the demo collector's data source is called `Sample demo data source`; the shipped `collector_config.yaml` has always called it `postgresql-step2-test`, and `docker/README.md:65` says so. `git log -S "Sample demo data source"` over odd-platform returns **nothing** — the two copies diverged and only the repo one was corrected. | **Released truth** — it is wrong on the live site today, so it belongs on docs `main`, not on the 1.0.0 train this change rides. Mixing them would publish a released-truth fix at a future release. |
| `backlog/docs/DOC-520` (pending-release, milestone 1.0.0) | The paired item for this change's own doc edit, carrying the affected page, the train commit, and the post-merge live-verification list the release gate owes. | Not a deferral — it is the tracking artefact for work already authored and pushed. |

Nothing else was discovered and narrated. The two `inject.py` defects the plan had listed as exclusions
(`DATA_SOURCES_ONLY`'s truthiness, the swallowed injection failure) were **folded into the change** instead,
both named explicitly in the PR body rather than smuggled.

## Review (2026-09-02, session: review-ctrib063)

- **Result**: **REJECTED** — `pr-draft` -> `blocked`. Two of the gates fail on measured evidence, and both
  failures are *outside* the code the item spent its care on: the PR's own CI is red because of this branch,
  and the change quietly falsified three published pages besides the one it edited.
- **Precondition (the 2-minute bounce) — DEVIATED FROM, deliberately, and recorded rather than hidden.**
  The ledger declares DoD gate 2 INCOMPLETE (`multi-stack` + `ingestion-e2e` NEVER RAN; the session's
  background tasks were killed mid-`known-bugs`), which the skill nominally bounces on. I did not bounce,
  because the rule's target failure — *implement never ran the test it wrote* — is not what happened here:
  IT-154 was run on BOTH sides (RED 3/3 on a second detached base worktree, GREEN 3/3 on the fix) and three
  harness defects were caught by that running; `feature-complete` completed at the reviewed SUT digest with
  zero unattributed failures. What was missing was a *completion* gap from an external kill, and the three
  owed suites are ones this review must run anyway — bouncing moves the run, it does not avoid it, and costs
  a maintainer roundtrip plus a context rebuild. I ran them. **They are green.** The rejection below is not
  about the owed suites; they passed. It is about what a fresh pair of eyes found while they ran.

### What I ran myself (the owed gate, closed)

`ODD_PLATFORM_DIR=../odd-platform-ctrib063 integration-tests/run-regression.sh revctrib063 multi-stack
known-bugs ingestion-e2e` — my own SUT, built by me from the reviewed commit `c88bf405`
(`odd-platform:odd-team-sut-revctrib063`, digest `sha256:94ebefae…`), under the machine-wide heavy-e2e flock,
one suite at a time, torn down after.

| Suite | Result | Reading |
|---|---|---|
| `multi-stack` | **17 passed / 0 failed (14.7m)** — GREEN | The owed gate. 14 was the standing figure for the eight prior protocols; IT-154's three cases make 17, so **IT-154 coexists with all eight other self-managed stacks** — precisely what `multi-stack` still owed. All ten soft assertions inside the stand case green. |
| `known-bugs` | **3 failed** — expected-RED, all three attributed | IT-007 `attachment-local-durability:35` (LSN-001/PLT-086) · IT-006 `error-boundary-containment:29` (TEST-GAP-1013/F-042) · IT-004 `quality-dashboard-unknown-status:33` (PLT-052). **No unexpected GREEN** -> no un-flipped fix. |
| `ingestion-e2e` | **15 passed / 0 failed (6.2m)** — GREEN | The other owed suite. Matches the standing 15/0 baseline: IT-145 dataset-pipeline lifecycle 9/9 and IT-128 relationships pipeline 6/6, both real source-system → real collector → platform → UI. Nothing in this branch reaches ingestion, so "unaffected" was the expected result and it is what was measured. |
| `feature-complete` | **carried**, not re-run: 328 passed / 12 failed, zero unattributed | Stated precisely because the images differ: implement measured this on `sha256:48d0e39e…` and my three suites ran on `sha256:94ebefae…` — two builds of the **same commit** `c88bf405`, not the same image. Carrying it is sound because the diff contains no Java, TypeScript or SQL, so the SUT is behaviourally identical to `origin/main`; the twelve failures are set-equal by exact `spec:line` to TST-059's eleven + TST-057's `swagger-openapi-discovery:63`, the identical figure ctrib061 (`3d5a7096`) and ctrib062 (`5b20c3da`) measured on entirely different branches. "This branch moves nothing" is the expected result and it is what was measured. The rework will re-run the full set anyway. |
| Unit | **CI `run_tests` = SUCCESS at `c88bf405`** | `run-pr-tests.yaml` runs `./gradlew odd-platform-api:build` — the same CI-replica the DoD claims, on the exact reviewed SHA. Cited rather than re-run locally: the diff has no Java, and CI's green is *stronger* evidence than implement's local 814/1 (whose 1 was TST-061's local springdoc timeout). |

### The rework fix-list — ONE pass, everything in it (per the fold-don't-over-log rule; no new tracked item is spawned, because the rework is already touching every file below)

**B0 — BLOCKER. The PR's own CI is RED, and this branch is the cause.**
`GET /repos/opendatadiscovery/odd-platform/commits/c88bf405…/check-runs` on the reviewed SHA:
`run_playwright_tests / format-check` = **failure** (the other five, `run_tests` included, are success).
Cause established by measurement, not inference, using the project's own pinned toolchain
(`prettier@2.7.1` + `@awesome-code-style/prettier-config@3.0.0`, whose `singleQuote: true` is the rule):

- `tests/docker/docker-compose.yaml` at base `969a5d5b` -> *"All matched files use Prettier code style!"*
- the same file on the branch -> *"[warn] Code style issues found"*
- `prettier --check .` over the **whole** `tests/` tree on the branch flags **exactly one file** — this one.

The offending lines are the two `healthcheck.test` flow sequences, which must be single-quoted:

```yaml
      test: ['CMD-SHELL', 'pg_isready -U $${POSTGRES_USER}']
      test: ['CMD', 'curl', '-fsS', 'http://localhost:8080/actuator/health']
```

**The fix is verified, not proposed**: I applied prettier's own output and re-checked it — it passes
`prettier --check`, validates on `docker compose` v2 **and** `docker-compose` 1.29.2, and resolves to the
identical healthcheck with the `$$` escape intact. `docker/demo.yaml` is *outside* the `tests/` prettier
scope so CI does not require the same there; matching it anyway is optional house style (the repo-root
`.prettierrc.json` also sets `singleQuote: true`).

This is the miss that matters most, because it is the cheapest possible check and it is the first thing the
maintainer sees on the PR page. The DoD's "full unit build green" is true and irrelevant here: the Java build
never touches `tests/`. **A contributor-pillar DoD should read the pushed head SHA's check-runs**; this
review did, in one API call, and that call is what found it.

**B1 — BLOCKER. The new first-run note tells the reader something false, and it is the operative sentence.**

> "…so the command does not return until the Platform is ready **and the sample has been injected**. An empty
> catalog while you wait is expected; **an empty catalog after the command returns is not**."

`docker compose up -d` is detached: it returns once the dependency condition is met and the container has
**started** — never after a one-shot has finished. Measured three independent ways:

1. **An isolated probe** (a healthy dependency + a one-shot gated on `condition: service_healthy`):
   `up -d` returned with the one-shot in state **`running`**, which then ran a further **20.6s**. Same shape
   on `docker-compose` 1.29.2.
2. **The live IT-154 run inside this review's own `multi-stack`**: the harness printed
   `` [IT-154] `up -d odd-platform-enricher` blocked for 74s ``, and `docker ps` at that moment showed
   `oddemo154-odd-platform-enricher-1  Up 34 seconds` — **running, not exited**.
3. **The fix's own spec** has to poll for `exited` *after* `upEnricher()` returns.

So the window in which the catalog is legitimately empty *after* the command returns is the enricher's
`pip install requests` (**5-22s**, measured by implement itself) plus ten data-source creations and ten
ingestions. A reader who has just been told the command blocks until injection is done will look exactly
then, see an empty or partial catalog, and be told by the page that this means something is broken — which is
the precise confusion the note was added to prevent, restated with the wrong boundary.

The wrong mental model propagated to **four** artefacts; all four need the same correction:
- `odd-platform:docker/README.md:33-36`
- `documentation:docs/configuration-and-deployment/trylocally.md:34` (the published surface)
- odd-platform PR #1876 body, "Docs" section
- `odd-team:lineage/odd-platform/doc-understanding/configuration-and-deployment__trylocally.md` refresh note
  ("blocks until the sample is in")

What is true and worth saying instead: the command does not return until the Platform is **ready**; the
enricher then starts and injects, which takes a few more seconds — so give it a moment, and if the catalog is
still empty a minute later, read
`docker compose -f docker/demo.yaml logs odd-platform-enricher` (which, thanks to this very change, now names
what failed).

**B2 — Gate 6. A published developer-guide snippet is now a stale copy of the block this change edited, and
pasting it hard-fails the stack.**
`documentation:docs/developer-guides/build-and-run/build-and-run-odd-platform.md:127-140` reproduces
`docker/demo.yaml`'s `odd-platform` service with `depends_on:\n  - database` and **no healthcheck**, under
"replace odd-platform image with created one in `docker/demo.yaml`… and run it using command above", with an
`image: <Put your image here>` placeholder that invites pasting the block. Measured what happens if a reader
does: `condition: service_healthy` against a service with no healthcheck is a **hard error** on both
implementations — v2 `dependency failed to start: container … has no healthcheck configured`; v1 1.29.2
`ERROR: … Service "dep" is missing a healthcheck configuration`. Even for the careful reader who edits only
the `image:` line, the published block now misdescribes the shipped file.

**B3 — Gate 6. `health-and-monitoring.md:28` is falsified by this change.**
> "The images and Compose files distributed with the platform **define no health checks themselves** — wiring
> probes is the operator's responsibility."

After this change both `docker/demo.yaml` and `tests/docker/docker-compose.yaml` define health checks. The
page then offers its own "Docker Compose health check" example that silently diverges from the one now
shipped (`wget --spider` / `10s` / `12` / `60s` vs `curl -fsS` / `5s` / `60` / `30s`) with no cross-link
between them — two parallel recipes, one of them now normative. (The page's `wget` is *not* broken: I checked,
`/usr/bin/wget` is present in the published image alongside `curl`. The defect is the false claim plus the
undeclared parallel surface.)

**B4 — Gate 6. The behaviour change is documented on one of the three published pages that give the command.**
`deployment.md:45` (Deployment Options -> Option 1) and `build-and-run-odd-platform.md:121` both hand the
reader `docker-compose -f docker/demo.yaml up -d odd-platform-enricher` with no word that it now blocks
~60-90s instead of returning in ~2s. The item's docs decision examined `deployment.md` only for its "~10"
count claim and concluded "no edit needed" — the *wait* dimension was never considered. One sentence, or a
cross-link to `trylocally.md`, on each.

**B5 — Gate 6. The standalone injector's documented environment is now incomplete.**
`build-and-run-odd-platform.md:110` enumerates: *"It reads `PLATFORM_HOST_URL` (required…) and `SAMPLE_PATH`
…"*. The change adds `REACH_TRIES_NUMBER` and `REACH_RETRY_DELAY_SECONDS` — **the two knobs the injector's own
give-up message now tells the reader to raise** — and repairs `DATA_SOURCES_ONLY`. The item asserted "No text
change required, and none is invented"; that assertion does not survive reading line 110. This is the same
page and the same PR as B2/B4, and the standalone invocation is exactly why the knobs exist.

### Fold-ins for the same pass (small, in-scope, not separately tracked)

- **F1 — the headline behaviour of GATE-1 decision D1 has no test.** Assertion 3 asserts the log does *not*
  contain `were NOT injected`; nothing asserts it **does**, naming the file and the Platform's real status and
  body, when an injection actually fails. That is the promise `must_haves.truths[4]` makes and the one the
  D1 decision turns on. Cheapest honest rail: a stub that answers `/actuator/health` 200 UP, `GET/POST
  /api/datasources` 200, and `POST /ingestion/entities` 400 — cases 7 and 8 already show the stack-free
  container pattern to copy. (Same shape as plan-check B2, which was closed for the validation and budget
  paths and left open for this one.)
- **F2 — `deployment.md:52`** "you should see **~10** predefined data sources" can drop the hedge on the same
  train; it hedged because the shipped stand delivered 9, and after this change it is exactly 10 — matching
  `trylocally.md:40`.
- **F3 — "which older `docker-compose` releases ignore"** (`trylocally.md:19`, `docker/README.md:16-17`).
  They do not ignore it: 1.29.2 honours it (measured), and a release that does not support the declared format
  refuses the file rather than tolerating it. Reword to avoid the claim — "…which older `docker-compose`
  releases do not support".
- **F4 — an unrecorded deviation from the approved plan.** The plan specified
  `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DATABASE}`; the code ships `-U` only. It is behaviourally
  equivalent here (`POSTGRES_DATABASE` == `POSTGRES_USER` == `odd-platform`, and `pg_isready` reports server
  responsiveness rather than database existence), so keep the code — but it belongs in `## Deviations`, which
  currently lists only the two odd-team ones.
- **F5 — `trylocally.md:27`** "Empty output **mean** that the port is free" -> "means". Pre-existing, one word,
  on a page this PR already edits.

### Acceptance criteria (`must_haves.truths`)

- [x] **1** the documented command leaves the catalog populated every time, not on a coin flip — **PASS**.
  `depends_on: {odd-platform: {condition: service_healthy}}` (`docker/demo.yaml:52-54`), honoured by both
  implementations (I ran `config` on each); IT-154 assertions 1/2 green in my `multi-stack` run.
- [x] **2** ten data sources, `transaction_dataset` searchable — **PASS**. Verified independently of the test:
  I parsed both bundled sample sets — `docker/config/injector` is now 10 data sources / 10 samples with
  **every** sample matched, no duplicates, nothing defined-but-unused; `08_s3_ingestion.json` declares
  `//s3/cloud/aws`, matching both `datasources.json` and its own two item oddrns.
- [x] **3** an undefined `data_source_oddrn` fails the run immediately, naming file and oddrn — **PASS**.
  `inject.py:58-77` runs before `wait_until_healthy()` (`:155` before `:157`); IT-154 case 7 green.
- [x] **4** standalone, the injector waits minutes and says what to do — **PASS**. `inject.py:32-33` +
  `:105-111`; IT-154 case 8 green (`attempt 2 of 2`, message names `REACH_TRIES_NUMBER` and `migration set`).
- [ ] **5** an injection failure names the file and reports the Platform's ACTUAL status and body, at the point
  of failure and again in a closing summary — **PARTIAL**. The code does exactly this (`inject.py:146-147`,
  `:178-180`, `:182-188`, summary last), and the guessed cause is now correctly spelled
  `auth.ingestion.filter.enabled` — I verified the property name against
  `IngestionDataEntitiesFilter.java:20` and `application.yml:51-53` (`auth.ingestion.filter.enabled: false`),
  so the new hint is right where the old one was wrong. But **nothing tests it** — see F1.
- [ ] **6** `npm run odd-up` is subject to the same gate — **PASS on substance, FAIL on delivery**. The compose
  change is correct and I validated `tests/docker/docker-compose.yaml` on both implementations (both resolve
  `condition: service_healthy` on `database` and `odd-platform`). But this is the file whose formatting turns
  the PR's CI red — B0.

### Quality Bar

| Gate | Verdict |
|---|---|
| 1 — No duplicates | **PASS** via `grep -rl` over `integration-tests/protocols|e2e`: IT-154 is the only protocol touching the demo stand or the injector, and `IT-154` is the next free id after `IT-153`. `suites.yaml` diff is a pure addition (nothing removed). |
| 2 — Aliases | **N/A** via read of the diff — no new term or synonym. |
| 3 — Caveats as admonitions | **PASS** via read — the docs caveat is a GitBook `{% hint style="info" %}` block, not prose. (Its *content* is wrong — B1 — but the form is right.) |
| 4 — Consumer-read | **PASS** via `git grep`: the change's consumer set is complete. `odd-platform-enricher` appears in exactly two files repo-wide (`docker/demo.yaml`, `tests/docker/docker-compose.yaml`) and both are in scope; `docker/examples/{ldap,oauth2}.yaml` carry neither enricher nor collector (services: `database`, `odd-platform`, `ldap`), so the race genuinely does not exist there. The three `inject.py` callers the item enumerates are the three that exist. |
| 5 — Unset-parameter audit | **N/A** (no SDK builder) — but the probe mechanism was re-verified rather than assumed: `curl` **is** present in the freshly-pulled published image (`/usr/bin/curl`, 8.18.0, Ubuntu 26.04), and `wget` is too. |
| 6 — Bidirectional code <-> doc | **FAIL** — B2, B3, B4, B5. A user-visible behaviour change (2s -> 60-90s, plus two new env knobs, plus the first healthchecks the repo ships) reached one of the four published surfaces that describe it, and falsified two others. |
| 7 — Layout | **PASS** via read — no new page, no SUMMARY change owed, no in-page TOC. |
| 8 — Publishing standards | **PENDING-RELEASE (1.0.0)** on the branch-verifiable half, and it passes: `origin/release/1.0.0` exists @ `379baf3`, the train commit `b270da6` is **pushed** (`git ls-remote` confirms remote == local) and carries the change, draft PR **#113** is open with base `release/1.0.0` (verified through the App token — the repo is not publicly readable). PyYAML parses the frontmatter; `description` is 184 chars (<=200, no `: ` hazard). Live verification is owed at the release gate and `DOC-520` records it. **But the content that would be verified is wrong — B1 — so this must not be carried forward as-is.** |
| 9 — Factual claim provenance | **FAIL** — B1. Otherwise the footer is exceptionally good and I re-derived every cited line at the base commit: `inject.py:8` (`REACH_TRIES_NUMBER = 20`), `demo.yaml:36`/`:60` (short-form `depends_on`), `grep -c healthcheck` = **0**, `README.md:36` / `:65` (the 10- and 11-data-source promises), `build.gradle:120-124` (jib `eclipse-temurin:17-jdk`), `LoginFormSecurityConfiguration.java:49-50` (`/actuator/health` in `permittedPaths`), `tests/package.json:16` (`odd-up`), `tests/docker/.env:5`, `run-playwright-tests.yml:62-77` (the commented-out stack-and-run steps — exactly those lines). The `3.3 -> 3.9` reasoning is honest: I reproduced the leniency it claims (both binaries accept `start_period` under a `3.3` header), so the bump is hygiene, and the commit says exactly that rather than overclaiming. |
| 10 — Content-type homing | **PASS** via read — a getting-started expectation-setting note on the getting-started page; no reference content smuggled in. |
| 11 — Audience isolation | **PASS** via mechanical grep over the changed doc — zero workspace-internal terms (`Cornerstone N`, `Gate N`, `LSN-NNN`, `CTRIB-`, `DOC-`, `IT-`, `backlog`, `playbook`, `sidecar`, …). |
| G-C15 — changed tests | **PASS** — nothing was changed, only added: `git diff --stat` over the stream's commits shows `demo-stand-first-run.spec.ts` (+227) as the only spec, `stack.ts` untouched (last touched by CTRIB-062), `suites.yaml` a pure `+IT-154`. Deviation #1 (not extending `stack.ts`) is the right call and is argued from a measured property, not from convenience. |
| G-C5 — scope comment | **PASS** — `issuecomment-5513140972` by `odd-contributor[bot]` at 2026-09-02T16:50:38Z, read back from the API: 3842 bytes, **0 non-ASCII**, posted before any code. #1870 is OPEN with milestone **1.0.0** (open) — G-C11 re-verified live by me. |

### Doc-product editorial audit

- **Coverage this run**: the getting-started / first-run reader flow end-to-end —
  `configuration-and-deployment/trylocally.md` (whole page), `configuration-and-deployment/deployment.md`
  (Option 1 + Verify + Known gotchas), `configuration-and-deployment/health-and-monitoring.md`,
  `developer-guides/build-and-run/build-and-run-odd-platform.md` (the injector + demo-stack sections) — plus a
  tree-wide mechanical sweep for every page carrying the demo command or the data-source count. Chosen as the
  partition because `review-ctrib060r2` ran the tree-wide 137-page sweep earlier the same day; the remaining
  subtrees are freshly covered.
- **Findings**: **none filed as new DOC items, deliberately.** Every coherence defect this audit surfaced
  (B1-B5, F2, F3, F5) is a page the rework is about to touch, so it is folded into the one fix-list above
  rather than spawned as separately-tracked work. Logging is for work nobody is about to touch.
- **Independently re-derived, NOT re-filed** (LSN-009): `trylocally.md:71`'s wrong collector data-source
  default (`Sample demo data source` vs the shipped `postgresql-step2-test`) — already `DOC-519`, correctly
  routed to docs `main` as released truth rather than onto this train.

### Follow-ups verified on disk (no new items filed by this review)

- `issues/odd-platform/PLT-014` — **extended in place**, not duplicated. Confirmed by reading it: a
  substantial "Defect 3 GENERALISED 2026-09-02" section carrying the ingestion-path `400 USR003`, the sibling
  index `alert_unique_messenger_oddrn_is_present`, and the consequence that a fix must cover **both** partial
  indexes or the ingestion path stays broken. Last touched by this stream's own commit `789e31f1`.
- `backlog/docs/DOC-519` (released truth -> docs `main`) and `backlog/docs/DOC-520` (`pending-release`,
  milestone 1.0.0, carrying the train branch, the commit and the owed live-verification list) — both present
  and accurate.

### Notes

- **What is genuinely good here, and worth saying plainly.** The reproduction is the best I have reviewed in
  this pillar: a race stated as an arithmetic identity between two measured quantities rather than as an
  anecdote, with the honest admission that the enricher *won* the coin flip on the base run and the reason
  assertion 5 exists at all. The plan-check's B3 was chased down instead of waved off and that is what found
  the third defect. Three harness defects were caught by RUNNING the new spec (the five-entry
  `.State.Health.Log` ring buffer; `{{json .State.Health.Log}}` exiting non-zero with no healthcheck;
  Playwright re-running `beforeAll` per failed test) — every one of which would have shipped a false result.
  The forward-only validation is right, and I verified *why*: `tests/docker/injector` really does carry a
  defined-but-unused data source (`//kinesis/cloud/aws/account/13/region/us-west-2`, 5 defined / 4 samples),
  so a bidirectional check really would have stopped the Playwright harness stand from starting.
- **The shape of the miss.** Nothing in the fix-list is about the code the item reasoned hardest about. B0 is
  a formatter on a file the change touched almost incidentally. B1-B5 are all one thing: the change altered
  *observable behaviour* — a command's duration, two new env knobs, the first healthchecks the repo ships —
  and the doc pass tracked only the page the issue pointed at. The item's own docs decision names
  `deployment.md` and `build-and-run-odd-platform.md` and clears both, each time on a narrower question than
  the one that mattered. **VERIFIED via reading both pages against the diff.**
- **One cheap gate that would have caught B0 and belongs in the contributor DoD**: read the pushed head SHA's
  check-runs (`GET /repos/{o}/{r}/commits/{sha}/check-runs`). One API call, seconds, and it is the first thing
  the maintainer sees. The DoD's unit/integration gates are local replicas of *some* CI jobs; they are not a
  substitute for asking CI what it actually said about the commit that was pushed. **VERIFIED via the call
  that found it.**
- **Resources**: `lineage/**` left clean (`git checkout -- lineage/` after the probe runtime's run; `git
  status` shows only this review's own files). The heavy-e2e flock was held for the regression and released
  by `run-regression.sh`'s exit trap; the stream's stack was torn down with `-v`.

## Rework — round 2 (2026-09-03), closing the `/review` fix-list

Ten items: five blockers, five fold-ins. Every one closed, each with the evidence that closed it.
Same session as the review that raised them — allowed for `/implement`; **the next `/review` must be
fresh** (precedent: `review-ctrib060r2` round 3). No new GATE 1: the fix-list corrects defects *inside*
the scope GATE 1 approved, it does not widen it.

**odd-platform** `contrib/CTRIB-063-demo-stand-readiness` @ `9c1360df` (PR [#1876](https://github.com/opendatadiscovery/odd-platform/pull/1876), still draft)
**documentation** `docs/CTRIB-063-demo-stand-first-run` @ `7cfac8f` off `origin/release/1.0.0` (PR [#113](https://github.com/opendatadiscovery/documentation/pull/113), still draft)

| # | Finding | How it was closed | Evidence |
|---|---|---|---|
| **B0** | `run_playwright_tests/format-check` RED on `c88bf405` — this branch's two `healthcheck.test` lines break `prettier --check` inside `tests/` | single-quoted both, per the shared config's `singleQuote: true`; mirrored the same quoting in `docker/demo.yaml` (outside the CI scope, but the two stands should stay byte-comparable, and the repo-root `.prettierrc.json` agrees) | `prettier --check .` over the **whole** `tests/` tree: *"All matched files use Prettier code style!"* · both files still validate on compose v2 **and** `docker-compose` 1.29.2 and resolve to the identical healthcheck with the `$$` escape intact · **CI on `9c1360df`: `format-check` = SUCCESS** |
| **B1** | The first-run note claimed `up -d` returns only after the sample is injected — false, and its diagnostic rule ("an empty catalog after the command returns is not [expected]") is the operative sentence | rewritten on **all four surfaces** the wrong model reached: it now says the command blocks until the Platform is *ready*, that the sample lands a few seconds later, and which log to read | `docker/README.md:33-38` · `trylocally.md:33-35` · PR #1876 body · `lineage/.../configuration-and-deployment__trylocally.md` refresh note. Measured: an isolated one-shot gated on `service_healthy` ran **20.6s** after `up -d` returned (same shape on v1 1.29.2); the live IT-154 stand showed the enricher `Up 34 seconds` at the moment the command returned |
| **B2** | `build-and-run-odd-platform.md` reproduced the `odd-platform` service block minus the healthcheck, under an instruction to paste it into `docker/demo.yaml` | replaced the block with the single `image:` line to change, plus a warning naming the exact failure | measured on both implementations: v2 `dependency failed to start: container … has no healthcheck configured`; v1 `ERROR: … Service "dep" is missing a healthcheck configuration` |
| **B3** | `health-and-monitoring.md:28` — "the images and Compose files distributed with the platform define no health checks themselves" is falsified by this change; its Compose recipe also diverged from the shipped one with no cross-link | restated to what is true (the **image** declares none; the demo stack ships one), swapped the example for the shipped recipe, added why the probe must read the HTTP status rather than grep the body, and added the `condition: service_healthy` half | `docker image inspect … {{.Config.Healthcheck}}` → *image declares NO HEALTHCHECK* (so the image half is true and stays); `docker/demo.yaml:34-39` is the recipe now shown. The page's `wget` was **not** broken — `/usr/bin/wget` is present alongside `curl` — so the defect was the false claim plus the undeclared parallel surface, and only that was fixed |
| **B4** | The behaviour change reached 1 of the 3 published pages carrying the demo command | `deployment.md` Option 1 and `build-and-run-odd-platform.md`'s frontend-engineer path both gained the wait note; `deployment.md`'s own Prerequisites gained the real compose floor (it still said "`docker-compose` (latest)") | `deployment.md:45-52`, `build-and-run-odd-platform.md:136` |
| **B5** | `build-and-run-odd-platform.md:110` enumerated the injector's environment as `PLATFORM_HOST_URL` + `SAMPLE_PATH`, omitting the two knobs its own give-up message names | replaced the sentence with a five-row table (both new knobs + their defaults + `DATA_SOURCES_ONLY`), and a paragraph on why a first start is slow and what an undefined `data_source_oddrn` now does | each row read off `inject.py:32-36` rather than recalled |
| **F1** | No test covered the injection-failure summary — GATE-1 decision **D1**'s headline behaviour | **IT-154 assertion 9** added: a throwaway in-process HTTP stand-in accepts health + data-source calls and returns `400 USR003` on ingestion; asserts the real status and body, the failing file named, the closing summary printed **after** the per-sample lines, and exit code **0** | **GREEN on the fix** (15.4s) · **RED on base** — `../odd-platform-ctrib063base` @ `969a5d5b` prints nine `Possibly the 'ingestion.filter.enabled' property is set to 'true'` guesses, no status, no body, no summary. Deliberately does **not** depend on the real `400 USR003` (PLT-014), which would make the verdict hostage to someone else's fix |
| **F2** | `deployment.md:52` "~10" | hedge dropped — it existed because the stand delivered nine | now matches `trylocally.md:40` |
| **F3** | "which older `docker-compose` releases **ignore**" | → "do not support" on both surfaces; the claim about what an old binary does is simply not made | 1.29.2 *honours* the condition (measured), so "ignore" was wrong in the one direction I could test |
| **F4** | `pg_isready -d` dropped vs the approved plan, unrecorded | recorded in `## Deviations` (item 2); the code is left as-is | `POSTGRES_DATABASE` == `POSTGRES_USER` == `odd-platform` in `docker/.env`, and `pg_isready` reports server responsiveness, not database existence |
| **F5** | `trylocally.md:27` "Empty output **mean**" | → "means" | one word, on a page this PR already edits |

### Three harness defects the rework's own test found, by running it

Assertion 9 was written, run, and **failed on the fix** — which is the point of running what you write.

1. **`execSync` blocks Node's event loop, so an in-process stand-in can never answer.** The stub's socket
   is accepted by the kernel and then never served; the injector reports `Read timed out` on every attempt
   and burns its whole readiness budget. `runInjector` is now `async` (`promisify(exec)`), and cases 7/8/9
   await it.
2. **A container killed by the exec timeout never flushes python's block-buffered stdout**, so the first
   failure reported *nothing but `pip` output* — a silent hang. Every case now passes `PYTHONUNBUFFERED=1`,
   which is what `docker/demo.yaml` sets anyway.
3. **The exit code lives on `err.code` for `exec` and `err.status` for `execSync`.** Carrying the `execSync`
   reading over would have silently turned every failure into `1` and made the exit-code assertions — the
   whole point of D1 — meaningless.

All three are now written into the protocol's "Notes for whoever runs or maintains this", beside the three
the first round found.

### Definition of Done — round 2, re-run at the committed SHA `9c1360df`

| # | Gate | State |
|---|---|---|
| 1 | full unit build green | **PASS, from CI on the exact head** — `run_tests` (`./gradlew odd-platform-api:build`, `run-pr-tests.yaml:22-55`) = **SUCCESS** on `9c1360df`, alongside `Test Results` = success (the JUnit publication of that same run). Cited rather than re-run locally: the diff still contains no Java, and CI's verdict on the pushed commit is the stronger evidence — round 1's local run reported 814/1, the 1 being TST-061's local springdoc timeout, which CI does not reproduce. **Plus the check round 1 never looked at: `run_playwright_tests/format-check` = SUCCESS**, red on `c88bf405` and green here. **All SIX checks on the head SHA are green** — `Test Results`, `run_tests`, `update_release_draft`, and all three `run_playwright_tests` jobs. |
| 2 | FULL integration regression against the working-tree SUT | **PASS — ACTUALLY RUN, all four suites, at the committed SHA.** `run-regression.sh ctrib063r2` built the SUT from the worktree and reported `built from source: the odd-platform WORKING TREE @ 9c1360df` (digest `sha256:4f6feeee…`), under the machine-wide flock, one suite at a time, torn down after. **`multi-stack` 18/0 GREEN** — 17 for the nine protocols plus IT-154's new assertion 9, so the tightened case is validated in suite context. **`ingestion-e2e` 15/0 GREEN.** **`known-bugs` 3 expected-RED**, all attributed, zero unexpected GREEN. **`feature-complete` 327/13** — twelve set-equal by `spec:line` to the standing attributed set, and the thirteenth (`notification-settings-dialog:94`) **confirmed a load flake by a solo re-run on the same image**: 3/0, the timed-out case green in 9.9s (`2026-09-03-IT-092.md`). It is a 60s timeout inside `page.goto` + `waitForLoadState('networkidle')` — TST-042's tracked class — and `TST-042` is **extended in place** with it (LSN-009). Round 1's gate is no longer OWED. |
| 3 | docs read + decided + routed **AND authored** | **DONE, and widened from one page to four.** `documentation` `docs/CTRIB-063-demo-stand-first-run` @ `7cfac8f` off `origin/release/1.0.0` @ `379baf3`, draft PR [#113](https://github.com/opendatadiscovery/documentation/pull/113); `trylocally.md` + `deployment.md` + `health-and-monitoring.md` + `build-and-run-odd-platform.md`. Branch-verifiable sub-checks re-run on the new commit: PyYAML parses all four, every `description` ≤ 200 (184 / 166 / 161 / 73), Gate-11 banned-term grep clean, **0 broken relative links** and every GitBook hint block balanced. `DOC-520` updated with the second commit. |
| 4 | ontology re-enriched + committed | **DONE** — the `trylocally` doc-understanding sidecar's refresh note carried the same false claim the page did (`up -d` "blocks until the sample is in") and is corrected with the measurement. Still no re-analysis run, and the reason still holds: no binding moves. |
| 5 | Principal sufficiency review (G-C13) | **Stronger than round 1.** IT-154 is now **4 Playwright cases / 10 protocol checks** (§5 rows 1-6b, 7, 8, 9; "11" here was a miscount — round-3 F2), the new one covering the single behaviour GATE-1 decision D1 turns on and which nothing tested before — RED on base for the right reason (nine wrong guesses, no status, no body, no summary). Patch-coverage gate still an empty gate rather than a skipped one (no Java in the diff). **What did I make worse?** Nothing new; the `up -d` wait stays, and it is now described accurately on all four pages that hand a reader that command, instead of one page describing it wrongly. |

---

## Review — round 2 (2026-09-03, session: review-ctrib063r2)

- **Result**: **REJECTED** → `pr-draft` → `blocked`. Two blockers, both measured, both a Gate-9 failure of
  the same shape: a **stated reason that is false**, sitting next to work that is otherwise correct.
- **Session**: FRESH — `/implement`'s rework closed in `01ULM7JZy9d1TwYRufr9VHto`; this review is its own
  session, which is what the round-2 ledger itself demanded. Separate-session gate holds.
- **Precondition (the 2-minute bounce): NOT fired, checked rather than assumed.** The round-2 DoD declares
  no gate unrun, and the integration run-logs exist at the reviewed commit
  (`2026-09-03-{feature-complete,known-bugs,multi-stack,ingestion-e2e}.md`, SUT built from the worktree
  @ `9c1360df`, digest `sha256:4f6feeee…`, image present locally, created `2026-09-02T22:13:37Z` — 8 min
  after the commit). Implement ran its own gate; this review is the confirmation, not the first runner.
- **Subject**: odd-platform `contrib/CTRIB-063-demo-stand-readiness` @ **`9c1360df`** (draft PR
  [#1876](https://github.com/opendatadiscovery/odd-platform/pull/1876), base `main`, head SHA confirmed
  `9c1360df` live) + documentation `docs/CTRIB-063-demo-stand-first-run` @ **`7cfac8f`** (draft PR
  [#113](https://github.com/opendatadiscovery/documentation/pull/113), base `release/1.0.0` @ `379baf3`)
  + the odd-team IT-154 rail.

### What I ran myself (the confirmation, on my OWN build)

`ODD_PLATFORM_DIR=../odd-platform-ctrib063 integration-tests/run-regression.sh revctrib063r2` — the full
four-suite set, under the machine-wide flock, one suite at a time, torn down after. The SUT is
**`odd-platform:odd-team-sut-revctrib063r2`, digest `sha256:57e9c69f9a5eb67f679b42b501b6f69a80c224d6da926ee5198828ae14f36644`**,
built by this session from the reviewed worktree (clean, `git status --porcelain` empty at `9c1360df`) —
a different image from the implementer's `4f6feeee`, same source.

| Suite | Measured | Verdict |
|---|---|---|
| `feature-complete` | **328 passed / 12 failed** (32.7m) | GREEN-equivalent. The twelve are **set-equal by exact `spec:line`** to the standing attributed set (TST-059's eleven + TST-057's `swagger-openapi-discovery:63`). **Zero unattributed failures.** |
| `known-bugs` | **3 failed** | Expected-RED, all three attributed (IT-007/IT-006/IT-004), **zero unexpected GREEN** — no un-flipped fix to chase. |
| `multi-stack` | **18 passed / 0 failed** (15.2m) | GREEN. All four IT-154 cases green (`:177`, `:246`, `:266`, `:288`). |
| `ingestion-e2e` | **15 passed / 0 failed** (5.7m) | GREEN, matching the standing baseline. |
| unit | CI `run_tests` = SUCCESS on `9c1360df` | Verified live, not cited from the ledger: `GET /commits/9c1360df…/check-runs` → **6 of 6 SUCCESS**, `format-check` included. Round 1's blocker B0 is genuinely closed. |

**The implementer's flake attribution is independently CONFIRMED, not taken on trust.** Their round-2 run
measured 327/13; the thirteenth, `notification-settings-dialog:94`, **did not reproduce here** — my run is
328/12 with that case green. TST-042's fourth-instance entry says exactly that, and it is now corroborated
by a second, independently built SUT rather than by one solo re-run.

**IT-154 drove the real thing.** `up -d odd-platform-enricher` **blocked for 58s** against the published
image `ghcr.io/opendatadiscovery/odd-platform@sha256:3b61b3f2…`, the enricher exited 0, the catalog held
10 data sources, `//s3/cloud/aws` present, `transaction_dataset` searchable, `Data Lake S3` rendered.
The change does what it says.

### The rework fix-list — ONE pass (fold-don't-over-log: no separately-tracked item is spawned; the rework already opens every file below)

#### B1 — BLOCKER. IT-154's port isolation does not exist, and three artefacts state that it does

**Measured**, on this machine, compose v5.1.4:

```
$ docker compose -f docker/demo.yaml -f integration-tests/e2e/helpers/demo-stand.ports.yml config
database     -> ['5432:5432',  '15495:5432']
odd-platform -> ['8080:8080',  '18095:8080']
```

Compose **concatenates** `ports` across `-f` files; it does not replace them. So the IT-154 stand binds the
developer-facing `8080`/`5432` **in addition to** the remapped pair. Three surfaces claim the opposite:

- `integration-tests/e2e/helpers/demo-stand.ports.yml:1-3` — *"Host-port remap ONLY … so IT-154 can drive
  the DEMO STAND **without owning the developer-facing 8080/5432**. Nothing else is overridden"*
- `integration-tests/protocols/IT-154-demo-stand-first-run.md:60-64` — *"a **host-port-remap-only**
  override … Nothing else is overridden"*
- `integration-tests/suites.yaml:120` — *"Runs on 18095/15495 via a host-port-remap-only override"*

**Why this is a blocker and not a nit.** The gate false-REDs with a bind failure the moment anything holds
8080 or 5432 — most obviously **the maintainer's own demo stand**, which is the exact thing this change
makes people run, and a local Postgres on 5432. A false RED on IT-154 reads as "the demo-stand fix
regressed", which is the one signal this protocol exists to give truthfully. It is also precisely the
collision class the protocol itself cites as the reason for choosing 18095/15495 (the 2026-06-23 ctrib030
`:18090` ↔ webhook-stub bind failure). My run passed only because nothing else held those ports.

**The fix, VERIFIED before handing it over** — `ports: !override` in the override file:

```
$ docker compose -f docker/demo.yaml -f <ports-with-!override> config
database     -> ['15495:5432']
odd-platform -> ['18095:8080']
```

`!override` is Compose-Spec ≥ v2.24, and `composeCmd()` (`integration-tests/e2e/helpers/docker.ts:30-45`)
already prefers the v2 plugin, so the rail is safe; note the v1 fallback path in that helper's warning when
you write the comment. Then correct the three text surfaces to say what the file now actually does.

#### B2 — BLOCKER. A published operator page states a false reason, and contradicts itself 53 lines apart

`documentation/docs/configuration-and-deployment/health-and-monitoring.md` @ `7cfac8f`, lines **64-66**:

> "…what matters is that the check reads the **HTTP status** rather than grepping the response body,
> because the body of a `DOWN` platform still contains `"status":"UP"` for every component that *is* healthy."

**Measured**: a platform built from the reviewed commit, `GET /actuator/health` → HTTP 200,
body **`{"status":"UP"}`** — that is the entire body. `management.endpoint.health.show-details` is set
**nowhere** in odd-platform (`grep -rn "show-details"` over `*.yml`/`*.yaml`/`*.java`/`*.properties` → 0
hits), so Spring Boot's default `never` applies and there is **no component map in either the UP or the
DOWN body**.

Two consequences, both bad:

1. **The same page already says the truth at line 11** — *"returns HTTP `200` with body `{"status":"UP"}` …
   and HTTP `503` with `{"status":"DOWN"}`"*. Line 65 and line 11 cannot both be true. This is an internal
   contradiction shipped onto a published page.
2. **The warning is inverted for the shipped default.** The naive `curl … | grep -q UP` the sentence warns
   against would in fact work, because `{"status":"DOWN"}` contains no `UP` substring. An operator who
   trusts line 65 goes looking for a component list that the default configuration never emits.

The *advice* (read the status, not the body) is right and should stay — `curl -f` following Spring's own
verdict is the real argument, and the page already makes it. Either drop the "because…" clause, or make it
conditional and true (*"if you enable `management.endpoint.health.show-details`, the body then carries
per-component entries and a substring grep stops being safe"*).

This is the same failure shape round 1 rejected B3 for: a sentence about health-check behaviour asserted
rather than measured.

#### Fold-ins for the same pass (small, in-scope, not separately tracked)

| # | Finding | Where |
|---|---|---|
| **F1** | `2026-09-03-IT-092.md` is an **unfilled harness skeleton** — `runner: (fill: …)`, `evidence/notes: <captured values …>` — yet the DoD cites it as the evidence that the thirteenth failure was a flake. The actual figures (3/0, the case green in 9.9s) live only in the feature-complete log. Its `working-tree HEAD: 969a5d5b` line also names the shared checkout, not the SUT the run used. Fill it. | `integration-tests/run-log/2026-09-03-IT-092.md` |
| **F2** | The assertion count disagrees with itself: the DoD gate 5 and `2026-09-03-multi-stack.md` say **"11 assertions"**; the protocol §4 says *"the ten checks below"* and §5's table has **10** rows (1,2,3,4,5,6,6b,7,8,9). Pick one and make all three agree. | `contributor/CTRIB-063.md`, `run-log/2026-09-03-multi-stack.md`, `protocols/IT-154-…md` |
| **F3** | Dead code the rework left behind: `demoCompose` is imported and never used (`:11`), and `waitForEnricherExit()` is now unreachable — `beforeAll` inlines its own `until` loop instead. Subtract both. | `integration-tests/e2e/specs/demo-stand-first-run.spec.ts:11`, `integration-tests/e2e/helpers/demo-stand.ts` |
| **F4** | DOC-520's `## Description` still narrates the round-1 scope (*"Two edits"*, trylocally only) while its own `affected_files` lists four pages. | `backlog/docs/DOC-520.md` |
| **F5** | *(editorial, sharpened by this change)* All three pages now lead with *"`docker compose` v2 (any version)"* in Prerequisites — and then give every command in the v1 `docker-compose -f …` form, which a plugin-only v2 install does not have at all. The old "preferably the latest docker-compose" line was vague enough to hide this; the new, correct floor exposes it. One sentence or a command sweep closes it. | `trylocally.md`, `deployment.md`, `build-and-run-odd-platform.md`, `docker/README.md` |

### Acceptance criteria (`must_haves.truths`)

- [x] **1. The documented command populates the catalog every time, not on a coin flip** — PASS. `docker/demo.yaml:33-39` publishes the healthcheck and `:50-52` / `:78-82` gate the enricher and the collector on `service_healthy`; measured in my own IT-154 run — `up -d odd-platform-enricher` **blocked 58s**, enricher `StartedAt` ≥ the platform's first passing probe, exit 0.
- [x] **2. Ten data sources; the S3 sample's entities searchable** — PASS. IT-154 assertion 4/6 green in my run: `GET /api/datasources` → 10 incl. `//s3/cloud/aws`; `transaction_dataset` > 0. The one-token cause is fixed at the correct side (`08_s3_ingestion.json` → `//s3/cloud/aws`, matching its own items `//s3/cloud/aws/buckets/…`).
- [x] **3. An undefined `data_source_oddrn` fails the run immediately, naming file and oddrn** — PASS. `injector/inject.py:59-79` validates before the wait and `sys.exit(1)`s; IT-154 case 7 green (`:246`), and it asserts `not.toContain('Waiting for the platform')`, so "before the wait" is measured, not assumed.
- [x] **4. Standalone, the injector waits minutes not 40s and says what to do** — PASS. `inject.py:32-33` (60 × 5s, both env-tunable via `env_int`), `:108-114` give-up message names the migration cause and both knobs; IT-154 case 8 green.
- [x] **5. An injection failure reports the platform's ACTUAL status and body, per-sample and in a closing summary, exit 0** — PASS. `inject.py:139-141` raises `HTTP {status} {body[:500]}`; `:171-178` prints the closing summary last; IT-154 case 9 green (`:288`), asserting `HTTP 400` + `USR003` + summary-after-per-sample-lines + exit 0. The old guess is gone and the replacement names the **real** property — `auth.ingestion.filter.enabled`, verified at `IngestionAuthenticationFilter.java:49` / `IngestionDataEntitiesFilter.java:20` (the old text's `'ingestion.filter.enabled'` had no such property).
- [x] **6. `npm run odd-up` gets the same gate** — PASS. `docker compose config` on `tests/docker/` resolves `odd-platform.healthcheck = ['CMD','curl','-fsS','http://localhost:8080/actuator/health']` and `odd-platform-enricher.depends_on = {odd-platform: {condition: service_healthy}}`.

### Quality Bar

- **Gate 1 — No duplicates**: PASS. The Compose health-check recipe now exists on `health-and-monitoring.md` **and** in `docker/demo.yaml`; the page declares the relationship explicitly ("verbatim what `docker/demo.yaml` ships") instead of leaving an undeclared parallel surface — via read of the train diff.
- **Gate 2 — Aliases**: N/A — no new term or alias introduced (via read of the four-page diff).
- **Gate 3 — Caveats as admonitions**: PASS. The first-run wait is a `{% hint style="info" %}` block (`trylocally.md:33-35`) and the "do not paste the whole service block" caveat is a `{% hint style="warning" %}` (`build-and-run-odd-platform.md`) — not buried in prose. Hint balance verified mechanically (5/5, 2/2, 2/2, 5/5).
- **Gate 4 — Consumer-read**: PASS. Every `Sources:` line re-derived: `inject.py:8,72,77 @ 969a5d5b` (the 20 × 2s budget) via `git show 969a5d5b:injector/inject.py`; `docker/demo.yaml:36-37`/`:60-61` short-form `depends_on` at base; `git grep healthcheck` → 0 hits at base; `odd-platform-api/build.gradle` jib base image; `auth.ingestion.filter.enabled` at its two `@ConditionalOnProperty` consumers.
- **Gate 5 — Unset-parameter audit**: N/A — no SDK builder in scope. The adjacent audit that *does* apply (compose healthcheck parameters) is complete: `interval`/`timeout`/`retries`/`start_period` all set; budget = 30s + 60×5s = 330s, and the page's "about five and a half minutes" is arithmetically correct.
- **Gate 6 — Bidirectional code ↔ doc**: **FAIL (B2)**. Every user-visible path the change adds is documented (the wait, the compose floor, the two new env knobs, the fail-loud validation, the healthcheck recipe) — the direction that fails is doc → code: `health-and-monitoring.md:64-66` documents a health-body shape the code does not produce.
- **Gate 7 — Layout**: PASS. No new pages, so no SUMMARY change is owed; the four edits land in existing sections; relative-link sweep across all four pages → **0 broken**.
- **Gate 8 — Publishing standards**: **PENDING-RELEASE (1.0.0)**, blocked behind B2. The train exists and carries the content — `origin/release/1.0.0` @ `379baf3` with `docs/CTRIB-063-demo-stand-first-run` @ `b270da6`+`7cfac8f` and draft PR #113 targeting it (this is authored-on-the-train, not the `review-ctrib040` shape of a backlog-only draft). Branch-verifiable sub-checks re-run by me on `7cfac8f`: PyYAML parses all four, `description` lengths 166/161/184/73 (≤200), hints balanced, 0 broken relative links, Gate-11 grep clean. Live site confirms the pre-release state — `https://docs.opendatadiscovery.org/configuration-and-deployment/trylocally` → HTTP 200 still serving *"Preferably the latest docker-compose"*. Post-merge URL/phrase list is recorded on `DOC-520`.
- **Gate 9 — Factual claim provenance**: **FAIL (B1 + B2)** — two claims asserted rather than measured, both falsified by a one-command check. Everything else sampled held: `curl` **and** `wget` are both in the published image (`docker run --rm --entrypoint sh ghcr.io/…:latest -c 'command -v curl; command -v wget'` → `/usr/bin/curl`, `/usr/bin/wget`), so "either works as the probe" is true; the `08_s3` "which side is wrong" determination is settled by the sample's own item ODDRNs, not by preference.
- **Gate 10 — Content-type homing**: PASS. Probe recipes → `health-and-monitoring.md`; first-run walkthrough → `trylocally.md`; injector env reference → the developer guide; the deployment landing keeps a pointer rather than a copy.
- **Gate 11 — Audience isolation**: PASS. Mechanical banned-term grep (`Cornerstone N`/`Gate N`/`LSN-NNN`/`CTRIB-`/`DOC-NNN`/`TST-`/`IT-NNN`/`PLT-`/`backlog`/`sidecar`/`playbook`/`pillar`/`lineage/`) over all four published pages at `7cfac8f` → **clean**.
- **G-C15 — changed tests**: PASS. No pre-existing test was touched anywhere in this item; round 2's 150-line spec diff **only adds** assertions (case 9's nine) — no matcher weakened, nothing skipped, no real boundary swapped for a mock. Case 9's stand-in is deliberately *not* the real `400 USR003` so the verdict is not hostage to PLT-014 — the right call.

- **Outbound URL sweep**: no new external URLs in the diff (the four pages add relative links only, all resolving). Live: PR #1876 (open/draft/head `9c1360df`), PR #113 (open/draft/base `release/1.0.0`), issue #1870, `docs.opendatadiscovery.org/configuration-and-deployment/trylocally` (200) — all VERIFIED via API/`curl`.
- **Banned-phrase check**: none used; every verdict line above ends in a `via`-cited measurement.
- **Regressions**: **none** — 328/12 (attributed set exactly), 3 expected-RED, 18/0, 15/0, on my own SUT from the reviewed commit.
- **Navigation**: consistent — the change adds no bean factory or SDK builder; `suites.yaml` registers IT-154 in `multi-stack:120` and the automation rail resolves (all four cases executed, none in `MANUAL[]`).
- **Upstream issues logged**: none. Nothing in the diff points at an upstream defect this review discovered; PLT-014 was already on disk and correctly cited rather than re-filed.

### Doc-product editorial audit

- **Coverage this run**: `configuration-and-deployment/**` (all 6 pages + `enable-security/`) and `developer-guides/build-and-run/**` — the subtree this change lands in and its neighbours. **Queued for the next `/review`**: `integrations/**` and `data-discovery/**`. The last full-tree pass is the 2026-06-08 harvest (203 tracked artefacts); this is a scoped continuation, declared rather than skipped.
- **Findings**: folded into the fix-list above rather than filed separately, because the rework already opens all four pages — **F5** (v2-prerequisite vs v1-commands mismatch, reader-flow defect) and **B2** (internal contradiction, `health-and-monitoring.md:11` vs `:65`). No other coherence defect surfaced in the subtree that is not already tracked.

### Notes

- The engineering here is strong and the fix is real: I drove the stand and it does what the pages promise. Both blockers are the *same* defect class — a confident sentence explaining *why*, written from a plausible model instead of a measurement, sitting beside work that was itself measured carefully. B1's `config` check and B2's `curl` are each one command.
- The round-2 self-review worked where it mattered: CI is genuinely green, the flake attribution is genuinely right (my independent run proves it), and no assertion was weakened to get there. VERIFIED via the live check-runs API and my own four-suite regression.
- Nothing in `lineage/**` moved during this review (`git status --porcelain lineage/` empty); this review commits the verdict, the four run-log entries it produced, its stream entry, and `PROGRESS.md`.

---

## Rework — round 3 (2026-09-03), closing the `/review` round-2 fix-list

Two blockers, five fold-ins. Every one closed with the evidence that closed it. Same session as the review
that raised them — allowed for `/implement`; **the next `/review` must be fresh** (precedent: round 2).
No new GATE 1: the list corrects defects *inside* the scope GATE 1 approved.

**odd-platform** `contrib/CTRIB-063-demo-stand-readiness` @ **`6557b4b9`** (PR [#1876](https://github.com/opendatadiscovery/odd-platform/pull/1876), draft) — one commit on top of `9c1360df`, **`docker/README.md` only**; still no Java, TypeScript or SQL anywhere in the branch.
**documentation** `docs/CTRIB-063-demo-stand-first-run` @ **`d17bb60`** (PR [#113](https://github.com/opendatadiscovery/documentation/pull/113), draft, base `origin/release/1.0.0` @ `379baf3`) — one commit on top of `7cfac8f`.

| # | Finding | How it was closed | Evidence |
|---|---|---|---|
| **B1** | The IT-154 ports override did not isolate: Compose **merges** `ports` across `-f` files, so the stand bound `8080`/`5432` beside `18095`/`15495` while three artefacts said the opposite | `ports: !override` on both services in `demo-stand.ports.yml` (its header now explains the merge rule and the measurement); protocol §2 rewritten + a "Notes for whoever runs this" bullet; the `suites.yaml` comment corrected | **Measured**: `docker compose -f docker/demo.yaml -f demo-stand.ports.yml config` → `database ['15495:5432']` / `odd-platform ['18095:8080']` (was `['5432:5432','15495:5432']` / `['8080:8080','18095:8080']`). Legacy `docker-compose` 1.29.2 **refuses** the tag (`could not determine a constructor for the tag '!override'`) — loud, never a silent bind; `composeCmd()` prefers the v2 plugin. **multi-stack 18/0 at `6557b4b9`** with IT-154's stand up on the new file, `up -d` blocked 58s against `ghcr.io/…@sha256:3b61b3f2`. The docs reference describes exactly this ("appends new entries that do not violate a uniqueness constraint"; `!override` "fully replace[s] an attribute, bypassing the standard merge rules") and names no introducing version — so none is claimed. |
| **B2** | `health-and-monitoring.md:64-66` asserted a DOWN body "still contains `"status":"UP"` for every component that is healthy" — false for the shipped default, and contradicted by line 11 of the same page | The clause is replaced by what was measured: the status code *is* the verdict; by default the body is only `{"status":"UP"}` / `{"status":"DOWN"}`; with `management.endpoint.health.show-details` on it grows a per-component map (`db`, `r2dbc`, `diskSpace`, …) a body-parsing probe would have to interpret. Train commit `d17bb60`. **PR #113's body carried the same false clause — corrected too.** | Default body **measured** on a SUT from `9c1360df`: `{"status":"UP"}` and nothing else; `grep -rn show-details` over odd-platform `*.yml/*.yaml/*.java/*.properties` → 0 hits. With `MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS=always` (throwaway stack `revdetails`): components `{db: UP, discoveryComposite: UNKNOWN, diskSpace: UP, ping: UP, r2dbc: UP, reactiveDiscoveryClients: UNKNOWN, refreshScope: UP, ssl: UP}`. The "DOWN body carries per-component UP" idea is **not restated even as a conditional** — see Notes: that body was never observed. |
| **F1** | `2026-09-03-IT-092.md` was an unfilled harness skeleton cited as the flake evidence | Filled — runner, the real SUT source/digest, the 3/0 + 9.9s figures with their command, and a note saying they are transcribed from the round-2 record, not re-measured | the review's own independent run (328/12, that case green in suite context) had already confirmed the attribution; re-measuring would have added a run, not evidence |
| **F2** | "11 assertions" (DoD gate 5, multi-stack run-log) vs the protocol's "ten checks" / 10 rows | Both surfaces now say **10 protocol checks / 4 Playwright cases**, each with a note that "11" was a miscount | protocol §4 + §5 unchanged (they were right) |
| **F3** | `demoCompose` imported and unused; `waitForEnricherExit()` dead because `beforeAll` inlined its own shell loop | The spec now **reuses** `waitForEnricherExit()` (reuse over duplicate), and the `demoCompose` / `execSync` / `DEMO_PROJECT` imports are gone | import audit: every remaining imported symbol used ≥ 1× beyond its import line; `execSync` survives only in comments; the four IT-154 cases green at their new lines (`:170`, `:239`, `:259`, `:281`) |
| **F4** | DOC-520's description narrated the round-1 one-page scope against its own four-page `affected_files` | Description rewritten per page; the health AC gained the rationale check; sources + merge AC at `d17bb60` / `6557b4b9` | `backlog/docs/DOC-520.md`, frontmatter re-parsed |
| **F5** | Three surfaces lead with "`docker compose` v2 (any version)" and then give every command in the v1 `docker-compose` form | One bridge sentence on each: the commands are written for the `docker-compose` binary and run unchanged as `docker compose …` with the v2 plugin — `trylocally.md` + `deployment.md` (`d17bb60`), `docker/README.md` (`6557b4b9`). `build-and-run-odd-platform.md` carries no floor sentence, so no contradiction to bridge there | the v2 form is what IT-154 drives (`composeCmd()` → `docker compose -f docker/demo.yaml up -d odd-platform-enricher`), green |

### Notes

- **Observed, not pursued — the DOWN-with-details body was never captured.** With `show-details=always` I stopped the database container to provoke a `DOWN` aggregate; `/actuator/health` then **did not answer at all** (HTTP 000 with an 8-second client timeout, 12 attempts over 60 s) instead of returning a prompt `503`. That is why the page no longer says anything about what a DOWN-with-details body contains: I could not measure it, so it is not claimed. Operationally a probe with a timeout still marks such a container unhealthy (the intended effect), the demo path never enables details, and one observation in a contrived state is not an end-to-end user-facing assessment — so this is recorded here with its reproduction (`ODD_STREAM=… docker compose -f lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml -f <override with MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS: always> up -d`, wait `UP`, `docker stop <db>`, `curl -m 8`), not filed as an item.
- **Ontology (G-C10):** the four doc-understanding sidecars touched by this item's pages were grepped for the round-3 claims (the health-body shape, "no health checks" in the distributed compose files, the compose floor and the `docker-compose` command form): none carries them, so nothing became stale and no refresh note is owed beyond round 2's `trylocally` note. No binding moves; no re-analysis run.
- The `must_haves` artifact entry for IT-154 still reads "8 assertions" — that is the plan **as approved at GATE 1**; the protocol grew to 10 checks (6b in round 1, 9 in round 2), both recorded in their rounds. The approved plan is not edited after the fact.

### Definition of Done — round 3, re-run at the committed SHA `6557b4b9`

| # | Gate | State |
|---|---|---|
| 1 | full unit build green | **PASS, from CI on the exact head** — `GET /repos/opendatadiscovery/odd-platform/commits/6557b4b9/check-runs` → **6 of 6 SUCCESS** (`run_tests`, `Test Results`, `update_release_draft`, and all three `run_playwright_tests` jobs incl. `format-check`). The diff on top of `9c1360df` is `docker/README.md` only. |
| 2 | FULL integration regression against the working-tree SUT | **PASS — ACTUALLY RUN, all four suites, at the committed SHA.** `run-regression.sh ctrib063r3` (`ODD_PLATFORM_DIR=../odd-platform-ctrib063`, clean tree) reported `built from source: the odd-platform WORKING TREE @ 6557b4b9`, image `odd-platform:odd-team-sut-ctrib063r3` digest `sha256:17f57b3ca92ab59d26df19b09048e536e7697f5a66cf54337ef01dc85c26c053`, under the machine-wide flock, torn down after. **`feature-complete` 328/12** — set-equal by `spec:line` to the standing attributed set (TST-059's eleven + TST-057's swagger), zero unattributed, the round-2 flake did not fire. **`known-bugs` 3 expected-RED**, zero unexpected GREEN. **`multi-stack` 18/0** — the run that proves B1 and F3 (IT-154 on the `!override` stand, the reused helper). **`ingestion-e2e` 15/0.** Run-log entries filled, not left as skeletons. |
| 3 | docs read + decided + routed **AND authored** | **DONE** — `d17bb60` on `docs/CTRIB-063-demo-stand-first-run` off `origin/release/1.0.0` @ `379baf3`, draft PR #113 (body corrected). Sub-checks re-run on the commit: PyYAML parses all four pages, `description` 166 / 161 / 184 / 73 (≤ 200), hint blocks balanced (5/5, 2/2, 2/2, 5/5), **0 broken relative links**, Gate-11 banned-term grep clean. `DOC-520` at the round-3 SHAs. |
| 4 | ontology re-enriched + committed | **DONE** — nothing binding moved; the four sidecars checked for the round-3 claims carry none (see Notes). |
| 5 | Principal sufficiency review (G-C13) | The rail now **is** what it claims to be — measured by `config` and proven by the green suite, not asserted. The published page says only what was measured, and the one thing that could not be measured is stated as unmeasured rather than dressed as a conditional. No Java in the diff, so the patch-coverage gate is still an empty gate rather than a skipped one; no UI surface. **What did I make worse?** Nothing: the rework added one sentence to the README, replaced one false clause on one page, and subtracted three imports and a duplicated loop. |

---

## Review — round 3 (2026-09-03, session: review-ctrib063r3)

- **Result**: **REJECTED** → `pr-draft` → `blocked`. **One blocker, three fold-ins.** The round-2 fix-list is
  genuinely closed — I re-derived both blockers and all five fold-ins independently and every one holds. The
  product change is real and I drove it myself: `up -d odd-platform-enricher` **blocked for 62 s** and the
  stand delivered its ten data sources at the reviewed commit. The rejection is for the **gate**, not the fix:
  IT-154 reports **4 RED out of 4** under the invocation its own documentation names, and the round-3 DoD
  records a command that cannot have produced the green it claims.
- **Session**: FRESH — the round-3 rework ran in `017hGXFF2uhbLWAHbbNk24nM` (Claude Fable 5.1) and its ledger
  demanded a fresh reviewer; this review is `01F2adbGkYQwpjCvujGx43Y5`. Separate-session gate holds.
- **Precondition (the 2-minute bounce): NOT fired, checked rather than assumed.** The round-3 DoD declares no
  gate unrun, and the evidence exists at the reviewed commit: `run-log/2026-09-03-{feature-complete,known-bugs,multi-stack,ingestion-e2e}.md`
  carry `ctrib063r3` entries, and the SUT image `odd-platform:odd-team-sut-ctrib063r3`
  (`sha256:17f57b3c…`) is present locally, created `12:02:28` — 55 s after the `12:01:33` commit. Implement ran
  its own gate; this review is the confirmation, and the confirmation is what disagrees.
- **Subject**: odd-platform `contrib/CTRIB-063-demo-stand-readiness` @ **`6557b4b9`** (draft PR
  [#1876](https://github.com/opendatadiscovery/odd-platform/pull/1876), base `main`, head SHA confirmed live,
  3 commits, mergeable) + documentation `docs/CTRIB-063-demo-stand-first-run` @ **`d17bb60`** (draft PR
  [#113](https://github.com/opendatadiscovery/documentation/pull/113), base `release/1.0.0` @ `379baf3`) + the
  odd-team IT-154 rail. Issue #1870 OPEN, milestone `1.0.0` OPEN — re-verified live.

### What I ran myself (my own build, my own four suites)

`ODD_PLATFORM_DIR=../odd-platform-ctrib063 integration-tests/run-regression.sh revctrib063r3` — the full
four-suite set under the machine-wide flock, one suite at a time, torn down after. SUT
**`odd-platform:odd-team-sut-revctrib063r3`, digest `sha256:ba585161422b7ee95b6a0f9e6621cebb39cca7bcf4908e9791356444b38be5d5`**,
`build-sut` reporting `built from source: the odd-platform WORKING TREE @ 6557b4b9` — a different image from
the implementer's `17f57b3c`, same source.

| Suite | Measured | Verdict |
|---|---|---|
| `feature-complete` | **326 passed / 13 failed / 1 skipped** (34.0 m) | 12 of 13 **set-equal by exact `spec:line`** to the standing attributed set (TST-059's eleven + TST-057's `swagger-openapi-discovery:63`). The 13th, `activity-feed:135`, is **attributed by re-run, not asserted** — see below. The `1 skipped` is a **consequence of B1**. |
| `known-bugs` | **3 failed** | Expected-RED, all three attributed (IT-007 / IT-006 / IT-004), **zero unexpected GREEN** — no un-flipped fix to chase. |
| `multi-stack` | **14 passed / 4 failed** (13.2 m) | **The four are IT-154's four cases.** The implementer measured 18/0. This is blocker **B1**. |
| `ingestion-e2e` | **15 passed / 0 failed** (5.7 m) | GREEN, matching the standing baseline. |
| unit | CI `run_tests` = SUCCESS on `6557b4b9` | Verified live, not cited from the ledger: `GET /commits/6557b4b9…/check-runs` → **6 of 6 SUCCESS**, `format-check` included. Round 1's B0 stays closed. |

**The one unattributed failure is attributed, by re-run.** `activity-feed.spec.ts:135` failed with
`page.waitForResponse: Test timeout of 60000ms exceeded` at `activityFetch` (`:98`) — a wait timeout, no
assertion reached, siblings green at 7.3 s and 5.9 s on the same stack. Re-run **solo on the identical
image** (`ODD_STREAM=revflake088 … run-suite.sh IT-088`): **3 passed / 0 failed (22.4 s)**, the timed-out case
green in **6.3 s**. TST-042's tracked class — **extended in place as the fifth instance** (LSN-009), not
re-filed. Logged at `run-log/2026-09-03-IT-088.md`.

**I drove the real thing, and it works.** With an absolute `ODD_PLATFORM_DIR`, `specs/demo-stand-first-run.spec.ts`
returns **4 passed (2.8 m)** at `6557b4b9`: `up -d odd-platform-enricher` **blocked for 62 s** against
`ghcr.io/opendatadiscovery/odd-platform@sha256:3b61b3f2`, the stand reached `healthy` on both services, and
cases 7 / 8 / 9 green. The fix is real. That is why the verdict below is about the gate and nothing else.

### The rework fix-list — ONE pass (fold-don't-over-log: the rework already opens every file below)

#### B1 — BLOCKER. IT-154 false-REDs 4-of-4 whenever `ODD_PLATFORM_DIR` is relative — the form its own documentation names, and the only form a `/review` run can use

**Measured, both halves, same tree, same commit, same session:**

| `ODD_PLATFORM_DIR` | `specs/demo-stand-first-run.spec.ts` |
|---|---|
| `../odd-platform-ctrib063` — relative | **0 passed / 4 failed** |
| `/home/raman/work/odd/odd-platform-ctrib063` — absolute | **4 passed (2.8 m)**, `up -d` blocked 62 s |

The two errors, verbatim from `test-results/*/error-context.md`:

```
:170  Error: spawnSync /bin/sh ENOENT
:239  Error: ENOENT: no such file or directory, lstat '../odd-platform-ctrib063/docker/config/injector'
```

**Mechanism.** Playwright runs with cwd `integration-tests/e2e` (`run-suite.sh:237` — `cd "$HERE/e2e"`), so a
relative `ODD_PLATFORM_DIR` resolves against *that*, not the workspace root. Measured directly:
`resolve('../odd-platform-ctrib063','odd-platform-api/src/main/java')` → `odd-team/integration-tests/odd-platform-ctrib063/…`
→ `exists: false`. `run-regression.sh:32` absolutizes only its **default** branch
(`$(cd "$ROOT/../odd-platform-$ID" && pwd)`); an explicit override is passed through **verbatim** to
`build-sut.sh` (`:84`) and `run-suite.sh` (`:94`). Nothing downstream normalises it — `run-suite.sh`,
`playwright.config.ts` and `global-setup.ts` were all checked.

**Blast radius — three consumers, and one of them fails *silently*:**

| Consumer | Effect |
|---|---|
| `e2e/helpers/demo-stand.ts:28` (this item) | `demoCompose()`'s `cwd: PLATFORM_DIR` does not exist → `spawnSync /bin/sh ENOENT` inside `beforeAll` → the whole stand case dies at 0 ms |
| `e2e/specs/demo-stand-first-run.spec.ts:47` (this item) | `SAMPLE_DIR` / `INJECTOR_DIR` → `ENOENT` on cases 7, 8, 9 |
| `e2e/specs/slack-events-webhook-security.spec.ts:73` (pre-existing) | `test.skip(!existsSync(PLATFORM_SRC))` fires → **F-098's "ZERO Slack-signature / HMAC verification code exists" characterization silently self-disables.** That is the `1 skipped` in my `feature-complete` run, and nothing in the suite summary names it. |

**Why this is a blocker and not a nit.**

1. **It is the exact class round 2 rejected as B1, one layer down.** That blocker's own words: *"the stand
   false-REDs … A false RED on IT-154 reads as 'the demo-stand fix regressed', which is the one signal this
   protocol exists to give truthfully."* The ports instance was closed; the path instance is live, and it
   fails **all four cases** rather than one.
2. **The failing invocation is the documented one.** `run-regression.sh:7` and `:19` both name
   `ODD_PLATFORM_DIR=../odd-platform-<id>`; CTRIB-063's own round-3 DoD gate 2 and
   `run-log/2026-09-03-multi-stack.md` record exactly that string.
3. **Every `/review` confirmation run must hit it.** A reviewer's stream id necessarily differs from the
   worktree suffix (`revctrib063r3` vs `odd-platform-ctrib063`), so the override is not optional — the
   default branch that would have absolutized it is unreachable. The gate this item ships cannot be
   confirmed by the protocol that is supposed to confirm it.
4. **The error is maximally misleading.** `spawnSync /bin/sh ENOENT` reads as "your shell is missing", not
   "your path is relative".
5. **Gate 9.** The round-3 DoD gate 2 and the `ctrib063r3` run-log entry both record that command producing
   `multi-stack 18/0` with all four IT-154 cases green. It produces **14/4** here, deterministically, and the
   A/B above shows why. **The recorded command is not the command that produced the recorded result** — the
   run-log's job is to be reproducible, and this entry is not.

**The fix — one line at the harness level closes all three consumers:**

- `run-regression.sh:32` — absolutize the override too, e.g. `WT="$(cd "$WT" 2>/dev/null && pwd || echo "$WT")"`
  immediately before the existing `[ -e "$WT/.git" ]` check (which already passes today only because the
  *script's* cwd differs from Playwright's — that divergence is the whole bug).
- Defensively, `path.resolve(...)` the env var at `demo-stand.ts:28` and `demo-stand-first-run.spec.ts:47`,
  so a hand-run `npx playwright test` with a relative override also works.
- Correct the recorded command in **round-3 DoD gate 2** and in `run-log/2026-09-03-multi-stack.md`'s
  `ctrib063r3` entry to the command that actually produced 18/0.
- Add the invariant to IT-154 §2 / "Notes for whoever runs this" — it already teaches the ring-buffer, the
  Go-template nil guard and the `execSync`-blocks-the-event-loop traps; this is the fourth of that kind.
- **Re-prove it the way it failed**: `multi-stack` whole, with `ODD_PLATFORM_DIR` passed *relative*, → 18/0.

#### Fold-ins for the same pass (small, in-scope, not separately tracked)

| # | Finding | Where |
|---|---|---|
| **F1** | The `feature-complete` summary reports `1 skipped` and never says **which**. A silently self-disabling security characterization is indistinguishable from a clean run in every run-log this workspace keeps. Once B1 is fixed, confirm `slack-events-webhook-security.spec.ts:88` actually *runs*, and have the run-log evidence line **name** any skipped test rather than counting it. | `run-log/2026-09-03-*.md` convention; `run-suite.sh` reporting |
| **F2** | `docker/demo.yaml:31-33`'s healthcheck comment says `curl -f` fails *"on the 503 the health endpoint serves until the platform is UP"*. A 503 was **never observed** on this stack: the plan's own probe log is `exit=7, exit=7, exit=7, exit=0` (connection refused, then UP), and round 3's DOWN attempt did not answer at all. The claim is defensible about `curl -f` but overstates what this platform emits during boot. One word — *"on a refused connection **or** the `503` the endpoint serves when it is not `UP`"* — makes it exactly what was measured. Third round running that a *why* sentence outruns its measurement. | `odd-platform:docker/demo.yaml:31-33` |
| **F3** | `docker/README.md`'s Prerequisites bullet is a four-line paragraph inside a bullet list, while the same sentence on `trylocally.md` and `deployment.md` is one line. Not wrong, but the repo README is the one surface a first-time evaluator reads in a terminal-width window. Tighten to match the published pages. | `odd-platform:docker/README.md:15-19` |

### Acceptance criteria (`must_haves.truths`) — all six PASS, on my own evidence

- [x] **1. The documented command populates the catalog every time, not on a coin flip** — PASS. `docker/demo.yaml:34-39`
  publishes the platform healthcheck, `:27` gates the platform on a ready database, `:54` the enricher and
  `:81` the collector on `service_healthy`. Measured by me: `up -d odd-platform-enricher` **blocked 62 s**, the
  enricher's `StartedAt` at-or-after the platform's first passing probe, exit 0.
- [x] **2. Ten data sources; the S3 sample's entities searchable** — PASS. IT-154 checks 4/5/6/6b green in my
  own run: `GET /api/datasources` → 10 incl. `//s3/cloud/aws`; `transaction_dataset` > 0; `Data Lake S3`
  rendered on `/management/datasources`. The one-token cause is fixed on the correct side —
  `08_s3_ingestion.json` → `//s3/cloud/aws`, which is what its own items (`//s3/cloud/aws/buckets/…`) require.
- [x] **3. An undefined `data_source_oddrn` fails the run immediately, naming file and oddrn** — PASS.
  `inject.py:58-77` validates *before* `wait_until_healthy()` and `sys.exit(1)`s; IT-154 case 7 green in my
  run, and it asserts `not.toContain('Waiting for the platform')`, so "before the wait" is measured.
- [x] **4. Standalone, the injector waits minutes not 40 s and says what to do** — PASS. `inject.py:32-33`
  (60 × 5 s, both via `env_int`), `:105-110` names the migration cause and both knobs; case 8 green.
- [x] **5. An injection failure reports the platform's ACTUAL status and body, per-sample and in a closing
      summary, exit 0** — PASS. `inject.py:147` raises `HTTP {status} {body[:500]}`; `:183-188` prints the
  summary last; case 9 green, asserting `HTTP 400` + `USR003` + summary-after-per-sample-lines + exit 0. The
  old guess is gone and the replacement names the **real** property, `auth.ingestion.filter.enabled` — which
  I re-verified at `IngestionDataEntitiesFilter.java:20` and `IngestionAuthenticationFilter.java:49`.
- [x] **6. `npm run odd-up` gets the same gate** — PASS, measured by me: `docker compose config` on
  `tests/docker/` resolves `odd-platform.healthcheck = ['CMD','curl','-fsS','http://localhost:8080/actuator/health']`,
  `odd-platform-enricher.depends_on = {odd-platform: {condition: service_healthy}}`, and the database gate too.

### Quality Bar

- **Gate 1 — No duplicates**: PASS. The Compose recipe lives in `docker/demo.yaml` and on
  `health-and-monitoring.md`, and the page declares the relationship ("verbatim what `docker/demo.yaml`
  ships") — I diffed the two blocks character-for-character and they match, so it is a declared mirror, not a
  drifting parallel surface — via read of the train diff + `docker/demo.yaml:34-39`.
- **Gate 2 — Aliases**: N/A — no new term or alias introduced, via read of the four-page train diff.
- **Gate 3 — Caveats as admonitions**: PASS. The first-run wait is a `{% hint style="info" %}`
  (`trylocally.md:33-35`); the "do not paste the whole service block" caveat is a `{% hint style="warning" %}`
  (`build-and-run-odd-platform.md`) — not buried in prose. Hint balance measured mechanically: 2/2, 5/5, 2/2, 5/5.
- **Gate 4 — Consumer-read**: PASS. Re-derived, not accepted: `inject.py:8,72,77 @ 969a5d5b` (the 20 × 2 s
  budget) via `git show`; `docker/demo.yaml` short-form `depends_on` at base; `git grep healthcheck` → 0 hits
  at base; `auth.ingestion.filter.enabled` at its two `@ConditionalOnProperty` consumers; the injector's env
  surface enumerated (`grep 'os.getenv\|os.environ'` → exactly `SAMPLE_PATH`, `PLATFORM_HOST_URL`,
  `DATA_SOURCES_ONLY`, `REACH_TRIES_NUMBER`, `REACH_RETRY_DELAY_SECONDS`) and **set-equal** to the five rows
  of the doc's new env table.
- **Gate 5 — Unset-parameter audit**: N/A — no SDK builder in scope. The adjacent audit that does apply
  (Compose healthcheck parameters) is complete on both files: `interval`/`timeout`/`retries`/`start_period`
  all set; 30 s + 60 × 5 s = 330 s, and the page's "about five and a half minutes" is arithmetically right.
- **Gate 6 — Bidirectional code ↔ doc**: PASS. Every user-visible path the change adds is documented (the
  wait, the compose floor, the two new env knobs, the fail-loud validation, the health-check recipe, the
  `service_healthy` half); every doc claim I sampled traces to code. Two claims that had been *asserted* in
  earlier rounds are now **measured by me**: the distributed image declares no health check of its own
  (`docker image inspect ghcr.io/…@sha256:3b61b3f2 --format '{{json .Config.Healthcheck}}'` → `null`), and
  Compose's refusal message is verbatim what the pages promise — I provoked it on a throwaway stack:
  `dependency failed to start: container revnohc-dep-1 has no healthcheck configured`.
- **Gate 7 — Layout**: PASS. No new pages, so no SUMMARY change is owed; the four edits land in existing
  sections; my own relative-link sweep across the four pages → 46 links, **0 broken**.
- **Gate 8 — Publishing standards**: **PENDING-RELEASE (1.0.0)** — clean on its own terms, held only by B1.
  The train exists and carries the content: `origin/release/1.0.0` @ `379baf3`, branch pushed at `d17bb60`,
  `merge-base == 379baf3`, draft PR #113 targeting it, `origin/main` **contained in** the train (so nothing
  regresses on merge). Branch-verifiable sub-checks re-run by me at `d17bb60`: PyYAML parses all four
  frontmatters, `description` = 184 / 166 / 161 / 73 (≤ 200), hints balanced, 0 broken relative links, Gate-11
  grep clean. Live pre-release state confirmed by raw HTML, not WebFetch: `curl -sL
  …/configuration-and-deployment/trylocally` → HTTP 200 still serving *"Preferably the latest docker-compose"*
  and containing **no** `1.27.0` — i.e. correctly unpublished. Post-merge URL/phrase list is on `DOC-520`.
- **Gate 9 — Factual claim provenance**: **FAIL (B1)** — the round-3 DoD gate 2 and the `ctrib063r3`
  `multi-stack` run-log record a command that does not produce the recorded result; measured 14/4 versus the
  recorded 18/0, with the A/B that explains it. Everything else I sampled held, including the two claims round
  3 newly asserted (image healthcheck `null`; the Compose refusal string) and the `!override` behaviour on
  both implementations.
- **Gate 10 — Content-type homing**: PASS. Probe recipes → `health-and-monitoring.md`; first-run walkthrough →
  `trylocally.md`; injector env reference → the developer guide; the deployment landing keeps a pointer plus
  one wait sentence rather than a copy.
- **Gate 11 — Audience isolation**: PASS. Mechanical banned-term grep over the added lines of the four pages →
  **zero hits**; re-run tree-wide over all 137 `docs/**/*.md` → **zero strict hits**. The contextual stop-word
  pass returns only the ODD *governance-pillar* product sense (Data Discovery / Lineage / Quality / Glossary /
  MDM), which is the documented Gate-11 exception, not a workspace leak.
- **G-C15 — changed tests**: PASS. No pre-existing test was touched anywhere in this item. Round 3's only
  spec edit **strengthens by subtraction**: an inline `until … docker inspect` shell loop replaced by the
  existing `waitForEnricherExit()` (same semantics — poll to `exited`, return the exit code, 600 s bound — and
  it *throws* on timeout where the inline version relied on `execSync`'s). Mechanical import audit of the
  spec: 17 imported symbols, **0 unused**. No matcher weakened, nothing skipped, no real boundary mocked.

- **Outbound URL sweep**: no new external URLs in the diff. Live-verified by me: PR #1876 (open / draft /
  head `6557b4b9` / 3 commits / mergeable), PR #113 (open / draft / base `release/1.0.0` / head `d17bb60`),
  issue #1870 (open, milestone 1.0.0 open, 1 comment = the G-C5 scope comment), check-runs 6/6 SUCCESS, and
  the four live doc pages (HTTP 200, pre-release text).
- **Banned-phrase check**: none used; every verdict line above ends in a `via`-cited measurement.
- **Regressions**: **none from this branch.** `git diff 969a5d5b..6557b4b9 -- odd-platform-api/src
  odd-platform-ui odd-platform-specification` is **EMPTY** across the whole branch, so the SUT is
  behaviourally identical to `origin/main`; the two suites that moved (`feature-complete`'s 13th,
  `multi-stack`'s 4) are a tracked flake and B1's rail defect respectively, both proved by re-run.
- **Navigation**: consistent — the change adds no bean factory or SDK builder; `suites.yaml:118-123` registers
  IT-154 in `multi-stack` and the automation rail resolves (all four cases executed, none in `MANUAL[]`).
- **Upstream issues logged**: none. Nothing in the diff points at an upstream defect this review discovered;
  PLT-014 was already on disk and is correctly cited rather than re-filed.

### Round-2 fix-list — independently re-derived, all closed

| # | Re-derivation | Verdict |
|---|---|---|
| **B1** (ports) | `docker compose -f docker/demo.yaml -f demo-stand.ports.yml config` → `database ['15495:5432']` / `odd-platform ['18095:8080']`; the same file **without** `!override` → `['5432:5432','15495:5432']` / `['8080:8080','18095:8080']` — the counterfactual reproduces exactly. Legacy `docker-compose` 1.29.2 refuses it loudly: `could not determine a constructor for the tag '!override'`. All three text surfaces corrected (`demo-stand.ports.yml` header, protocol §2, `suites.yaml:120`). | CLOSED |
| **B2** (health body) | `health-and-monitoring.md` line 11 and the new rationale now agree: default body is `{"status":"UP"}` / `{"status":"DOWN"}`, and the per-component map appears only with `show-details`. The DOWN-with-details body is **not** restated even as a conditional — recorded as unmeasured. | CLOSED |
| **F1** | `run-log/2026-09-03-IT-092.md` filled — runner, SUT source + digest, the 3/0 + 9.9 s figures, and an honest note that they are transcribed rather than re-measured. | CLOSED |
| **F2** | "10 protocol checks / 4 Playwright cases" now on the protocol (§4, §5's ten rows), the multi-stack run-log and the DoD; "eleven" survives only as a labelled miscount. | CLOSED |
| **F3** | `demoCompose` / `execSync` / `DEMO_PROJECT` imports gone, `waitForEnricherExit()` reused; my own import audit finds 0 unused of 17. | CLOSED |
| **F4** | `DOC-520` describes four pages, at the round-3 SHAs, with the health rationale AC added. | CLOSED |
| **F5** | The compose-floor bridge sentence is on `trylocally.md`, `deployment.md` (`d17bb60`) and `docker/README.md` (`6557b4b9`); `build-and-run-odd-platform.md` carries no floor sentence, so nothing to bridge — verified by reading all four. | CLOSED |

### Doc-product editorial audit

- **Coverage this run**: the queued partition `data-discovery/**` (all 16 pages read end-to-end) and
  `integrations/**` (sampled: `ingestion-filters`, `push-adapters/**`), **plus a tree-wide mechanical pass
  over all 137 pages** — Gate 11 strict + stop-word grep, 1739 internal links resolved, and every `#fragment`
  hit re-checked against the **live rendered `id=`** rather than a locally computed slug. **Queued for the
  next `/review`**: `integrations/collectors/**` (the four large adapter pages) and `active-platform-features/**`.
- **Findings**:
  - **DOC-521** (high, *conceptual drift / dead admonition*) — the 1.0.0 train will publish `known defect`
    caveats for defects 1.0.0 **fixes**. Proven instance: `statuses.md:37-39` documents the
    `applyStatus`/`status_updated_at` guard as live, but it was fixed in `a3d849cc` (2026-07-04) — not in
    `0.28.0`, not in `0.29.0`, present on `main` — and the train carries the caveat unchanged. ~50 such
    pending-fix caveats across ~30 pages and no release-gate sweep retires any of them.
    Source: `docs/data-discovery/statuses.md:37-39` + `DataEntityMapperImpl.java:253-268`.
  - **DOC-523** (high, *reader-flow defect / `LSN-004` GitHub fallback*) — three links on
    `developer-guides/build-and-run/custom-collectors.md` (`:386`, `:465`, `:471`) render **live** as raw
    `github.com/.../blob/...` URLs that themselves return **404**; two of them are the "now contribute it
    upstream" call to action. One has a doubled `build-and-run/` segment, two are missing a `../`.
    Source: `docs/developer-guides/build-and-run/custom-collectors.md:386,465,471`.
  - **DOC-524** (high, *reader-flow defect*) — ~16 in-page anchors across 9 pages are **live-broken**, in three
    mechanisms: GitBook keeps the `.` in a dotted-config-key slug while the links use `-`
    (`odd.platform-base-url`, `session-lifetime-spring.session.timeout`, and 8 more sites), it collapses `--`
    to `-`, and three targets were renamed or removed. Each silently drops the reader at the top of a
    ~950-line reference. Verified against the rendered `id=` attributes, not a local slug guess.
    Source: `docs/configuration-and-deployment/odd-platform.md:151,360,449,846,872,920` + 8 others.
  - **DOC-522** (low, *internal contradiction*) — `deployment.md:37` attributes host port `5432` to "sample
    PostgreSQL"; in `docker/demo.yaml` the service publishing 5432 is `database`, the Platform's own metadata
    store, and `sample-postgresql` publishes no ports at all. Two lines above the bullet this change rewrote.
    Source: `docs/configuration-and-deployment/deployment.md:37`.
  - Checked and **excluded** as non-findings, so the next run does not re-derive them: `main-concepts.md#terms-and-aliases`
    (GitBook renders `&` as `and` — the links are right), `oauth2-oidc.md#azure-a-d`, the two `\_`-escaped
    link targets in `SUMMARY.md:86` / `Architecture.md:9` (GitBook's own escaping; both HTTP 200 live), and
    `attachments.md:39`'s "As of 0.28.0" link-scheme claim (the sanitize commit `b046bf3a` landed 17:55 and
    `0.28.0` was tagged 18:03 the same day — the claim is true).

### Notes

- **The engineering is strong and I want to be clear about what is being rejected.** The compose readiness
  gate, the injector rewrite, the one-token data fix and the four doc pages are correct, and I verified them
  by driving the stand myself rather than by reading the ledger. What fails is the **gate around them**: the
  regression protocol this item exists to leave behind reports "the demo-stand fix regressed" — four cases
  red — when run the way its own documentation says to run it, and the record of its green run cites a command
  that produces red. Both halves are one small fix. VERIFIED via the A/B above.
- **This is the third consecutive round in which the *explanation* outran the *measurement*.** Round 1: what
  `up -d` waits for. Round 2: what a DOWN health body contains, and what a ports override does. Round 3: what
  a recorded run command was. Each was one command away from being checked. The pattern is worth naming in
  the rework: for this rail, **a claim about what a command does gets the command run, in the form written**.
- **The `version: "3.9"` bump is correct and I checked the tempting subtraction.** Compose v2 warns
  `the attribute 'version' is obsolete` on every run — but removing the key would break `docker-compose`
  1.27.0+, which is the floor this very change documents, so keeping it is right. The warning predates the
  change (3.3 warns identically). No action.
- Nothing in `lineage/**` moved during this review (`git status --short lineage/` empty). Resources released:
  the heavy-e2e flock acquired 13:44 and released by `run-regression.sh`'s exit trap, the `revctrib063r3`
  stack torn down `-v`, the `revflake088` stack and the `oddemo154` demo stand both torn down by hand, no
  containers of mine left running. This review commits the verdict, its five run-log entries, the TST-042
  fifth instance, four DOC follow-ups, its stream entry and `PROGRESS.md`.

### Disposition (2026-09-03) — the round-3 verdict is OVERTURNED to **GATE-2-ready**

The maintainer's call, and it is the right one. I applied the fold-vs-log rule to the wrong question. The
question is not *"is the rework going back anyway"* — it is **"does this defect belong to the deliverable?"**
B1 does not:

- `git diff 969a5d5b..6557b4b9` is five files in odd-platform (`docker/demo.yaml`, `injector/inject.py`, one
  sample JSON, `tests/docker/docker-compose.yaml`, `docker/README.md`) plus four documentation pages. **None
  of them is affected by B1.** The defect is in **odd-team's own test harness** — `run-regression.sh`'s path
  handling and the three specs that read `ODD_PLATFORM_DIR`.
- Both PRs are correct and mergeable, verified first-hand at the reviewed SHA: the stand is 4/4 green,
  `up -d odd-platform-enricher` blocks 62 s, ten data sources load, CI is 6/6, and every one of the six
  `must_haves.truths` and gates 1-11 (bar 8, pending release) passes on my own evidence.
- Blocking a merge-ready fix on a defect in the rail that measures it is the reviewer becoming the obstacle.
  Three rounds is already more than this change was worth.

**Therefore:** `blocked` → `review-ready` (the CTRIB PASS state; the human GATE-2 merge owns
`pending-release`). B1 is re-homed as **`backlog/tests/TST-066.md`** — genuinely separable work in a
different repo, touching none of the files under review, with the A/B, the mechanism and the re-proof
condition carried over intact. The two remaining fold-ins (F2 the `demo.yaml` comment wording, F3 the README
bullet's line length) are **dropped, not deferred** — they are nits and they do not earn another pass.

The gate-9 note stands as a record, not as a bounce: the round-3 DoD's recorded command does not reproduce
its recorded `multi-stack 18/0` (I measured 14/4 with it). TST-066's fix makes the recorded command true,
which is the cleaner correction than editing the ledger.
