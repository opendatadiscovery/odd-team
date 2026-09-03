---
id: IT-154
title: "The demo stand delivers its documented first run: the enricher waits for the platform, and all ten data sources load"
gates:
  validates: []
  enforces: []
  regresses: [PLT-255]           # odd-platform#1870 — the enricher's start-up race + the 08_s3 oddrn typo
test_class: integration
stack: odd-demo-stand            # docker/demo.yaml FROM the odd-platform tree — deliberately NOT a probe-stacks profile (see §2)
automation: "e2e:demo-stand-first-run.spec.ts"
plan_ref: "contributor/CTRIB-063.md (#1870); issues/odd-platform/PLT-255.md"
status: ready
---

# IT-154 — the demo stand delivers its documented first run

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` probe is a convenience rail that runs the same steps and writes the
> same result; it never replaces the protocol.

## 1. What this checks

**`docker compose -f docker/demo.yaml up -d odd-platform-enricher` — the one command
`docker/README.md` Step 1 and the published *Try locally* page give a first-time evaluator —
leaves a catalog holding the ten data sources those pages promise, every time.**

Two independent defects broke that (odd-platform#1870 / `PLT-255`), and this protocol pins both
plus the class behind them:

1. **The enricher lost a start-up race.** `depends_on:` in its short form orders container *start*,
   not readiness, so the one-shot injector began polling while the platform was still applying
   migrations, with a fixed ~40 s budget against a 50-65 s boot. Whether the demo worked was
   decided by how long `pip install requests` took — measured: two losses (the platform bound its
   port 15.1 s *after* the enricher had already exited 1) and one win by 8.8 s, same machine, same
   day.
2. **One sample was dead data.** `08_s3_ingestion.json` declared `//s3/cloud` while
   `datasources.json` defines `//s3/cloud/aws`, so the injector skipped it — and *reported success*.
   The catalog held 9 data sources against a documented 10, with no error anywhere.

**Why a red result matters.** This is the first five minutes of every evaluation of ODD. A red
here means an evaluator following the documented steps gets an empty or short catalog and no path
from the symptom to either cause — the single worst place in the product to be unreliable.

## 2. Preparation — build the test stand

**Tier decision.** This is an **ingestion-grade** stand in the strict sense: nothing is seeded into
the platform database. Metadata reaches the catalog only through the real `POST /ingestion/entities`
path, driven by the real bundled enricher. Nothing is mocked.

**The stand is `docker/demo.yaml` itself**, from the odd-platform tree under test — deliberately
**not** a `lineage/_extractor/probe-stacks/` profile, because the compose file *is* the artifact
under test; copying it into a profile would test the copy.

- **Platform image**: `ghcr.io/opendatadiscovery/odd-platform:latest` — what `docker/demo.yaml`
  pins and therefore what a user actually runs. **Pull it before every run and record the resolved
  digest**; `docker compose up` never re-pulls a tag already in the local cache, and an unpinned
  gate silently inherits whatever months-old image happens to be there (`LSN-032` / `LSN-033`).
  The 2026-09-02 authoring run inherited a `0.28.0` image from 2026-06-17 exactly that way before
  the pull was made explicit.
- **Ports**: the demo file hard-codes host `8080`/`5432`. The stand composes a ports override
  (`integration-tests/e2e/helpers/demo-stand.ports.yml`) onto it that **replaces** them with
  `18095`/`15495` — clear of every fixed e2e port (which stop at 18090/15441) and below `run-suite.sh`'s
  per-stream SUT search (18100/15500) — using the Compose-Spec **`ports: !override`** tag. The tag is
  load-bearing: Compose *merges* `ports` across `-f` files (it "appends new entries that do not violate a
  uniqueness constraint"), so a plain override ADDS the new pair next to `8080`/`5432` and the stand binds
  all four — measured 2026-09-03, and the shape in which the stand false-REDs with a bind failure whenever
  the maintainer's own demo stand or a local Postgres holds those ports. With `!override`, `docker compose
  … config` resolves to `database ['15495:5432']` / `odd-platform ['18095:8080']` and nothing else is
  published. This needs the v2 plugin (`composeCmd()` prefers it); legacy `docker-compose` 1.29.2 refuses
  the file at parse time (`could not determine a constructor for the tag '!override'`) — loudly, never a
  silent bind. Nothing else is overridden: the enricher and the collector still reach the platform over the
  compose network at `odd-platform:8080`, so the readiness gate, the healthcheck and the injection are
  exercised exactly as a user gets them.
- **Auth**: the demo's shipped default, `auth.type=DISABLED`.
- **Seed data**: none. `docker/config/injector/` is the sample set, injected by the run itself.

```bash
export ODD_PLATFORM_DIR=<the odd-platform worktree under test>
docker pull ghcr.io/opendatadiscovery/odd-platform:latest
docker image inspect ghcr.io/opendatadiscovery/odd-platform:latest --format '{{index .RepoDigests 0}}'   # record this
docker compose -p oddemo154 \
  -f "$ODD_PLATFORM_DIR/docker/demo.yaml" \
  -f integration-tests/e2e/helpers/demo-stand.ports.yml \
  up -d odd-platform-enricher
```

## 3. Readiness check — is the stand ready?

The command in §2 **is** the readiness check: on a correct stand it does not return until the
platform's healthcheck passes. Confirm before running the assertions:

- `docker inspect -f '{{.State.Health.Status}}' oddemo154-odd-platform-1` → `healthy`
- `docker inspect -f '{{.State.Health.Status}}' oddemo154-database-1` → `healthy`
- `docker inspect -f '{{.State.Status}}' oddemo154-odd-platform-enricher-1` → `exited`
- `curl -fsS http://localhost:18095/actuator/health` → `{"status":"UP"}`

## 4. Run protocol — what to run

1. Bring the stand up with the §2 command; note how long it blocks (evidence, not an assertion —
   a duration threshold would assert machine speed rather than the gate).
2. Wait for `oddemo154-odd-platform-enricher-1` to reach `exited`; record its exit code.
3. Read the container states and the enricher log.
4. Query the catalog: `GET /api/datasources`, then `POST /api/search` + `GET /api/search/{id}/results`.
5. Open `http://localhost:18095/management/datasources` in a browser.
6. Run the stand-free injector cases (7, 8, 9 and 10 below) — none needs the demo stand; 9 needs only a
   throwaway HTTP stand-in that rejects `POST /ingestion/entities`, and 10 one that redirects `/api/**` to
   a login page.

**Automated rail**: `integration-tests/run-suite.sh IT-154` (or the `multi-stack` suite).

**How the rail maps onto the eleven checks below — it reports FIVE Playwright cases, not eleven.** Checks 1-6b
share one demo stand and one enricher run, so they are one case using **soft assertions**: every one of them
still reports independently on failure, but the expensive stand is built once. Checks 7, 8, 9 and 10 are their own
cases because they need no demo stand at all (9 and 10 bring up a throwaway in-process stand-in instead). Two alternatives were built and run against the unfixed base before
settling on this: `serial` mode stops at the first failure, so a red result cannot say *which* defect
regressed — which is the entire job of checks 4/5/6 — and six independent cases do each report, but Playwright
discards the worker after a failed test and re-runs `beforeAll`, rebuilding the whole stand once per red
assertion (~2 minutes each). A human executing the protocol by hand simply does the checks in order.

## 5. What it checks — assertions

| # | PASS when | FAIL signature (the bug's shape) |
|---|---|---|
| 1 | `odd-platform` declares a healthcheck and reaches `healthy`; `database` likewise | `.State.Health` absent — the file declares no healthcheck at all |
| 2 | the enricher's `StartedAt` is at or after the platform's first passing health probe | the enricher started while the platform was still booting |
| 3 | the enricher exits `0`; its log contains no `Skipping` and no `were NOT injected` | exit 1 with `Couldn't reach the platform in 20 tries`, or a silent `Skipping` line |
| 4 | `GET /api/datasources` returns exactly **10** items, including `//s3/cloud/aws` | 9 items, `//s3/cloud/aws` absent |
| 5 | a search for `kds_clickstream` returns > 0 entities | 0 — an empty catalog, i.e. defect 1 rather than defect 2. This is what lets a red result name which defect regressed |
| 6 | a search for `transaction_dataset` (the S3 sample's entity) returns > 0 | 0 — the sample never loaded |
| 6b | `/management/datasources` renders `Data Lake S3` | the row the API now returns is not rendered |
| 7 | with one sample re-pointed at an undefined oddrn, the injector exits non-zero, names that file and that oddrn, says `Nothing has been injected`, and never reaches `Waiting for the platform` | exit 0 with one `Skipping` line — the silent under-delivery |
| 8 | run standalone against a closed port with `REACH_TRIES_NUMBER=2 REACH_RETRY_DELAY_SECONDS=1`, it exits non-zero within seconds, logs `attempt 2 of 2`, and its give-up message names `REACH_TRIES_NUMBER` and `migration set` | the knobs are ignored (they do not exist on the unfixed build) and the message names neither cause nor remedy |
| 9 | run against a Platform that accepts everything but rejects `POST /ingestion/entities` with `400 USR003`: the run reports that **actual status and body**, names the failing sample file, repeats every failure in a closing summary printed **after** the per-sample lines, and still **exits 0** | exit 0 with `Possibly the 'ingestion.filter.enabled' property is set to 'true'` — a guess, and a wrong one — no status, no body, no summary |
| 10 | run against an **auth-gated** Platform (health permit-all, `/api/**` → `302 /login`, `/login` → `200 text/html`): the run fails, names the redirect, its target and the `auth.type=DISABLED` remedy, and contains **neither** `JSONDecodeError` **nor** `Traceback (most recent call last)` | a raw `requests.exceptions.JSONDecodeError: Expecting value: line 1 column 1 (char 0)` traceback — `requests` follows the 302, the login page answers 200 `text/html`, the status-code guard passes, and the unguarded `.json()` raises out of the module (CTRIB-064; reported by a maintainer running the merged stand with `AUTH_TYPE=LOGIN_FORM`) |

**RED proof.** Assertions 1, 2, 4, 6, 7, 9 are deterministically red on the unfixed base; 10 is red on
the *merged* `ab457f0d` too (measured — it is CTRIB-064's residue, not #1870's); 3 is red on
the race (intermittent by nature); 8 is red because the env knobs do not exist. The base is a
**second, detached worktree pinned at the pre-fix commit**, created before any edit and never
written to — not the worktree the fix lives in.

**Why assertion 9 needs a stand-in Platform rather than the real one.** The real stand *does* produce
this failure — a second `docker compose up` hits `400 USR003`, `duplicate key … alert_unique_messenger_
oddrn_is_present`, the upstream alert-uniqueness defect tracked on `issues/odd-platform/PLT-014`. Asserting
against it would make this protocol's verdict hostage to someone else's fix: the day PLT-014 lands, the
assertion silently stops exercising the path. So case 9 injects the failure itself from a throwaway HTTP
stand-in that answers health / data-source calls normally and returns the same `400 USR003` shape on
ingestion. What is under test is the **injector's reporting**, not the Platform's rejection.

### Notes for whoever runs or maintains this

Three things about the *observation* here are load-bearing and were each learned by running it:

- **`docker inspect ... .State.Health.Log` is a FIVE-ENTRY RING BUFFER.** Read it at teardown and the oldest
  entry it still holds is a recent probe, not the health transition — an ordering check then fails against a
  perfectly correct stand. Capture the first passing probe right after the `up` command returns.
- **`{{json .State.Health.Log}}` makes `docker inspect` EXIT NON-ZERO** when the service declares no
  healthcheck — which is exactly the unfixed stand. Guard it in the Go template
  (`{{if .State.Health}}...{{else}}null{{end}}`), or the RED run reads as a harness crash instead of as the
  finding it is.
- **An in-process HTTP stand-in cannot be driven with `execSync`.** Case 9 serves its stand-in Platform
  from the Playwright process itself, and `execSync` blocks Node's event loop for the entire container run:
  the kernel accepts the stub's socket and nothing ever answers it, so the injector reports `Read timed out`
  on every attempt and burns its whole readiness budget. Worse, the run then reads as a *silent* hang —
  a container killed by the exec timeout never flushes python's block-buffered stdout, so the failure
  message contains nothing but `pip` output. `runInjector` is `async` (`promisify(exec)`) for exactly this
  reason, and every case passes `PYTHONUNBUFFERED=1` the way `docker/demo.yaml` does. Note also that the
  exit code is on `err.code` for `exec` and on `err.status` for `execSync` — reading the wrong one turns
  every failure into `1` and makes the exit-code assertions meaningless.
- **A ports override MERGES unless you say otherwise.** Compose appends `ports` entries across `-f` files
  (distinct host ports never collide with the uniqueness rule), so "remap" the demo's `8080`/`5432` with a
  plain override and you have *added* `18095`/`15495` beside them — the stand then owns all four host ports
  and fails to start whenever the developer-facing pair is busy. `demo-stand.ports.yml` uses `ports:
  !override` for exactly this reason; verify any change to it with `docker compose … config` and read the
  resolved `published` ports, not the file. Found by `/review` round 2 (2026-09-03), not by running — the
  suite was green because nothing else happened to hold those ports.
- **`ODD_PLATFORM_DIR` must be ABSOLUTE.** Playwright runs with cwd `integration-tests/e2e` while
  `run-regression.sh` runs from the workspace root, so the same relative string means two different
  directories. Pass a relative override and every case here dies on a path that does not exist — case 1 with
  `spawnSync /bin/sh ENOENT` (the compose `cwd`), 7-10 with `ENOENT … lstat`. `run-regression.sh:32`
  absolutizes only its *computed default*, so a reviewer — who must always override, since the stream id
  never matches the worktree suffix — hits it every time. Tracked as `TST-066`; until that lands, pass the
  absolute path.
- **Do not assert the `up` command's DURATION.** It is 2s on the unfixed stand and 62-86s on the fixed one, so
  a threshold looks tempting — but it would be asserting machine speed. The property under test is the
  *ordering* (the enricher starts at or after the platform's first passing probe), which is machine-independent.
  Record the duration as evidence in the run log instead.

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-{suite-or-IT}.md`.
Log fields: `date · stack_commit · platform image digest · runner (AI/human + name) · outcome
(PASS|FAIL) · evidence (captured values) · notes`. **The image digest is not optional here** — a
green result that cannot name the binary it was green against is not evidence.

## Cross-references

- Source: `issues/odd-platform/PLT-255.md` → [odd-platform#1870](https://github.com/opendatadiscovery/odd-platform/issues/1870)
- Work record: `contributor/CTRIB-063.md`
- Automation: `integration-tests/e2e/specs/demo-stand-first-run.spec.ts` + `e2e/helpers/demo-stand.ts`
- Adjacent, deliberately NOT covered here: `issues/odd-platform/PLT-254` (#1869, the collector's
  500-instead-of-401) and `issues/odd-platform/PLT-014` (the alert-uniqueness defect that makes a
  *second* ingestion of the Great Expectations sample return `400 USR003`).
