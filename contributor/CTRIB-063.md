---
id: CTRIB-063
title: "#1870 — the demo stand does not deliver what its README promises: the enricher loses the start-up race with the platform, and one sample's oddrn typo silently drops the 10th data source"
issue: "https://github.com/opendatadiscovery/odd-platform/issues/1870"
parent_epic: null
class: "bug — two independent defects in the local demo stand (docker/demo.yaml orchestration + injector/inject.py robustness + one sample's data). No production code path is touched."
status: planned
target_repo: odd-platform
milestone: "1.0.0"        # G-C11 PASS — live `GET /repos/opendatadiscovery/odd-platform/issues/1870` 2026-09-02: milestone 1.0.0, state OPEN, semver, due 2026-07-31 (20 open / 10 closed)
base_sha: "969a5d5b"      # odd-platform origin/main at intake (= #1873 CTRIB-060 ST-6 merged), fetched with the App token; local `main` identical
reproduced: "YES — both defects, on stock origin/main @ 969a5d5b. See `## Reproduction`. Defect 1 witnessed live twice on the maintainer's own stack (2026-09-01 13:13 and 2026-09-02 15:41, both exit 1); Defect 2 reproduced deterministically in this stream's pristine worktree (9 data sources, `Skipping //s3/cloud`, enricher exit 0)."
adr_required: false       # no migration, no auth/security-posture change, no public-contract change; the change introduces no new architectural pattern (it adopts docker compose's own documented readiness mechanism)
plan_approved_by: ""
plan_approved_at: ""
pr_url: ""
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
   - **an injection failure is no longer swallowed, and no longer mis-diagnosed**: `inject.py:106-111` today catches everything with a bare `except:`, prints a guess — *"Possibly the 'ingestion.filter.enabled' property is set to 'true'"* — and **continues to exit 0**. This is not hypothetical: on the second run of the stock demo it fires, and the guess is **wrong** (see Root cause 3 — the real answer is `400 USR003`, an upstream alert-uniqueness defect now recorded on `PLT-014`). So `inject_data` raises with the **actual HTTP status and response body**, the failures are collected and printed as a final summary naming each file, and the process exits non-zero. (`except Exception`, not bare `except:`, so Ctrl-C still works.) **The re-run consequence is a GATE-1 question, not a decision taken here** — see `## GATE-1 decisions`.
   - **a `VALIDATE_ONLY` switch** (~3 lines, same `os.getenv` idiom): run the validation, report, exit — no platform contact. This is what lets CI exercise the guard without a test framework, and it is the same code path the real run takes, so the guard cannot drift from the behaviour it guards.
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
    - "If any sample fails to inject, the run names it, reports the platform's ACTUAL status and response
       body, and exits non-zero — never a zero exit code with a guess about a property that is not even set.
       (Measured: on a second run today this fires, and today's guess is wrong.)"
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
    - path: "odd-platform:.github/workflows/run-pr-tests.yaml"
      provides: "the in-repo automated guard — the sample sets are validated on every PR (GATE-1 option; see the test plan)"
      anchor: "validate_demo_samples"
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
      to: "the process exit code"
      via: "failures collected into a list, summarised at the end, `sys.exit(1)` if non-empty — the bare
            `except: … continue` at :106-111 must not survive, or the class stays half-closed"
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

**Unit bucket (odd-platform CI) — a validation job, not a new test framework.** There is no Python test harness in this repo (CI is `./gradlew odd-platform-api:build` plus a Playwright job; `git grep pytest` → 0), so a conventional unit test would mean importing a whole toolchain for one demo script. But the new check is a pure local read of two JSON directories — by the tests-pillar home rule (`pillars/tests/pillar.md`: *does it need external orchestration plus a written protocol?*) that is **unit-shaped**, and "there is no pytest here" is a tooling objection, not a routing one. So the guard ships as a ~20-second parallel job that runs the real code path against **both** bundled sample sets and never contacts a platform:

```yaml
validate_demo_samples:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - run: python -m pip install --quiet requests
    - run: SAMPLE_PATH=docker/config/injector VALIDATE_ONLY=1 python injector/inject.py
    - run: SAMPLE_PATH=tests/docker/injector  VALIDATE_ONLY=1 python injector/inject.py
```

Because it is the same code path the real run takes, the guard cannot drift from the behaviour it guards. **This is a GATE-1 question** (`## GATE-1 decisions`): it is the only part of the change that adds a CI surface to a public repo.

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

### Scope comment for the issue thread (G-C5)

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
> Three things beyond what the issue asks for, all deliberate:
>
> 1. The injector stops reporting success while delivering less than it was given. A sample naming an
>    undefined data source fails the run immediately, naming file and oddrn; an injection that fails is
>    reported with the platform's ACTUAL status and response body and makes the process exit non-zero,
>    instead of being swallowed by a bare `except:` that prints a guess and carries on. That guess is not
>    hypothetical and it is not correct: running the stock enricher a second time today, one sample fails and
>    the script blames `ingestion.filter.enabled`, which is `false` and whose filter bean does not exist. The
>    real answer is `400 USR003 Database constraint violation` from an alert-uniqueness defect on the platform
>    side, which is being reported separately - the demo's part is that it hid it behind a zero exit code.
> 2. `tests/docker/docker-compose.yaml` gets the same healthcheck and the same `service_healthy` gate. It
>    mounts the very same `injector/inject.py` and has the identical start-order-only `depends_on`, so it has
>    the identical race; it is what `npm run odd-up` starts for the Playwright suite. Fixing only
>    `docker/demo.yaml` would leave the same bug one directory away. (Nothing changes in CI - that workflow's
>    stack-and-run steps are commented out today, and this PR does not turn them back on.)
> 3. A ~20-second CI job validates both bundled sample sets on every PR, by running the injector's own new
>    check with no platform involved. It adds no test framework - the repo has no Python harness and this does
>    not introduce one.
>
> Not in this PR: the collector's empty token and its 500-instead-of-401 restart loop (that is #1869); the
> platform-side alert-uniqueness defect described above; and turning the Playwright CI steps back on.
>
> Verified on a stock stand at the current main before planning any of it. Defect 1 is a race whose outcome is
> currently decided by how long `pip install requests` takes: the enricher's whole lifetime is that install
> plus a fixed 40s poll, while the platform needs 50-65s from the same start. Two runs lost by ~15s (the
> platform bound its port 15.1s after the enricher had already exited 1); one run won by 8.8s because a cold
> pip cache took 22s. Defect 2 needs no luck at all - `GET /api/datasources` returns 9, `Data Lake S3` is
> absent, and a search for `transaction_dataset` returns nothing while `kds_clickstream` returns 2 rows.

## GATE-1 decisions (the two things that are the maintainer's call, not this run's)

**D1 — what a *second* `docker compose up` should do, now that injection failures are fatal.**
Measured today on the stock stand: run 1 injects everything and exits 0; run 2 injects 8 of 9, fails
`10_ge_ingestion.json` on an upstream alert-uniqueness defect (`PLT-014`), and **exits 0 with a wrong
diagnosis**. Making failures fatal is right, but it changes what a repeat `up` looks like.

| Option | What a second `up` does | Cost |
|---|---|---|
| **A (recommended)** — fatal + the real error | exits non-zero, naming the file and `400 USR003 …` | Truthful, and it surfaces a genuine platform bug instead of hiding it. But a repeat `up` on an existing stack now shows a red container until `PLT-014` is fixed. |
| **B** — fatal, plus skip injection for a data source that already exists | exits 0, "already seeded, nothing to do" | Makes the enricher idempotent, which is what a repeat `up` wants, and removes the upstream bug from the demo path. Changes seeding semantics: re-running would no longer re-apply an edited sample (`down -v` becomes the reset). |
| **C** — loud but not fatal | exits 0, prints a failure summary | Smallest change; keeps a zero exit code on a failed demo, i.e. leaves half the class open. |

**D2 — the CI validation job.** It is the only part of the change that adds a workflow surface to a public
repo. With it, a future sample/datasource drift is caught on the PR that introduces it; without it, the guards
are the demo run's own loud failure plus IT-154, which lives in odd-team and is invisible upstream.
Recommended: include.

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

## Test ledger

_pending Phase D._

## Follow-ups logged

_pending — filed at Phase D per `playbooks/follow-up-on-disk.md`._
